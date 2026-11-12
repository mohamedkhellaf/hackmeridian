/**
 * The store behind `ToastRegion`. Plain module state so `toast()` works from anywhere.
 * A toast is only ever a duplicate of something recorded elsewhere (the row, the receipt, the Activity list).
 */
import { announce } from './announce'

export type ToastTone = 'neutral' | 'success' | 'warning' | 'danger'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  /** Two or three words: "Address copied", "Offer cancelled". */
  title: string
  /** One sentence at most. */
  description?: string
  tone?: ToastTone
  /** Milliseconds before it leaves. `null` keeps it until dismissed. Failures and toasts with an action never leave by themselves. */
  duration?: number | null
  action?: ToastAction
}

export interface ToastRecord {
  id: number
  title: string
  description?: string
  tone: ToastTone
  duration: number | null
  action?: ToastAction
}

export const TOAST_DEFAULT_MS = 8000
export const TOAST_LIMIT = 3

let nextId = 1
let toasts: readonly ToastRecord[] = []
const listeners = new Set<() => void>()

function emit(next: readonly ToastRecord[]): void {
  toasts = next
  for (const listener of listeners) listener()
}

/** Shows a notice and announces it (politely, or assertively for `danger`). Returns its id. */
export function toast(options: ToastOptions): number {
  const tone = options.tone ?? 'neutral'
  const sticky = tone === 'danger' || options.action !== undefined
  const record: ToastRecord = {
    id: nextId++,
    title: options.title,
    description: options.description,
    tone,
    duration: options.duration === undefined ? (sticky ? null : TOAST_DEFAULT_MS) : options.duration,
    action: options.action,
  }
  // Newest last; when the stack is full the oldest leaves.
  emit([...toasts, record].slice(-TOAST_LIMIT))
  announce(options.description ? `${options.title}. ${options.description}` : options.title, tone === 'danger' ? 'assertive' : 'polite')
  return record.id
}

export function dismissToast(id: number): void {
  if (toasts.some((t) => t.id === id)) emit(toasts.filter((t) => t.id !== id))
}

export function clearToasts(): void {
  if (toasts.length > 0) emit([])
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getToasts(): readonly ToastRecord[] {
  return toasts
}
