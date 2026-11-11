import { describe, expect, it } from 'vitest'
import type { AssetFlags } from '../../core/assetfacts/assetFacts'
import { BANNED_WORDS, clawbackShortfallDisclosure, findBannedWords } from '../../core/disclosures'
import type { OptionOffer, OptionState, TokenInfo } from '../../core/options/types'
import { COPY, RESULT_CODE_TEXT, STATE_DETAIL, STATE_LABEL } from './copy'
import {
  accessOf,
  accountExposure,
  actionLabel,
  actionName,
  checkClawbackAmount,
  checkNewAccount,
  classifySubmitError,
  clawbackImpact,
  clawbackPhrase,
  contractRead,
  authorizeIsFinal,
  doneLabel,
  escrowExposure,
  exposureRows,
  flagLimits,
  issuerSubject,
  logRows,
  mergeRows,
  needsDecision,
  openIssuerAction,
  otherIssuedAsset,
  pickAsset,
  parseHolderDocument,
  parseHoldersPage,
  parseIssuerSubject,
  phraseMatches,
  phraseProgress,
  rowActions,
  sentNothing,
  targetKind,
} from './model'
import type { HolderRead } from './model'

const ISSUER = 'GCNWQR5OA24X7LPTCXUEL4V4ZLSIFKUNIEZEO3UVCVXECPPGX7ERFDGM'
const ALICE = 'GAE6ONGU5S3JHDBR5Z3BUVXCL4WLEHQVLBDNTCKHKOYFBYBPBW4IARFS'
const BOB = 'GBPHYE7XMH6GWDVWVTB3V2N55I6GRFAEK6BPWVOH2RGKX3PMNA2VIEEM'
const ESCROW = 'CAIKMS2B4ATWKOKW7BLWQB7Z4JASPZC4EKZ3XL72N7OYSSKKHKW4GKY6'
const BOND_SAC = 'CADCBCQ7TU5XCGPYDD32HANAVEWWDARGKIKXWF5YK7NTFOLAWGQYQGHP'
const USDX_SAC = 'CAKXMQVKSW2AEKF5DSMDPHJAYGNVOQANHXLI64QJS2H3GOCXRW2GCICU'
const BOND = { contractId: BOND_SAC, code: 'BOND', decimals: 7, issuer: ISSUER }
const ALL_ON: AssetFlags = { authRequired: true, authRevocable: true, clawback: true, authImmutable: false }
const U = 10_000_000n // one whole unit at 7 decimals

const read = (state: HolderRead['state'], balance: bigint | null = 5n * U, clawback: boolean | null = true): HolderRead => ({ kind: 'account', state, balance, clawback })

describe('targetKind', () => {
  it('tells accounts from contracts and rejects anything else', () => {
    expect(targetKind(ALICE)).toBe('account')
    expect(targetKind(ESCROW)).toBe('contract')
    expect(targetKind('GABC')).toBeNull()
    expect(targetKind('')).toBeNull()
  })
  it('enforces the checksum', () => {
    expect(targetKind(`${ALICE.slice(0, -1)}A`)).toBeNull()
  })
})

describe('accessOf', () => {
  it('is mock whatever else is true', () => {
    expect(accessOf({ mock: true, address: ISSUER, issuer: ISSUER })).toEqual({ kind: 'mock' })
  })
  it('is guest without a wallet', () => {
    expect(accessOf({ mock: false, address: null, issuer: ISSUER })).toEqual({ kind: 'guest' })
  })
  it('waits while the issuer is being read', () => {
    expect(accessOf({ mock: false, address: ALICE, issuer: undefined })).toEqual({ kind: 'checking' })
  })
  it('recognises the issuer', () => {
    expect(accessOf({ mock: false, address: ISSUER, issuer: ISSUER })).toEqual({ kind: 'issuer', issuer: ISSUER })
  })
  it('says whose account is needed when another wallet is connected', () => {
    expect(accessOf({ mock: false, address: ALICE, issuer: ISSUER })).toEqual({ kind: 'not-issuer', connected: ALICE, issuer: ISSUER })
  })
  it('never grants access when the issuer cannot be known', () => {
    expect(accessOf({ mock: false, address: ALICE, issuer: null })).toEqual({ kind: 'not-issuer', connected: ALICE, issuer: null })
  })
})

describe('accessOf, the unchecked case', () => {
  it('tells a failed check from an account that was checked and does not match', () => {
    expect(accessOf({ mock: false, address: ALICE, issuer: null, checkFailed: true })).toEqual({ kind: 'unchecked', connected: ALICE })
    expect(accessOf({ mock: false, address: ALICE, issuer: null, checkFailed: false })).toEqual({ kind: 'not-issuer', connected: ALICE, issuer: null })
    // A known issuer is never "unchecked".
    expect(accessOf({ mock: false, address: ALICE, issuer: ISSUER, checkFailed: true }).kind).toBe('not-issuer')
  })
})

describe('the asset on screen', () => {
  const RWA = { contractId: USDX_SAC, code: 'RWA', decimals: 7, issuer: ALICE }
  const assets = [BOND, RWA]
  it('opens on the pick, else on the first asset the connected account issues, else the first listed', () => {
    expect(pickAsset(assets, USDX_SAC, null)).toBe(RWA)
    expect(pickAsset(assets, null, ALICE)).toBe(RWA)
    expect(pickAsset(assets, null, BOB)).toBe(BOND)
    expect(pickAsset(assets, 'CNOTLISTED', null)).toBe(BOND)
    expect(pickAsset([], null, ALICE)).toBeNull()
  })
  it('finds another listed asset the connected account issues', () => {
    expect(otherIssuedAsset(assets, BOND, ALICE)).toBe(RWA)
    expect(otherIssuedAsset(assets, RWA, ALICE)).toBeNull()
    expect(otherIssuedAsset(assets, BOND, BOB)).toBeNull()
    expect(otherIssuedAsset(assets, BOND, null)).toBeNull()
  })
})

describe('parseHolderDocument', () => {
  const line = (extra: Record<string, unknown>) => ({ balances: [{ asset_type: 'credit_alphanum4', asset_code: 'BOND', asset_issuer: ISSUER, balance: '12.5000000', ...extra }, { asset_type: 'native', balance: '100.0000000' }] })

  it('reads an authorized trustline with its exact balance', () => {
    expect(parseHolderDocument(line({ is_authorized: true, is_clawback_enabled: true }), BOND, ISSUER, ALICE)).toEqual({
      kind: 'account',
      state: 'authorized',
      balance: 125_000_000n,
      clawback: true,
    })
  })
  it('reads the restricted state (maintain liabilities)', () => {
    const r = parseHolderDocument(line({ is_authorized: false, is_authorized_to_maintain_liabilities: true, is_clawback_enabled: true }), BOND, ISSUER, ALICE)
    expect(r.state).toBe('maintain-only')
  })
  it('reads a trustline that is not authorized', () => {
    const r = parseHolderDocument(line({ is_authorized: false, is_authorized_to_maintain_liabilities: false }), BOND, ISSUER, ALICE)
    expect(r.state).toBe('unauthorized')
    expect(r.clawback).toBe(false)
  })
  it('reads an account without the trustline', () => {
    expect(parseHolderDocument({ balances: [{ asset_type: 'native', balance: '1.0000000' }] }, BOND, ISSUER, ALICE)).toEqual({ kind: 'account', state: 'no-trustline', balance: null, clawback: null })
  })
  it('reads an account that does not exist', () => {
    expect(parseHolderDocument(null, BOND, ISSUER, ALICE).state).toBe('unfunded')
  })
  it('names the issuing account', () => {
    expect(parseHolderDocument({ balances: [] }, BOND, ISSUER, ISSUER).state).toBe('issuer')
  })
  it('does not confuse a same-code asset of another issuer', () => {
    const doc = { balances: [{ asset_code: 'BOND', asset_issuer: ALICE, balance: '9.0000000', is_authorized: true }] }
    expect(parseHolderDocument(doc, BOND, ISSUER, BOB).state).toBe('no-trustline')
  })
  it('keeps every digit of a large balance', () => {
    const r = parseHolderDocument(line({ balance: '922337203685.4775807', is_authorized: true }), BOND, ISSUER, ALICE)
    expect(r.balance).toBe(9_223_372_036_854_775_807n)
  })
})

describe('parseHoldersPage', () => {
  it('turns Horizon records into rows and leaves the issuer and bad ids out', () => {
    const page = {
      _embedded: {
        records: [
          { account_id: ALICE, balances: [{ asset_code: 'BOND', asset_issuer: ISSUER, balance: '1.0000000', is_authorized: true, is_clawback_enabled: true }] },
          { account_id: ISSUER, balances: [] },
          { account_id: 'not-an-id', balances: [] },
          { account_id: BOB, balances: [{ asset_code: 'BOND', asset_issuer: ISSUER, balance: '0.0000000', is_authorized: false }] },
        ],
      },
    }
    const rows = parseHoldersPage(page, BOND, ISSUER)
    expect(rows.map((r) => r.address)).toEqual([ALICE, BOB])
    expect(rows[0].read).toMatchObject({ state: 'authorized', balance: U })
    expect(rows[1].read).toMatchObject({ state: 'unauthorized', balance: 0n })
  })
  it('is empty for anything that is not a page', () => {
    expect(parseHoldersPage(null, BOND, ISSUER)).toEqual([])
    expect(parseHoldersPage({}, BOND, ISSUER)).toEqual([])
  })
})

describe('mergeRows', () => {
  const holders = [
    { address: ALICE, read: read('authorized') },
    { address: BOB, read: read('unauthorized') },
  ]
  it('puts the Covered contract first, then typed addresses, then holders, those that need a decision first', () => {
    const rows = mergeRows({ escrow: ESCROW, added: [USDX_SAC], holders, reads: { [ESCROW]: contractRead(true, 3n * U) } })
    expect(rows.map((r) => [r.address, r.source])).toEqual([
      [ESCROW, 'escrow'],
      [USDX_SAC, 'added'],
      [BOB, 'holder'],
      [ALICE, 'holder'],
    ])
    expect(rows[0]).toMatchObject({ escrow: true, kind: 'contract', read: { state: 'authorized', balance: 3n * U } })
    expect(rows[1].read).toBeUndefined()
  })
  it('lists an address once, at its first place', () => {
    const rows = mergeRows({ escrow: ESCROW, added: [ALICE, ESCROW], holders, reads: {} })
    expect(rows.map((r) => r.address)).toEqual([ESCROW, ALICE, BOB])
    expect(rows[1].source).toBe('added')
  })
  it('sorts the holders: not authorized and restricted first, then a failed read, then the authorized by balance, largest first', () => {
    const C = 'GDY257DGQREP4NLM2DF2YUS5M2VHRW3JNDK2YYHZP55SMW3FMAUHZUVN'
    const D = 'GC7ZMEB7HIPST7PWNQLIG6I5N3VZD3UG7VFOOPCZBJ7JWKCENCEK5NAY'
    const rows = mergeRows({
      escrow: undefined,
      added: [],
      holders: [
        { address: ALICE, read: read('authorized', 1n * U) },
        { address: BOB, read: read('authorized', 9n * U) },
        { address: C, read: read('maintain-only', 1n * U) },
        { address: D, read: read('unknown', null, null) },
        { address: ISSUER, read: read('unauthorized', 0n) },
      ],
      reads: { [ALICE]: read('authorized', 20n * U) },
    })
    expect(rows.map((r) => r.address)).toEqual([C, ISSUER, D, ALICE, BOB])
  })
  it('works without a Covered contract and drops malformed addresses', () => {
    expect(mergeRows({ escrow: undefined, added: ['nope'], holders: [], reads: {} })).toEqual([])
  })
})

describe('needsDecision', () => {
  it('is true for the accounts the issuer has a decision to make about', () => {
    expect(needsDecision({ read: read('unauthorized') })).toBe(true)
    expect(needsDecision({ read: read('maintain-only') })).toBe(true)
    expect(needsDecision({ read: read('authorized') })).toBe(false)
    expect(needsDecision({ read: read('unknown', null, null) })).toBe(false)
    expect(needsDecision({ read: undefined })).toBe(false)
  })
})

describe('checkNewAccount', () => {
  it('accepts an account and a contract, trimmed', () => {
    expect(checkNewAccount(`  ${ALICE} `, [])).toEqual({ ok: true, address: ALICE })
    expect(checkNewAccount(ESCROW, [])).toEqual({ ok: true, address: ESCROW })
  })
  it('refuses anything else with the exact sentence', () => {
    expect(checkNewAccount('GABC', [])).toEqual({ ok: false, error: 'Not an account (G…) or contract (C…) address.' })
  })
  it('refuses an address that is already listed', () => {
    expect(checkNewAccount(ALICE, [ESCROW, ALICE])).toEqual({ ok: false, error: COPY.add.duplicate })
  })
})

describe('rowActions', () => {
  const kinds = (a: ReturnType<typeof rowActions>) => ({ primary: a.primary?.kind ?? null, more: a.more.map((m) => m.kind) })
  it('offers freeze as the button on an authorized account, clawback in the menu, never authorize', () => {
    const a = rowActions({ read: read('authorized') }, ALL_ON, 'BOND')
    expect(a).toEqual({ primary: { kind: 'freeze', enabled: true }, more: [{ kind: 'clawback', enabled: true }], note: null })
  })
  it('offers authorize as the button on an account that is not authorized, never freeze', () => {
    expect(kinds(rowActions({ read: read('unauthorized') }, ALL_ON, 'BOND'))).toEqual({ primary: 'authorize', more: ['clawback'] })
  })
  it('offers authorize as the button and freeze in the menu on a restricted account: two controls at most', () => {
    expect(kinds(rowActions({ read: read('maintain-only') }, ALL_ON, 'BOND'))).toEqual({ primary: 'authorize', more: ['freeze', 'clawback'] })
  })
  it('leaves everything open when the read failed, so the issuer is never locked out', () => {
    expect(kinds(rowActions({ read: read('unknown', null, null) }, ALL_ON, 'BOND'))).toEqual({ primary: 'authorize', more: ['freeze', 'clawback'] })
  })
  it('offers nothing while the first read of the row is running', () => {
    expect(rowActions({ read: undefined }, ALL_ON, 'BOND')).toEqual({ primary: null, more: [], note: null })
  })
  it('offers nothing, with the reason, where there is nothing to act on', () => {
    expect(rowActions({ read: read('no-trustline', null, null) }, ALL_ON, 'BOND')).toEqual({ primary: null, more: [], note: 'This account has no BOND trustline.' })
    expect(rowActions({ read: read('unfunded', null, null) }, ALL_ON, 'BOND').note).toBe(COPY.reasons.unfunded)
    expect(rowActions({ read: read('issuer', null, null) }, ALL_ON, 'BOND').note).toBe(COPY.reasons.issuerRow)
  })
  it('does not offer what the flags rule out for the whole asset', () => {
    expect(kinds(rowActions({ read: read('authorized') }, { ...ALL_ON, authRevocable: false }, 'BOND'))).toEqual({ primary: null, more: ['clawback'] })
    expect(kinds(rowActions({ read: read('authorized') }, { ...ALL_ON, clawback: false }, 'BOND'))).toEqual({ primary: 'freeze', more: [] })
    expect(kinds(rowActions({ read: read('maintain-only') }, { ...ALL_ON, authRevocable: false, clawback: false }, 'BOND'))).toEqual({ primary: 'authorize', more: [] })
  })
  it('does not offer clawback on a trustline it does not apply to, or on a zero balance', () => {
    expect(kinds(rowActions({ read: read('authorized', 5n * U, false) }, ALL_ON, 'BOND')).more).toEqual([])
    expect(kinds(rowActions({ read: read('authorized', 0n) }, ALL_ON, 'BOND')).more).toEqual([])
  })
  it('does not gate on flags that were not read', () => {
    expect(kinds(rowActions({ read: read('authorized') }, null, 'BOND'))).toEqual({ primary: 'freeze', more: ['clawback'] })
  })
  it('keeps what is offered in place and disables it while a transaction is in flight', () => {
    const a = rowActions({ read: read('authorized') }, ALL_ON, 'BOND', COPY.reasons.busy)
    expect(a.primary).toEqual({ kind: 'freeze', enabled: false, reason: COPY.reasons.busy })
    expect(a.more).toEqual([{ kind: 'clawback', enabled: false, reason: COPY.reasons.busy }])
  })
  it('treats a contract like an account', () => {
    expect(kinds(rowActions({ read: contractRead(true, 3n * U) }, ALL_ON, 'BOND'))).toEqual({ primary: 'freeze', more: ['clawback'] })
    expect(kinds(rowActions({ read: contractRead(false, null) }, ALL_ON, 'BOND'))).toEqual({ primary: 'authorize', more: ['clawback'] })
  })
  it('asks before an authorization only when it cannot be undone', () => {
    expect(authorizeIsFinal(ALL_ON)).toBe(false)
    expect(authorizeIsFinal({ ...ALL_ON, authRevocable: false })).toBe(true)
    expect(authorizeIsFinal(null)).toBe(false)
  })
})

describe('flagLimits', () => {
  it('is empty when the issuer can freeze and claw back', () => {
    expect(flagLimits(ALL_ON)).toEqual([])
    // Authorization required does not gate any of the three actions.
    expect(flagLimits({ ...ALL_ON, authRequired: false })).toEqual([])
  })
  it('names each action the flags rule out, once for the whole asset', () => {
    expect(flagLimits({ authRequired: false, authRevocable: false, clawback: false, authImmutable: false })).toEqual([
      'Freeze is not available: Authorization revocable is off.',
      'Claw back is not available: Clawback enabled is off.',
    ])
  })
})

describe('clawback amount and confirmation', () => {
  it('parses the amount exactly and writes it out without grouping', () => {
    expect(checkClawbackAmount('25', 30n * U, BOND)).toEqual({ ok: true, units: 25n * U, text: '25' })
    expect(checkClawbackAmount(' 2.50 ', 30n * U, BOND)).toEqual({ ok: true, units: 25_000_000n, text: '2.5' })
    expect(checkClawbackAmount('1234.5678901', null, BOND)).toEqual({ ok: true, units: 12_345_678_901n, text: '1234.5678901' })
  })
  it('is not an error while the field is empty', () => {
    expect(checkClawbackAmount('', 30n * U, BOND)).toEqual({ ok: false, error: null })
  })
  it('refuses zero, too many decimals and anything that is not a number', () => {
    for (const bad of ['0', '0.0', '1.12345678', 'abc', '-1', '1e3']) {
      expect(checkClawbackAmount(bad, 30n * U, BOND)).toEqual({ ok: false, error: 'Enter an amount above zero with at most 7 decimals.' })
    }
  })
  it('refuses more than the balance, with both figures', () => {
    expect(checkClawbackAmount('30.0000001', 30n * U, BOND)).toEqual({ ok: false, error: 'This balance is 30.00 BOND. Enter 30.00 or less.' })
    expect(checkClawbackAmount('30', 30n * U, BOND).ok).toBe(true)
  })
  it('accepts any positive amount when the balance was not read', () => {
    expect(checkClawbackAmount('1000000', null, BOND).ok).toBe(true)
  })
  it('builds the phrase from the amount, the code and the tail of the account', () => {
    expect(clawbackPhrase('25', 'BOND', ALICE)).toBe('25 BOND ARFS')
    expect(clawbackPhrase('2.5', 'BOND', ESCROW)).toBe('2.5 BOND GKY6')
  })
  it('forgives case and spacing, nothing else', () => {
    expect(phraseMatches('25 bond arfs', '25 BOND ARFS')).toBe(true)
    expect(phraseMatches('  25   BOND  ARFS ', '25 BOND ARFS')).toBe(true)
    expect(phraseMatches('25 BOND ARFX', '25 BOND ARFS')).toBe(false)
    expect(phraseMatches('250 BOND ARFS', '25 BOND ARFS')).toBe(false)
    expect(phraseMatches('25BONDARFS', '25 BOND ARFS')).toBe(false)
    expect(phraseMatches('', '')).toBe(false)
  })
  it('tells typing from a mistake', () => {
    expect(phraseProgress('', '25 BOND ARFS')).toBe('empty')
    expect(phraseProgress('25 bo', '25 BOND ARFS')).toBe('partial')
    expect(phraseProgress('25 bond arfs', '25 BOND ARFS')).toBe('match')
    expect(phraseProgress('26', '25 BOND ARFS')).toBe('mismatch')
    expect(phraseProgress('25 BOND ARFS!', '25 BOND ARFS')).toBe('mismatch')
  })
})

describe('clawbackImpact', () => {
  it('shows no shortfall while the contract still holds what it owes', () => {
    expect(clawbackImpact({ reserved: 20n * U, held: 30n * U }, 10n * U)).toEqual({ reserved: 20n * U, heldNow: 30n * U, heldAfter: 20n * U, short: 0n })
  })
  it('shows the exact shortfall a clawback creates', () => {
    expect(clawbackImpact({ reserved: 30n * U, held: 30n * U }, 5n * U)).toEqual({ reserved: 30n * U, heldNow: 30n * U, heldAfter: 25n * U, short: 5n * U })
  })
  it('adds to a shortfall that already exists', () => {
    expect(clawbackImpact({ reserved: 30n * U, held: 25n * U }, 1n).short).toBe(5n * U + 1n)
  })
  it('never goes below zero held', () => {
    expect(clawbackImpact({ reserved: 30n * U, held: 10n * U }, 99n * U)).toMatchObject({ heldAfter: 0n, short: 30n * U })
  })
})

describe('exposure', () => {
  const token = (contractId: string, code: string): TokenInfo => ({ contractId, code, decimals: 7 })
  const opt = (id: number, state: OptionState, writer: string, holder: string | null, underlying = BOND_SAC): OptionOffer => ({
    id: BigInt(id),
    kind: 'put',
    underlying: token(underlying, 'X'),
    quote: token(USDX_SAC, 'USDx'),
    underlyingQty: U,
    totalStrike: U,
    totalPremium: U,
    expiry: 2_000_000_000,
    writer,
    holder,
    state,
  })
  const options = [
    opt(1, 'offered', ALICE, null),
    opt(2, 'active', ALICE, BOB),
    opt(3, 'active', BOB, ALICE),
    opt(4, 'exercised', ALICE, BOB),
    opt(5, 'expired', ALICE, BOB),
    opt(6, 'settled', ALICE, BOB),
    opt(7, 'reclaimed', ALICE, BOB),
    opt(8, 'cancelled', ALICE, null),
    opt(9, 'active', ALICE, BOB, 'COTHERASSET'),
  ]

  it('counts what is still open on the asset in the contract', () => {
    expect(escrowExposure(options, BOND_SAC)).toEqual({ active: 2, offered: 1, awaiting: 2, total: 5 })
  })
  it('counts every option for the quote token', () => {
    expect(escrowExposure(options, USDX_SAC).total).toBe(6)
  })
  it('counts what one account holds and wrote', () => {
    expect(accountExposure(options, BOND_SAC, ALICE)).toEqual({ holding: 1, written: 4 })
    expect(accountExposure(options, BOND_SAC, BOB)).toEqual({ holding: 1, written: 1 })
    expect(accountExposure(options, BOND_SAC, ISSUER)).toEqual({ holding: 0, written: 0 })
  })
  it('gives what an account has open as rows of the confirmation', () => {
    const row = { escrow: false }
    expect(exposureRows(row, null, { holding: 1, written: 4 })).toEqual([
      { label: 'Open options written', value: 4 },
      { label: 'Active options held', value: 1 },
    ])
    expect(exposureRows(row, null, null)).toBeNull()
  })
  it('gives what the contract has open, with the split', () => {
    const row = { escrow: true }
    expect(exposureRows(row, { active: 2, offered: 1, awaiting: 2, total: 5 }, null)).toEqual([
      { label: 'Open options', value: 5, hint: '2 active, 1 offered, 2 waiting for a claim or a reclaim' },
    ])
    expect(exposureRows(row, { active: 0, offered: 0, awaiting: 0, total: 0 }, null)).toEqual([{ label: 'Open options', value: 0, hint: undefined }])
    expect(exposureRows(row, null, null)).toBeNull()
  })
})

describe('transactions and the log', () => {
  it('labels each action with its figures', () => {
    expect(actionLabel({ kind: 'authorize', asset: BOND, target: ALICE })).toBe('Authorize GAE6…ARFS for BOND')
    expect(actionLabel({ kind: 'freeze', asset: BOND, target: ESCROW })).toBe('Freeze CAIK…GKY6 for BOND')
    expect(actionLabel({ kind: 'clawback', asset: BOND, target: ALICE, units: 25n * U })).toBe('Claw back 25.00 BOND from GAE6…ARFS')
    expect(actionLabel({ kind: 'clawback', asset: BOND, target: ALICE, units: 12_345_678n })).toBe('Claw back 1.2345678 BOND from GAE6…ARFS')
  })
  it('round-trips the subject', () => {
    expect(parseIssuerSubject(issuerSubject(BOND_SAC, ALICE))).toEqual({ assetId: BOND_SAC, target: ALICE })
    expect(parseIssuerSubject('option:12')).toBeNull()
    expect(parseIssuerSubject(null)).toBeNull()
  })
  it('says a confirmed action in one line', () => {
    expect(doneLabel({ kind: 'authorize', asset: BOND, target: ALICE })).toBe('Authorized GAE6…ARFS for BOND.')
    expect(doneLabel({ kind: 'freeze', asset: BOND, target: ESCROW })).toBe('Frozen CAIK…GKY6 for BOND.')
    expect(doneLabel({ kind: 'clawback', asset: BOND, target: ALICE, units: 25n * U })).toBe('Clawed back 25.00 BOND from GAE6…ARFS.')
  })
  const entry = (id: string, action: string, startedAt: number, subject: string | null = issuerSubject(BOND_SAC, ALICE), label = id, phase = 'confirmed') => ({ id, action, label, subject, phase, hash: `h-${id}`, startedAt })
  it('keeps only issuer actions in the log, newest first, capped', () => {
    const rows = logRows([entry('a', actionName('freeze'), 10), entry('b', 'buy', 20, 'option:1'), entry('c', actionName('authorize'), 30), entry('d', actionName('authorize'), 5, null)], null, 2)
    expect(rows.map((r) => r.id)).toEqual(['c', 'a'])
    expect(rows[0]).toEqual({ id: 'c', action: 'Authorize', label: 'c', target: ALICE, phase: 'confirmed', hash: 'h-c', at: 30 })
    expect(logRows([entry('d', actionName('authorize'), 5, null)])[0].target).toBeNull()
  })
  it('names the action without the account, which has its own column, and keeps one asset', () => {
    const claw = entry('c', actionName('clawback'), 30, issuerSubject(BOND_SAC, ALICE), 'Claw back 123.4567891 BOND from GAE6…ARFS')
    const other = entry('o', actionName('freeze'), 40, issuerSubject(USDX_SAC, ALICE), 'Freeze GAE6…ARFS for USDx')
    const rows = logRows([claw, other, entry('f', actionName('freeze'), 20, issuerSubject(BOND_SAC, BOB), 'Freeze GBPH…IEEM for BOND')], BOND_SAC)
    expect(rows.map((r) => [r.action, r.target])).toEqual([
      ['Claw back 123.4567891 BOND', ALICE],
      ['Freeze', BOB],
    ])
  })
  it('finds an issuer action whose outcome is not final, the newest first', () => {
    expect(openIssuerAction([entry('a', actionName('freeze'), 10)])).toBeNull()
    expect(openIssuerAction([entry('b', 'buy', 20, 'option:1', 'b', 'unknown')])).toBeNull()
    expect(openIssuerAction([entry('a', actionName('freeze'), 10, undefined, 'a', 'unknown'), entry('c', actionName('clawback'), 30, undefined, 'c', 'pending')])).toEqual({ id: 'c', unknown: false })
    expect(openIssuerAction([entry('a', actionName('freeze'), 10, undefined, 'a', 'unknown')])).toEqual({ id: 'a', unknown: true })
  })
  it('knows when an attempt sent nothing', () => {
    expect(sentNothing({ phase: 'declined', effect: 'nothing-sent' })).toBe(true)
    expect(sentNothing({ phase: 'failed', effect: 'nothing-sent' })).toBe(true)
    expect(sentNothing({ phase: 'idle', effect: 'nothing-sent' })).toBe(true)
    expect(sentNothing({ phase: 'failed', effect: 'fee-charged' })).toBe(false)
    expect(sentNothing({ phase: 'unknown', effect: 'outcome-unknown' })).toBe(false)
    expect(sentNothing({ phase: 'confirmed', effect: 'fee-charged' })).toBe(false)
    expect(sentNothing({ phase: 'expired', effect: 'nothing-sent' })).toBe(false)
  })
})

describe('classifySubmitError', () => {
  const horizon = (transaction: string, operations?: string[]) => ({ response: { status: 400, data: { extras: { result_codes: { transaction, operations } } } } })

  it('reads tx_failed as included and charged, with the operation reason', () => {
    expect(classifySubmitError(horizon('tx_failed', ['op_cant_revoke']))).toEqual({ kind: 'failed', message: RESULT_CODE_TEXT.op_cant_revoke })
    expect(classifySubmitError(horizon('tx_failed', ['op_not_clawback_enabled']))).toEqual({ kind: 'failed', message: RESULT_CODE_TEXT.op_not_clawback_enabled })
    expect(classifySubmitError(horizon('tx_failed', ['op_no_trust'])).message).toBe('The account has no trustline for this asset.')
  })
  it('reads any other transaction code as refused before a ledger', () => {
    expect(classifySubmitError(horizon('tx_bad_auth'))).toEqual({ kind: 'refused', message: RESULT_CODE_TEXT.tx_bad_auth })
    expect(classifySubmitError(horizon('tx_bad_seq')).kind).toBe('refused')
  })
  it('keeps the raw codes when it does not know them', () => {
    expect(classifySubmitError(horizon('tx_failed', ['op_success', 'op_something_new']))).toEqual({ kind: 'failed', message: 'The network refused the transaction (tx_failed, op_something_new).' })
    expect(classifySubmitError(horizon('tx_internal_error'))).toEqual({ kind: 'refused', message: 'The network refused the transaction (tx_internal_error).' })
  })
  it('reads a timeout or a dropped connection as an unknown outcome, never as a failure', () => {
    expect(classifySubmitError(new Error('Network Error'))).toEqual({ kind: 'unknown', message: COPY.tx.sentNotConfirmed })
    expect(classifySubmitError({ response: { status: 504, data: {} } }).kind).toBe('unknown')
    expect(classifySubmitError(undefined).kind).toBe('unknown')
  })
})

describe('copy', () => {
  const strings: string[] = []
  const collect = (value: unknown): void => {
    if (typeof value === 'string') strings.push(value)
    else if (typeof value === 'function') collect((value as (...args: unknown[]) => unknown)('BOND', 'BOND', 2, 1, 'BOND'))
    else if (Array.isArray(value)) value.forEach(collect)
    else if (value && typeof value === 'object') Object.values(value).forEach(collect)
  }
  collect(COPY)
  collect(STATE_LABEL)
  collect(STATE_DETAIL)
  collect(RESULT_CODE_TEXT)

  it('has the sentence other tests and users rely on, word for word (ruling R24)', () => {
    expect(COPY.mock.sentence).toBe('On mock data there is no asset contract to read and no transaction to sign.')
  })
  it('uses no banned word, em dash, arrow or exclamation mark', () => {
    expect(strings.length).toBeGreaterThan(120)
    for (const s of strings) {
      expect(findBannedWords(s, BANNED_WORDS), s).toEqual([])
      expect(/[—→←!]|->/.test(s), s).toBe(false)
    }
  })
  it('does not retype the clawback shortfall sentence', () => {
    const sentence = clawbackShortfallDisclosure('BOND')
    expect(strings.some((s) => s.includes(sentence) || s.includes('with no refund, and new trades are refused'))).toBe(false)
  })
})
