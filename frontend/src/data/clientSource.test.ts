import { describe, expect, it, vi } from 'vitest'
import { bindSigner, createClientSource } from './clientSource'

describe('createClientSource', () => {
  it('loads once, on the first get, and shares the load', async () => {
    const create = vi.fn(async () => ({ name: 'client' }))
    const src = createClientSource(create)
    expect(create).not.toHaveBeenCalled()
    expect(src.peek()).toBeNull()
    const [a, b] = await Promise.all([src.get(), src.get()])
    expect(a).toBe(b)
    expect(create).toHaveBeenCalledTimes(1)
    expect(src.peek()).toBe(a)
    expect(await src.get()).toBe(a)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failed load: the next get tries again', async () => {
    let fail = true
    const src = createClientSource(async () => {
      if (fail) throw new Error('chunk failed to load')
      return 'client'
    })
    const seen: (string | null)[] = []
    src.subscribe(() => seen.push(src.error()))
    await expect(src.get()).rejects.toThrow('chunk failed to load')
    expect(src.error()).toBe('chunk failed to load')
    expect(src.peek()).toBeNull()
    fail = false
    await expect(src.get()).resolves.toBe('client')
    expect(src.error()).toBeNull()
    expect(src.peek()).toBe('client')
    // Listeners heard the failure, the retry clearing it, and the success.
    expect(seen).toEqual(['chunk failed to load', null, null])
  })

  it('turns a synchronous throw of the factory into a rejection', async () => {
    const src = createClientSource<string>(() => {
      throw new Error('boom')
    })
    await expect(src.get()).rejects.toThrow('boom')
  })
})

describe('bindSigner', () => {
  it('reads the wallet at call time, so one client follows wallet changes', async () => {
    const first = { address: 'GFIRST', sign: vi.fn(async (x: string) => `first:${x}`), signAuthEntry: vi.fn(async (x: string) => `first-auth:${x}`) }
    const second = { address: 'GSECOND', sign: vi.fn(async (x: string) => `second:${x}`), signAuthEntry: vi.fn(async (x: string) => `second-auth:${x}`) }
    const { signer, set } = bindSigner(first)
    expect(signer.address).toBe('GFIRST')
    expect(await signer.sign('xdr')).toBe('first:xdr')
    set(second)
    expect(signer.address).toBe('GSECOND')
    expect(await signer.sign('xdr')).toBe('second:xdr')
    expect(await signer.signAuthEntry('entry')).toBe('second-auth:entry')
    set({ ...second, address: null })
    expect(signer.address).toBeNull()
  })
})
