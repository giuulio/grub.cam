type SafariGesture = Event & { scale: number; clientX: number; clientY: number }
type PinchCamera = { getZoom: () => number; stop: () => void; zoomAround: (zoom: number, clientX: number, clientY: number) => void }

/** Desktop Safari uses GestureEvents instead of the ctrl+wheel pinch used by other browsers.
 * Bind only to the map canvas: browser zoom elsewhere and keyboard zoom stay untouched.
 * Touchscreen pinches are handled by the map engine, so callers enable this only for fine pointers.
 */
export function bindSafariPinch(element: HTMLElement, camera: PinchCamera) {
  let startZoom: number | undefined
  const start = (event: Event) => {
    event.preventDefault()
    camera.stop()
    startZoom = camera.getZoom()
  }
  const change = (event: Event) => {
    if (startZoom === undefined) return
    event.preventDefault()
    const { scale, clientX, clientY } = event as SafariGesture
    if (Number.isFinite(scale) && scale > 0) camera.zoomAround(startZoom + Math.log2(scale), clientX, clientY)
  }
  const end = (event: Event) => {
    if (startZoom === undefined) return
    event.preventDefault()
    startZoom = undefined
  }
  // Some Safari versions emit wheel events during a GestureEvent sequence too.
  const wheel = (event: WheelEvent) => {
    if (startZoom === undefined) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  element.addEventListener('gesturestart', start, { passive: false })
  element.addEventListener('gesturechange', change, { passive: false })
  element.addEventListener('gestureend', end, { passive: false })
  element.addEventListener('wheel', wheel, { capture: true, passive: false })
  return () => {
    element.removeEventListener('gesturestart', start)
    element.removeEventListener('gesturechange', change)
    element.removeEventListener('gestureend', end)
    element.removeEventListener('wheel', wheel, true)
  }
}
