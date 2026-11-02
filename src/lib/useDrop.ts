import { useLayoutEffect, type RefObject } from 'react'

/**
 * On a phone, where a filter's list opens: the screen's width, just under its chip (`--drop`, measured as it opens and
 * set on `box`, which holds both), as a row of chips that scrolls sideways would clip a list hung from the chip itself.
 */
export function useDrop(box: RefObject<HTMLElement | null>, open: boolean) {
  useLayoutEffect(() => {
    if (open && box.current) box.current.style.setProperty('--drop', `${Math.round(box.current.getBoundingClientRect().bottom + 8)}px`)
  }, [open, box])
}
