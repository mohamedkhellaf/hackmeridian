// Text measurement for label placement. Widths come from a hidden SVG text node that wears the same CSS class
// as the label, so tabular figures, weight and the loaded webfont are all accounted for. Results are cached and
// thrown away when a font finishes loading. Outside a browser (tests) the estimate is used.

import { useSyncExternalStore } from 'react'
import { estimateTextWidth } from './labels.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

let probe: SVGTextElement | null = null
let version = 0
let watching = false
const cache = new Map<string, number>()
const listeners = new Set<() => void>()

function invalidate(): void {
  cache.clear()
  version += 1
  for (const listener of listeners) listener()
}

function watchFonts(): void {
  if (watching || typeof document === 'undefined' || !document.fonts) return
  watching = true
  document.fonts.addEventListener?.('loadingdone', invalidate)
  void document.fonts.ready.then(invalidate)
}

function getProbe(): SVGTextElement | null {
  if (typeof document === 'undefined' || !document.body) return null
  if (probe?.isConnected) return probe
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  svg.setAttribute('width', '1')
  svg.setAttribute('height', '1')
  svg.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;z-index:-1'
  probe = document.createElementNS(SVG_NS, 'text')
  svg.appendChild(probe)
  document.body.appendChild(svg)
  return probe
}

/** Width in pixels of `text` drawn with the CSS class `className`. `fontSize` only feeds the fallback estimate. */
export function measureText(text: string, className: string, fontSize = 12): number {
  if (!text) return 0
  const key = `${className}\u0000${text}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const node = getProbe()
  if (!node) return estimateTextWidth(text, fontSize)
  node.setAttribute('class', className)
  node.textContent = text
  let width = 0
  try {
    width = node.getComputedTextLength()
  } catch {
    width = 0
  }
  if (!(width > 0)) return estimateTextWidth(text, fontSize)
  // A dragged handle prints a new price on every move; the cache must not grow without bound.
  if (cache.size > 4000) cache.clear()
  cache.set(key, width)
  return width
}

function subscribe(listener: () => void): () => void {
  watchFonts()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getVersion = () => version
const getServerVersion = () => 0

/** `measureText`, re-rendering the caller when a webfont has loaded and widths have changed. */
export function useTextMeasure(): typeof measureText {
  useSyncExternalStore(subscribe, getVersion, getServerVersion)
  return measureText
}
