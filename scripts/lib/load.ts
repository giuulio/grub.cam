import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import type { ZodType } from 'zod'
import { College, DataBundle, HoursFile, MenuFile, type College as TCollege, type DataBundle as TBundle } from '../schema.ts'

const ROOT = new URL('../../', import.meta.url).pathname

function loadDir<T>(dir: string, schema: ZodType<T>, ext: string): T[] {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return []
  const out: T[] = []
  const errors: string[] = []
  for (const f of readdirSync(abs).filter((x) => x.endsWith(ext)).sort()) {
    const raw = readFileSync(join(abs, f), 'utf8')
    const data = ext === '.yaml' ? parse(raw) : JSON.parse(raw)
    const r = schema.safeParse(data)
    if (r.success) out.push(r.data)
    else errors.push(`${dir}/${f}:\n  ` + r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  '))
  }
  if (errors.length) throw new Error(errors.join('\n'))
  return out
}

export function loadColleges(): TCollege[] {
  return loadDir('data/colleges', College, '.yaml')
}

export function loadBundle(): TBundle {
  const colleges = loadColleges()
  const hours = loadDir('data/hours', HoursFile, '.yaml')
  const menus: MenuFile[] = []
  const menusRoot = join(ROOT, 'menus')
  if (existsSync(menusRoot)) {
    for (const week of readdirSync(menusRoot).sort()) menus.push(...loadDir(`menus/${week}`, MenuFile, '.json'))
  }

  const problems: string[] = []
  const venueIds = new Set<string>()
  for (const c of colleges) for (const v of c.venues) {
    const id = `${c.slug}/${v.slug}`
    if (venueIds.has(id)) problems.push(`duplicate venue id ${id}`)
    venueIds.add(id)
  }
  const slots = hours.flatMap((h) =>
    h.slots.map((s) => {
      const id = `${h.college}/${s.venue}`
      if (!venueIds.has(id)) problems.push(`hours: unknown venue ${id}`)
      return { ...s, college: h.college }
    }),
  )
  const hoursCollegeSet = new Set(hours.map((h) => h.college))
  for (const c of colleges) if (!hoursCollegeSet.has(c.slug)) problems.push(`no hours file for ${c.slug}`)
  for (const m of menus) {
    if (!venueIds.has(`${m.college}/${m.venue}`)) problems.push(`menu ${m.week}/${m.college}: unknown venue ${m.venue}`)
  }
  if (problems.length) throw new Error(problems.join('\n'))

  return DataBundle.parse({ generated_at: new Date().toISOString(), colleges, slots, menus })
}

export type { MenuFile }
