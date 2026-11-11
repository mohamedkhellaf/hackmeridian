import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAccount, trustlineOf } from './horizon'
import { balancesById, isMockToken, readBalance, readBalances } from './tokens'

// No RPC is contacted here: the SAC balance read is replaced, and Horizon is a stubbed fetch.
vi.mock('./rpc', () => ({
  server: {
    queryContract: vi.fn(async (_id: string, _fn: string, args: { id: string }) => {
      if (args.id.startsWith('GUNFUNDED')) throw new Error('HostError: account entry is missing')
      return { result: 1_234_5670000n }
    }),
  },
}))

const G = (prefix: string) => prefix.padEnd(56, 'A')
const ISSUER = G('GISSUER')
const BOND = { contractId: 'C'.padEnd(56, 'B'), code: 'BOND', issuer: ISSUER }
const horizon = (body: unknown, status = 200) => vi.fn(async () => ({ status, ok: status >= 200 && status < 300, json: async () => body }) as Response)

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readBalances', () => {
  it('never touches the network for mock tokens', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect(isMockToken('C_MOCK_FUND')).toBe(true)
    expect(await readBalances([{ contractId: 'C_MOCK_FUND', code: 'FUND' }], G('GME'))).toEqual([{ contractId: 'C_MOCK_FUND', status: 'mock', balance: null }])
    await expect(readBalance('C_MOCK_FUND', G('GME'))).rejects.toThrow('mock token')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('reads a balance and reports an authorized trustline as ok', async () => {
    vi.stubGlobal('fetch', horizon({ balances: [{ asset_code: 'BOND', asset_issuer: ISSUER, is_authorized: true }] }))
    expect(await readBalances([BOND], G('GME'))).toEqual([{ contractId: BOND.contractId, status: 'ok', balance: 12345670000n }])
  })

  it('detects a frozen or unauthorized trustline now that the token carries its issuer', async () => {
    vi.stubGlobal('fetch', horizon({ balances: [{ asset_code: 'BOND', asset_issuer: ISSUER, is_authorized: false }] }))
    expect((await readBalances([BOND], G('GME')))[0]).toMatchObject({ status: 'not-authorized', balance: 12345670000n })
  })

  it('detects a missing trustline, also for an account Horizon does not know', async () => {
    vi.stubGlobal('fetch', horizon({ balances: [{ asset_type: 'native' }] }))
    expect((await readBalances([BOND], G('GME')))[0]).toEqual({ contractId: BOND.contractId, status: 'no-trustline', balance: null })
    vi.stubGlobal('fetch', horizon({}, 404))
    expect((await readBalances([BOND], G('GME')))[0].status).toBe('no-trustline')
  })

  it('falls back to the plain balance when Horizon fails, and skips Horizon without an issuer', async () => {
    vi.stubGlobal('fetch', horizon({}, 503))
    expect((await readBalances([BOND], G('GME')))[0].status).toBe('ok')
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    expect((await readBalances([{ contractId: BOND.contractId, code: 'BOND' }], G('GME')))[0].status).toBe('ok')
    expect((await readBalances([BOND], ISSUER))[0].status).toBe('ok') // the issuer needs no trustline
    expect(spy).not.toHaveBeenCalled()
  })

  it('reports an unfunded account and rejects a malformed address', async () => {
    vi.stubGlobal('fetch', horizon({}, 404))
    expect((await readBalances([{ contractId: BOND.contractId }], G('GUNFUNDED')))[0]).toEqual({ contractId: BOND.contractId, status: 'unfunded', balance: null })
    expect((await readBalances([{ contractId: BOND.contractId }], 'not-an-address'))[0]).toMatchObject({ status: 'error', error: 'Not a Stellar address' })
  })

  it('indexes balances by token', () => {
    expect(balancesById([{ contractId: 'A', status: 'ok', balance: 1n }])).toEqual({ A: { contractId: 'A', status: 'ok', balance: 1n } })
  })
})

describe('horizon over fetch', () => {
  it('returns null for an unknown account and the balances otherwise', async () => {
    vi.stubGlobal('fetch', horizon({}, 404))
    expect(await fetchAccount(G('GME'))).toBeNull()
    vi.stubGlobal('fetch', horizon({ sequence: '5' }))
    expect(await fetchAccount(G('GME'))).toEqual({ sequence: '5', balances: [] })
    vi.stubGlobal('fetch', horizon({}, 500))
    await expect(fetchAccount(G('GME'))).rejects.toThrow('Horizon 500')
  })
  it('finds a trustline by code and issuer', () => {
    const lines = [{ asset_code: 'BOND', asset_issuer: 'GX' }, { asset_code: 'BOND', asset_issuer: ISSUER, is_authorized: false }]
    expect(trustlineOf(lines, 'BOND', ISSUER)).toEqual(lines[1])
    expect(trustlineOf(lines, 'FUND', ISSUER)).toBeUndefined()
  })
})
