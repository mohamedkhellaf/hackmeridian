import { describe, expect, it } from 'vitest'
import type { ActivityEntry } from '../../data'
import { TX_EFFECT_TEXT, TX_PHASE_HELP } from '../../data'
import { activityRow, activityRows, noteOf, settledCount, targetOf } from './model'

const HASH = 'b3c8fdd1a609e688f2b76b92e9dc9ce3f867062129a09fcc6092e667c7c7808e'

const entry = (part: Partial<ActivityEntry> = {}): ActivityEntry => ({
  id: 'e1',
  address: 'GTEST',
  product: 'covered',
  action: 'buy',
  label: 'Buy put on 5.00 BOND',
  detail: null,
  done: 'Bought',
  subject: 'option:12',
  phase: 'confirmed',
  effect: 'fee-charged',
  hash: HASH,
  maxTime: null,
  ledger: 58331204,
  error: null,
  mock: false,
  startedAt: Date.UTC(2026, 10, 11, 14, 2, 11),
  updatedAt: Date.UTC(2026, 10, 11, 14, 2, 16),
  ...part,
})

const ON = { marginEnabled: true }

describe('activityRow', () => {
  it('describes a confirmed transaction with its word, ledger and explorer link', () => {
    const row = activityRow(entry(), ON)
    expect(row.state).toBe('Confirmed')
    expect(row.tone).toBe('confirmed')
    expect(row.note).toBe('Bought, in ledger 58,331,204.')
    expect(row.hashUrl).toBe(`https://stellar.expert/explorer/testnet/tx/${HASH}`)
    expect(row.settled).toBe(true)
    expect(row.canCheck).toBe(false)
  })

  it('gives a mock hash no explorer link', () => {
    const row = activityRow(entry({ mock: true, ledger: null }), ON)
    expect(row.hash).toBe(HASH)
    expect(row.hashUrl).toBeNull()
    expect(row.note).toBe('Bought.')
  })

  it('tells a failure that charged the fee from one that sent nothing', () => {
    const charged = activityRow(entry({ phase: 'failed', effect: 'fee-charged', error: 'This option has expired.' }), ON)
    expect(charged.state).toBe('Failed')
    expect(charged.tone).toBe('failed')
    expect(charged.note).toBe(`This option has expired. ${TX_EFFECT_TEXT['fee-charged']}`)
    const refused = activityRow(entry({ phase: 'failed', effect: 'nothing-sent', error: 'Insufficient token balance for this action.', hash: null }), ON)
    expect(refused.note).toBe(`Insufficient token balance for this action. ${TX_EFFECT_TEXT['nothing-sent']}`)
    expect(refused.hash).toBeNull()
    expect(refused.hashUrl).toBeNull()
  })

  it('offers a second look only for an unknown outcome with a hash', () => {
    const unknown = activityRow(entry({ phase: 'unknown', effect: 'outcome-unknown', ledger: null }), ON)
    expect(unknown.state).toBe('Outcome unknown')
    expect(unknown.tone).toBe('unknown')
    expect(unknown.note).toBe(TX_PHASE_HELP.unknown)
    expect(unknown.canCheck).toBe(true)
    expect(unknown.settled).toBe(false)
    expect(activityRow(entry({ phase: 'unknown', effect: 'outcome-unknown', hash: null }), ON).canCheck).toBe(false)
  })

  it('keeps the explanation of an interrupted transaction', () => {
    const note = 'The page was closed before a ledger confirmed this transaction. It was sent and can still be included. Check again.'
    expect(noteOf(entry({ phase: 'unknown', effect: 'outcome-unknown', error: note }))).toBe(note)
  })

  it('reads a pending transaction as in flight', () => {
    const row = activityRow(entry({ phase: 'pending', effect: 'outcome-unknown', ledger: null }), ON)
    expect(row.state).toBe('Pending')
    expect(row.tone).toBe('working')
    expect(row.note).toBe(TX_PHASE_HELP.pending)
    expect(row.settled).toBe(false)
  })

  it('reads declined and expired as stopped, with what it means', () => {
    const declined = activityRow(entry({ phase: 'declined', effect: 'nothing-sent', hash: null }), ON)
    expect(declined.tone).toBe('stopped')
    expect(declined.note).toBe(TX_PHASE_HELP.declined)
    const expired = activityRow(entry({ phase: 'expired', effect: 'nothing-sent' }), ON)
    expect(expired.tone).toBe('stopped')
    expect(expired.note).toBe(TX_PHASE_HELP.expired)
  })

  it('carries the terms line when the caller gave one', () => {
    expect(activityRow(entry({ detail: 'Strike 99.00 USDx per BOND, deadline 13 Nov 2026, 08:00 UTC' }), ON).terms).toBe('Strike 99.00 USDx per BOND, deadline 13 Nov 2026, 08:00 UTC')
    expect(activityRow(entry(), ON).terms).toBeNull()
  })
})

describe('targetOf', () => {
  it('links an option subject to its position page', () => {
    expect(targetOf({ product: 'covered', action: 'exercise', subject: 'option:12' }, ON)).toEqual({ kind: 'position', id: '12', label: 'Position 12' })
  })

  it('links a request subject to the requests board', () => {
    expect(targetOf({ product: 'covered', action: 'cancel-bid', subject: 'bid:3' }, ON)).toEqual({ kind: 'requests', label: 'Request 3' })
  })

  it('links a new offer and a new request to the list where they appear', () => {
    expect(targetOf({ product: 'covered', action: 'write-offer', subject: null }, ON)).toEqual({ kind: 'offers', label: 'Your offers' })
    expect(targetOf({ product: 'covered', action: 'create-bid', subject: null }, ON)).toEqual({ kind: 'requests', label: 'Your requests' })
  })

  it('links a filled request to the options the filler wrote', () => {
    expect(targetOf({ product: 'covered', action: 'fill-bid', subject: 'bid:3' }, ON)).toEqual({ kind: 'written', label: 'Your written options' })
  })

  it('links a Margin entry to Margin only when the build has it', () => {
    expect(targetOf({ product: 'margin', action: 'margin', subject: null }, ON)).toEqual({ kind: 'margin', label: 'Margin' })
    expect(targetOf({ product: 'margin', action: 'margin', subject: null }, { marginEnabled: false })).toBeNull()
  })

  it('has no link for something it does not know', () => {
    expect(targetOf({ product: 'covered', action: 'other', subject: null }, ON)).toBeNull()
    expect(targetOf({ product: 'covered', action: 'buy', subject: 'option:12; drop' }, ON)).toBeNull()
  })
})

describe('activityRows', () => {
  it('keeps the order it is given and counts what can be cleared', () => {
    const rows = activityRows([entry({ id: 'a', phase: 'pending' }), entry({ id: 'b' }), entry({ id: 'c', phase: 'unknown' }), entry({ id: 'd', phase: 'declined' })], ON)
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(settledCount(rows)).toBe(2)
  })
})

describe('targetOf, for what a transaction created and for issuer actions', () => {
  it('links a confirmed new offer and a filled request to the option they created', () => {
    expect(targetOf({ product: 'covered', action: 'write-offer', subject: null, created: 'option:47' }, ON)).toEqual({ kind: 'position', id: '47', label: 'Position 47' })
    expect(targetOf({ product: 'covered', action: 'fill-bid', subject: 'bid:3', created: 'option:48' }, ON)).toEqual({ kind: 'position', id: '48', label: 'Position 48' })
  })

  it('links a confirmed new request to that request', () => {
    expect(targetOf({ product: 'covered', action: 'create-bid', subject: null, created: 'bid:9' }, ON)).toEqual({ kind: 'requests', label: 'Request 9' })
  })

  it('links an issuer action to the issuer console, whatever it acted on', () => {
    expect(targetOf({ product: 'covered', action: 'issuer-freeze', subject: 'issuer:CASSET:GHOLDER' }, ON)).toEqual({ kind: 'issuer', label: 'Issuer console' })
    expect(targetOf({ product: 'covered', action: 'issuer-clawback', subject: null }, ON)).toEqual({ kind: 'issuer', label: 'Issuer console' })
  })
})
