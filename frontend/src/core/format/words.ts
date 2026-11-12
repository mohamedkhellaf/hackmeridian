// Plural and list forms through Intl (brief D18): copy is never assembled from "s" suffixes or hand-placed commas.

import { groupDigits, MINUS } from './amount'

/** The forms a noun needs. English uses `one` and `other`; the rest exist so the type fits `Intl.PluralRules`. */
export interface PluralForms {
  one: string
  other: string
  zero?: string
  two?: string
  few?: string
  many?: string
}

const cardinal = new Intl.PluralRules('en-GB')

/** The right form for a count: `plural(1, { one: 'maker', other: 'makers' })` is `maker`. */
export function plural(count: number | bigint, forms: PluralForms): string {
  const n = typeof count === 'bigint' ? Number(count) : count
  return forms[cardinal.select(Math.abs(n))] ?? forms.other
}

/** Alias of `plural`, for callers that look for this name. */
export const pluralize = plural

/** Count and noun: `countOf(2, { one: 'maker', other: 'makers' })` is `2 makers`. Whole counts are grouped. */
export function countOf(count: number | bigint, forms: PluralForms): string {
  const text = count.toString()
  const digits = text.replace(/^-/, '')
  return `${text.startsWith('-') ? MINUS : ''}${groupDigits(digits)} ${plural(count, forms)}`
}

const lists = {
  conjunction: new Intl.ListFormat('en-GB', { style: 'long', type: 'conjunction' }),
  disjunction: new Intl.ListFormat('en-GB', { style: 'long', type: 'disjunction' }),
}

/** `RWA, BOND and EQTY` (`conjunction`, the default) or `RWA, BOND or EQTY` (`disjunction`). */
export function formatList(items: readonly string[], type: 'conjunction' | 'disjunction' = 'conjunction'): string {
  return lists[type].format(items)
}
