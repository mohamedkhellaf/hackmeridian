import { describe, expect, it } from 'vitest'
import { config } from '../config'
import { FIXTURE_DEFAULT_PARTY, createProClient, isProSimulated } from './createClient'
import { FixtureProClient } from './FixtureProClient'

describe('createProClient', () => {
  it('replays fixtures when the build has no Margin contract id, and says so', async () => {
    expect(config.proContractId).toBeUndefined()
    expect(isProSimulated()).toBe(true)
    const h = await createProClient()
    expect(h.simulated).toBe(true)
    expect(h.live).toBeNull()
    expect(h.sim).toBeInstanceOf(FixtureProClient)
    expect(h.client).toBe(h.sim)
    expect(h.client.kind).toBe('fixture')
    expect(h.sim?.parties).toContain(FIXTURE_DEFAULT_PARTY)
  })

  it('reports the checking stage of a replayed call and no hash, since nothing is sent', async () => {
    const { client } = await createProClient()
    const stages: string[] = []
    const r = await client.exercise('NOBODY', 999, { onStage: (s) => stages.push(s.stage) })
    expect(stages).toEqual(['checking'])
    expect(r).toMatchObject({ ok: false, code: 0 })
  })
})
