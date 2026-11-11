import { describe, expect, it } from 'vitest'
import { BANNED_PRICE_TERMS, BANNED_TAGLINES, BANNED_WORDS, DISCLOSURE_HOMES, MARGIN_BANNED_WORDS, findBannedWords } from '../../core/disclosures'
import { NBSP } from '../../core/format'
import { GUIDED_INTENTS } from '../../core/payoff/strategies'
import {
  GLOSSARY,
  INTENT_COPY,
  MARGIN_INTRO,
  MARGIN_LINK,
  MARGIN_POINTS,
  MARGIN_TITLE,
  QUESTIONS,
  RISKS,
  RULES,
  SECTIONS,
  STATIC_COPY,
  WHAT_THIS_IS,
  breakevenLabel,
  intentsIntro,
  lifecycleBranches,
  lifecycleIntro,
  lifecycleSpine,
  premiumPerUnit,
  scenarioDelta,
  scenarioLabel,
} from './content'
import { LIFECYCLE_TERMS, deadlineText, workedExample, workedExamples } from './examples'

const DEADLINE = deadlineText(Math.floor(Date.parse('2026-11-20T08:00:00Z') / 1000))
const plain = (text: string) => text.replaceAll(NBSP, ' ')

/** Every template of the page rendered with the real examples: what a reader can actually see. */
function renderedCopy(): string[] {
  const out: string[] = []
  const put = workedExample(LIFECYCLE_TERMS)
  out.push(lifecycleIntro(put), intentsIntro(put, DEADLINE))
  for (const step of [...lifecycleSpine(put, DEADLINE), ...lifecycleBranches(put).flatMap((b) => b.steps)]) {
    out.push(step.when, step.title, step.text, step.state ?? '')
  }
  out.push(...lifecycleBranches(put).map((b) => b.label))
  const examples = workedExamples()
  for (const x of examples) {
    const copy = INTENT_COPY[x.intent]
    out.push(
      x.name,
      copy.statement,
      copy.contract,
      copy.position(x),
      copy.deal(x, DEADLINE),
      copy.trade(x),
      copy.strikeLabel(x),
      copy.premiumLabel,
      breakevenLabel(x),
      copy.collateralLabel,
      copy.maxLossHint?.(x) ?? '',
      copy.maxGainHint?.(x) ?? '',
      copy.givesUp?.value(x) ?? '',
      copy.givesUp?.hint(x) ?? '',
      copy.chartTitle(x),
      copy.withLabel,
      copy.withoutLabel,
      copy.comparedWith,
      copy.sameAs,
      copy.levelLabel(x),
      copy.action,
      premiumPerUnit(x),
    )
    for (const s of x.scenarios) out.push(scenarioLabel(x, s), scenarioDelta(x, s), copy.outcome(x, s))
  }
  return out.filter((text) => text !== '')
}

const ALL_COPY = [...STATIC_COPY, ...renderedCopy()]

describe('the structure of the Learn page', () => {
  it('has seven sections with distinct ids that work as URL fragments', () => {
    expect(SECTIONS.map((s) => s.id)).toEqual(['what-this-is', 'lifecycle', 'intents', 'requests-resale', 'risks', 'glossary', 'questions'])
    for (const s of SECTIONS) expect(s.id).toMatch(/^[a-z][a-z-]*$/)
  })

  it('says what this is in two sentences, and leaves the rest to the rules table', () => {
    expect(WHAT_THIS_IS).toHaveLength(2)
    // One sentence each: a single full stop, at the end.
    for (const sentence of WHAT_THIS_IS) expect(sentence.match(/[.?](\s|$)/g)).toHaveLength(1)
    // The same words on a mock build and a contract build: the network is named where it is a state, not here.
    expect(WHAT_THIS_IS.join(' ')).not.toContain('Testnet')
  })

  it('says once that a settlement is all or nothing: in the rules table', () => {
    const atomic = ALL_COPY.filter((text) => /nothing moves/.test(text))
    expect(atomic).toEqual([RULES.find((r) => r.rule === 'Settlement')!.text])
  })

  it('has copy for each of the four intents', () => {
    expect(Object.keys(INTENT_COPY).sort()).toEqual(GUIDED_INTENTS.map((i) => i.id).sort())
  })

  it('defines the vocabulary of the interface, in alphabetical order, one sentence per term', () => {
    const terms = GLOSSARY.map((g) => g.term)
    for (const required of ['Offer', 'Request', 'Maker', 'Holder', 'Writer', 'Collateral', 'Strike', 'Premium', 'Exercise', 'Claim delivery', 'Reclaim', 'Deadline', 'Reserves', 'Resale listing', 'Covered', 'Margin', 'Breakeven', 'In the money']) {
      expect(terms).toContain(required)
    }
    // One word per thing: no entry exists only to say that a second name exists.
    for (const alias of ['Bid', 'Expiry']) expect(terms).not.toContain(alias)
    expect(GLOSSARY.find((g) => g.term === 'Writer')!.definition).toMatch(/^In Margin,/)
    expect(GLOSSARY.find((g) => g.term === 'Request')!.definition).toContain('the contract calls it a bid')
    expect(terms).toEqual([...terms].sort((a, b) => a.localeCompare(b, 'en')))
    expect(new Set(terms).size).toBe(terms.length)
    for (const entry of GLOSSARY) {
      expect(entry.definition.endsWith('.')).toBe(true)
      expect(entry.definition.match(/[.?](\s|$)/g), entry.term).toHaveLength(1)
    }
  })

  it('lists the limits, the questions and the rules without duplicates', () => {
    expect(RISKS.map((r) => r.id)).toEqual(['deadline', 'thin', 'testnet', 'unaudited'])
    // A question is here only when no section above answers it.
    expect(QUESTIONS.map((q) => q.id)).toEqual(['real-money', 'start', 'who-sells', 'premium-back', 'leave-early', 'price', 'fees'])
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length)
    expect(new Set(RULES.map((r) => r.rule)).size).toBe(RULES.length)
  })
})

describe('the wording of the Learn page', () => {
  it('uses none of the banned words, price terms or taglines', () => {
    for (const text of ALL_COPY) {
      expect(findBannedWords(text), text).toEqual([])
      expect(findBannedWords(text, BANNED_PRICE_TERMS), text).toEqual([])
      expect(findBannedWords(text, BANNED_TAGLINES), text).toEqual([])
    }
    // The list itself still holds the words this page must never use.
    expect(BANNED_WORDS).toContain('guaranteed')
  })

  it('never calls Margin fully collateralized', () => {
    for (const text of [MARGIN_TITLE, MARGIN_INTRO, MARGIN_LINK, ...MARGIN_POINTS]) expect(findBannedWords(text, MARGIN_BANNED_WORDS), text).toEqual([])
    for (const g of GLOSSARY.filter((entry) => /margin/i.test(entry.definition))) expect(findBannedWords(g.definition, MARGIN_BANNED_WORDS), g.term).toEqual([])
  })

  it('carries no hedge word as a caption: not "experimental", not "fictional"', () => {
    for (const text of ALL_COPY) expect(text, text).not.toMatch(/\b(experimental|fictional)\b/i)
  })

  it('prints the recorded fees exactly, never rounded up', () => {
    const fees = QUESTIONS.find((q) => q.id === 'fees')!.answer.join(' ')
    for (const fee of ['0.0309366', '0.0031976', '0.0079873', '0.0010223']) expect(fees).toContain(fee)
  })

  it('has no dashes used as punctuation, arrows, exclamation marks or emoji', () => {
    for (const text of ALL_COPY) {
      expect(text, text).not.toMatch(/[—–!]/)
      expect(text, text).not.toMatch(/[←-⇿⟰-⟿⤀-⥿]/)
      expect(text, text).not.toMatch(/\p{Extended_Pictographic}/u)
      expect(text, text).not.toMatch(/ - | -- /)
    }
  })

  it('does not retype a required sentence: each has its one home elsewhere', () => {
    const page = plain(ALL_COPY.join('\n'))
    for (const home of DISCLOSURE_HOMES) expect(page.includes(home.text), home.id).toBe(false)
  })

  it('is in sentence case: a heading or a label starts with a capital and does not capitalise each word', () => {
    const titles = [...SECTIONS.map((s) => s.title), ...RISKS.map((r) => r.title), ...QUESTIONS.map((q) => q.question), ...RULES.map((r) => r.rule), MARGIN_TITLE]
    const properNouns = new Set(['Covered', 'Margin', 'USDx', 'BOND', 'StellSec', 'Stellar', 'Testnet', 'Markets', 'Portfolio', 'I'])
    for (const title of titles) {
      expect(title[0], title).toBe(title[0].toUpperCase())
      const capitalised = title.split(/\s+/).slice(1).filter((word) => /^[A-Z]/.test(word) && !properNouns.has(word.replace(/[^A-Za-z]/g, '')))
      expect(capitalised, title).toEqual([])
    }
  })

  it('keeps a figure with its unit and a deadline on one line', () => {
    const floor = workedExamples()[0]
    const deal = INTENT_COPY.floor.deal(floor, DEADLINE)
    expect(plain(deal)).toBe('Pay 1.80 USDx. Until 20 Nov 2026, 08:00 UTC you can sell 5.00 BOND for 50.00 USDx.')
    expect(deal).toContain(`1.80${NBSP}USDx`)
    expect(deal).toContain(`20${NBSP}Nov${NBSP}2026,${NBSP}08:00${NBSP}UTC`)
  })

  it('says who acts in each outcome', () => {
    const [floor, earnHold, earnBuy, lockBuy] = workedExamples()
    expect(plain(INTENT_COPY.floor.outcome(floor, floor.scenarios[0]))).toBe('You exercise: deliver 5.00 BOND and receive 50.00 USDx, less the 1.80 USDx you paid.')
    expect(plain(INTENT_COPY.floor.outcome(floor, floor.scenarios[2]))).toBe(
      'You do nothing and the put expires. You keep 5.00 BOND worth 60.00 USDx, less the 1.80 USDx you paid.',
    )
    expect(plain(INTENT_COPY['earn-hold'].outcome(earnHold, earnHold.scenarios[2]))).toBe(
      'If the holder exercises, your 5.00 BOND go for 52.50 USDx, which you claim. You keep the 0.95 USDx; the rise above 10.50 is not yours.',
    )
    expect(plain(INTENT_COPY['earn-buy'].outcome(earnBuy, earnBuy.scenarios[0]))).toBe(
      'If the holder exercises, your 47.50 USDx buy 5.00 BOND, which you claim, now worth 40.00 USDx. You keep the 1.20 USDx.',
    )
    expect(plain(INTENT_COPY['lock-buy'].outcome(lockBuy, lockBuy.scenarios[2]))).toBe(
      'You exercise: pay 50.00 USDx and receive 5.00 BOND worth 60.00 USDx, less the 1.90 USDx you paid.',
    )
    expect(plain(premiumPerUnit(floor))).toBe('0.36 USDx per BOND')
    // The sign carries the direction; the words stay neutral, so a loss never reads as a double negative.
    expect(plain(scenarioDelta(floor, floor.scenarios[0]))).toBe('+8.20 USDx compared with no floor')
    expect(plain(scenarioDelta(floor, floor.scenarios[1]))).toBe('−1.80 USDx compared with no floor')
    expect(plain(scenarioDelta(earnBuy, earnBuy.scenarios[0]))).toBe('−6.30 USDx compared with keeping the cash')
    expect(plain(scenarioDelta(earnHold, earnHold.scenarios[2]))).toBe('−6.55 USDx compared with just holding')
  })

  it('gives a written call no loss figure: it states what is given up', () => {
    const earnHold = workedExamples()[1]
    const givesUp = INTENT_COPY['earn-hold'].givesUp!
    expect(plain(givesUp.value(earnHold))).toBe('Every rise above 10.50 USDx per BOND')
    expect(plain(givesUp.hint(earnHold))).toBe('You cannot owe more than the 5.00 BOND you lock; it can still fall in price.')
    for (const intent of ['floor', 'earn-buy', 'lock-buy'] as const) expect(INTENT_COPY[intent].givesUp).toBeUndefined()
  })
})
