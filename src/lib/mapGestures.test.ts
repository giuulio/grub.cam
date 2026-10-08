import { describe, expect, it, vi } from 'vitest'
import { bindSafariPinch } from './mapGestures.ts'

const gesture = (type: string, scale = 1) => Object.assign(new Event(type, { cancelable: true }), { scale, clientX: 200, clientY: 100 })

describe('Safari trackpad pinch', () => {
  it('zooms around the pointer and prevents webpage magnification only during map gestures', () => {
    const canvas = new EventTarget() as HTMLElement
    const elsewhere = new EventTarget()
    const camera = { getZoom: () => 13, stop: vi.fn(), zoomAround: vi.fn() }
    const cleanup = bindSafariPinch(canvas, camera)
    const outside = gesture('gesturestart')
    elsewhere.dispatchEvent(outside)
    expect(outside.defaultPrevented).toBe(false)
    const start = gesture('gesturestart')
    canvas.dispatchEvent(start)
    expect(start.defaultPrevented).toBe(true)
    canvas.dispatchEvent(gesture('gesturechange', 2))
    expect(camera.zoomAround).toHaveBeenLastCalledWith(14, 200, 100)
    canvas.dispatchEvent(gesture('gesturechange', 0.5))
    expect(camera.zoomAround).toHaveBeenLastCalledWith(12, 200, 100)
    const duplicateWheel = new Event('wheel', { cancelable: true })
    canvas.dispatchEvent(duplicateWheel)
    expect(duplicateWheel.defaultPrevented).toBe(true)
    canvas.dispatchEvent(gesture('gestureend'))
    const ordinaryWheel = new Event('wheel', { cancelable: true })
    canvas.dispatchEvent(ordinaryWheel)
    expect(ordinaryWheel.defaultPrevented).toBe(false)
    cleanup()
    const afterUnmount = gesture('gesturestart')
    canvas.dispatchEvent(afterUnmount)
    expect(afterUnmount.defaultPrevented).toBe(false)
  })
  it('ignores changes without a start and invalid scale values', () => {
    const canvas = new EventTarget() as HTMLElement
    const camera = { getZoom: () => 13, stop: vi.fn(), zoomAround: vi.fn() }
    const cleanup = bindSafariPinch(canvas, camera)
    canvas.dispatchEvent(gesture('gesturechange', 2))
    canvas.dispatchEvent(gesture('gesturestart'))
    for (const scale of [0, -1, NaN, Infinity]) canvas.dispatchEvent(gesture('gesturechange', scale))
    expect(camera.zoomAround).not.toHaveBeenCalled()
    cleanup()
  })
})
