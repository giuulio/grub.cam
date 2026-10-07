// Usage: npm run ingest -- [--week 2026-W41] [--only homerton,jesus]
import { mkdirSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { MenuFile } from '../schema.ts'
import { isoWeek, todayLondon, weekDates } from './lib/dates.ts'
import { toMenuFile, type Source } from './lib/source.ts'
import { corpus } from './sources/corpus.ts'
import { darwin } from './sources/darwin.ts'
import { downing } from './sources/downing.ts'
import { homerton } from './sources/homerton.ts'
import { jesus } from './sources/jesus.ts'
import { magdalene } from './sources/magdalene.ts'
import { peterhouse } from './sources/peterhouse.ts'
import { robinson } from './sources/robinson.ts'
import { selwyn } from './sources/selwyn.ts'
import { stJohns } from './sources/st-johns.ts'
import { wolfson } from './sources/wolfson.ts'

export const SOURCES: Source[] = [homerton, peterhouse, corpus, jesus, robinson, selwyn, stJohns, downing, darwin, wolfson, magdalene]

const { values } = parseArgs({ options: { week: { type: 'string' }, only: { type: 'string' } } })
const today = todayLondon()
const week = values.week ?? isoWeek(today)
const ctx = { week, dates: weekDates(week), today }
const only = values.only?.split(',').map((s) => s.trim())

const dir = `menus/${week}`
mkdirSync(dir, { recursive: true })

let failures = 0
for (const src of SOURCES) {
  if (only && !only.includes(src.college)) continue
  const t0 = Date.now()
  try {
    const { days, note } = await src.fetch(ctx)
    const file = MenuFile.parse(toMenuFile(src, ctx, days, note))
    const dishes = file.days.reduce((n, d) => n + d.items.length, 0)
    writeFileSync(`${dir}/${src.college}.json`, JSON.stringify(file, null, 2) + '\n')
    console.log(`✓ ${src.college.padEnd(16)} ${String(file.days.length).padStart(2)} services ${String(dishes).padStart(4)} dishes  ${Date.now() - t0}ms`)
  } catch (e) {
    failures++
    console.error(`✗ ${src.college}: ${(e as Error).message}`)
  }
}
process.exit(failures ? 1 : 0)
