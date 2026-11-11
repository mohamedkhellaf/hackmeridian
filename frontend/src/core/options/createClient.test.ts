import { afterEach, describe, expect, it } from 'vitest'
import { config } from '../config'
import { createOptionsClient, isMockMode, resetMockClient } from './createClient'
import { MockOptionsClient } from './mockClient'

const wallet = { address: null, sign: async (x: string) => x }

afterEach(() => {
  resetMockClient()
})

describe('createOptionsClient', () => {
  it('runs on the mock when the build has no options contract id', async () => {
    expect(config.optionsContractId).toBeUndefined()
    expect(isMockMode()).toBe(true)
    const c = await createOptionsClient(wallet)
    expect(c).toBeInstanceOf(MockOptionsClient)
    expect(c.isMock).toBe(true)
  })

  it('keeps one mock for the session, whatever wallet asks: a second one would wipe the demo state', async () => {
    const a = await createOptionsClient(wallet)
    const b = await createOptionsClient({ address: 'GOTHER', sign: async (x: string) => x })
    expect(b).toBe(a)
    resetMockClient()
    expect(await createOptionsClient(wallet)).not.toBe(a)
  })

  it('opens on the demo market: three assets and offers to trade', async () => {
    const c = await createOptionsClient(wallet)
    const assets = await c.supportedAssets()
    expect(assets.underlyings.map((t) => t.code)).toEqual(['FUND', 'BOND', 'EQTY'])
    const options = await c.listOptions()
    expect(options.filter((o) => o.state === 'offered').length).toBeGreaterThan(50)
    expect((await c.listBids())?.length).toBeGreaterThanOrEqual(3)
    expect(await c.listAsks()).toHaveLength(1)
  })
})
