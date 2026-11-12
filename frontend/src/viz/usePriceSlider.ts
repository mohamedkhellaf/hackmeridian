import { useCallback, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, RefObject } from 'react'
import { sliderKeyValue } from './a11y.ts'
import { magnet, snapToStep } from './geometry.ts'
import { clamp } from './scales.ts'

export interface PriceSliderOptions {
  /** The plot element: pointer positions are read against its left edge, and it captures the pointer. */
  plotRef: RefObject<HTMLElement | null>
  value: number
  min: number
  max: number
  step: number
  largeStep?: number
  /** Called with the new price. Without it the handle is drawn but does not move. */
  onChange?: (value: number) => void
  /** Pixel offset from the left edge of the plot to a price. */
  invert: (px: number) => number
  /** Prices a drag snaps onto when the pointer is within `magnetPx` of them (strike, breakeven, reference). */
  magnets?: readonly number[]
  magnetPx?: number
  /** Pixels per unit of price, to turn `magnetPx` into a price tolerance. */
  pxPerUnit: number
  disabled?: boolean
}

export interface PriceSlider {
  sliderRef: RefObject<HTMLDivElement | null>
  dragging: boolean
  plotHandlers: {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => void
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => void
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => void
    onPointerCancel: (e: PointerEvent<HTMLDivElement>) => void
  }
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
}

interface Drag {
  id: number
  start: number
  touch: boolean
  originX: number
  originY: number
  moved: boolean
}

/**
 * Pointer and keyboard behaviour of the assumed-price handle (APG slider pattern). A click or tap anywhere on
 * the plot sets the price, which is the single-pointer alternative to dragging (WCAG 2.5.7). On touch screens a
 * vertical gesture still scrolls the page: the price only follows a horizontal drag or a tap.
 */
export function usePriceSlider({
  plotRef,
  value,
  min,
  max,
  step,
  largeStep,
  onChange,
  invert,
  magnets = [],
  magnetPx = 6,
  pxPerUnit,
  disabled = false,
}: PriceSliderOptions): PriceSlider {
  const sliderRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<Drag | null>(null)
  const [dragging, setDragging] = useState(false)

  const valueAt = useCallback(
    (clientX: number): number => {
      const el = plotRef.current
      if (!el) return value
      const raw = clamp(invert(clientX - el.getBoundingClientRect().left), min, max)
      const inside = magnets.filter((m) => m >= min && m <= max)
      const pulled = pxPerUnit > 0 ? magnet(raw, inside, magnetPx / pxPerUnit) : raw
      return pulled !== raw ? pulled : clamp(snapToStep(raw, step), min, max)
    },
    [invert, magnets, magnetPx, max, min, plotRef, pxPerUnit, step, value],
  )

  const end = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    if (d && e.currentTarget.hasPointerCapture?.(d.id)) e.currentTarget.releasePointerCapture(d.id)
  }, [])

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (disabled || !onChange || e.button !== 0) return
      const touch = e.pointerType === 'touch'
      drag.current = { id: e.pointerId, start: value, touch, originX: e.clientX, originY: e.clientY, moved: false }
      e.currentTarget.setPointerCapture?.(e.pointerId)
      setDragging(true)
      if (!touch) {
        // Keep the text of the page from being selected by the drag; focus is moved by hand.
        e.preventDefault()
        onChange(valueAt(e.clientX))
      }
      sliderRef.current?.focus({ preventScroll: true })
    },
    [disabled, onChange, value, valueAt],
  )

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d || d.id !== e.pointerId || !onChange) return
      if (d.touch && !d.moved) {
        // Wait until the gesture is clearly horizontal; a vertical one belongs to the page.
        const dx = Math.abs(e.clientX - d.originX)
        const dy = Math.abs(e.clientY - d.originY)
        if (dx < 4 || dx < dy) return
        d.moved = true
      }
      onChange(valueAt(e.clientX))
    },
    [onChange, valueAt],
  )

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (d && d.id === e.pointerId && d.touch && !d.moved && onChange) onChange(valueAt(e.clientX))
      end(e)
    },
    [end, onChange, valueAt],
  )

  const onPointerCancel = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      // The browser took the gesture over (a scroll): put the price back where it was.
      const d = drag.current
      if (d && d.id === e.pointerId && d.moved && onChange) onChange(d.start)
      end(e)
    },
    [end, onChange],
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (disabled || !onChange) return
      if (e.key === 'Escape' && drag.current) {
        const d = drag.current
        drag.current = null
        setDragging(false)
        if (plotRef.current?.hasPointerCapture?.(d.id)) plotRef.current.releasePointerCapture(d.id)
        onChange(d.start)
        e.preventDefault()
        return
      }
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const next = sliderKeyValue(e.key, { value, min, max, step, largeStep, shiftKey: e.shiftKey })
      if (next === null) return
      e.preventDefault()
      if (next !== value) onChange(next)
    },
    [disabled, largeStep, max, min, onChange, plotRef, step, value],
  )

  return { sliderRef, dragging, plotHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }, onKeyDown }
}

/**
 * Controlled when `value` is given, otherwise it keeps its own state starting from `initial`. When `initial`
 * changes (another position, another reference price) the handle starts again from it, instead of keeping a price
 * that belonged to the previous figure.
 */
export function useControlledPrice(value: number | undefined, initial: number, onChange?: (v: number) => void): [number, (v: number) => void] {
  const [inner, setInner] = useState(initial)
  const [seed, setSeed] = useState(initial)
  if (seed !== initial && !(Number.isNaN(seed) && Number.isNaN(initial))) {
    setSeed(initial)
    setInner(initial)
  }
  const controlled = value !== undefined
  const set = useCallback(
    (v: number) => {
      if (!controlled) setInner(v)
      onChange?.(v)
    },
    [controlled, onChange],
  )
  return [controlled ? value : inner, set]
}
