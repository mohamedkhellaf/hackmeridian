import { Asset, Networks, StrKey } from '@stellar/stellar-sdk'
import { describe, expect, it } from 'vitest'
import {
  ASSET_LIST_NOTE,
  ASSET_TIERS,
  ASSET_TYPE_LABEL,
  assetKey,
  assetParam,
  assetPath,
  codeResemblance,
  defaultReferenceAsset,
  findReferenceAsset,
  findReferenceBySlug,
  isAccountId,
  isContractId,
  isReferenceAsset,
  MOCK_ISSUER,
  MOCK_QUOTE_ISSUER,
  parseAssetParam,
  QUOTE_ASSETS,
  REFERENCE_ASSETS,
  referenceAssets,
  resolveAssetParam,
  similarCodeFlag,
  skeleton,
  TIER_MEANING,
  tierOf,
} from './index'
import type { AssetNetwork, ListedAsset } from './index'
import { BANNED_WORDS, findBannedWords } from '../disclosures'

const NETWORKS: AssetNetwork[] = ['mock', 'testnet']
const TESTNET_ISSUER = 'GCNWQR5OA24X7LPTCXUEL4V4ZLSIFKUNIEZEO3UVCVXECPPGX7ERFDGM'
const RWA = 'CCVYWYG56YL7VA7A3EKVJKAKZC4O2B6YXV6UJMERG2NYC7HJHELJLR7U'
const BOND = 'CADCBCQ7TU5XCGPYDD32HANAVEWWDARGKIKXWF5YK7NTFOLAWGQYQGHP'
const EQTY = 'CDBHRGVHB2NVKJCM5ZKBTUQ3RQHZUZJSSEZLATIUROWXNIEFZ7T7NIFU'

// A second issuer and its BOND, as an open listing would produce (valid keys, not on any network).
const OTHER_ISSUER = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 7))
const OTHER_BOND = new Asset('BOND', OTHER_ISSUER).contractId(Networks.TESTNET)

describe('reference list', () => {
  it('lists FUND, BOND, EQTY for the mock and RWA, BOND, EQTY for Testnet, in that order', () => {
    expect(referenceAssets('mock').map((a) => a.code)).toEqual(['FUND', 'BOND', 'EQTY'])
    expect(referenceAssets('testnet').map((a) => a.code)).toEqual(['RWA', 'BOND', 'EQTY'])
    expect(referenceAssets('mock').map((a) => a.slug)).toEqual(['fund', 'bond', 'eqty'])
    expect(referenceAssets('testnet').map((a) => a.slug)).toEqual(['rwa', 'bond', 'eqty'])
    expect(defaultReferenceAsset('mock').code).toBe('FUND')
    expect(defaultReferenceAsset('testnet').code).toBe('RWA')
    for (const n of NETWORKS) expect(referenceAssets(n)).toBe(REFERENCE_ASSETS[n])
  })

  it('carries the type label of each asset', () => {
    expect(ASSET_TYPE_LABEL).toEqual({ fund: 'Fund share', bond: 'Bond', equity: 'Equity' })
    expect(referenceAssets('testnet').map((a) => a.typeLabel)).toEqual(['Fund share', 'Bond', 'Equity'])
    expect(referenceAssets('mock').map((a) => a.typeLabel)).toEqual(['Fund share', 'Bond', 'Equity'])
    for (const n of NETWORKS) for (const a of referenceAssets(n)) expect(a.typeLabel).toBe(ASSET_TYPE_LABEL[a.type])
  })

  it('uses the deployed Testnet ids', () => {
    const byCode = Object.fromEntries(referenceAssets('testnet').map((a) => [a.code, a]))
    expect(byCode.RWA.contractId).toBe(RWA)
    expect(byCode.BOND.contractId).toBe(BOND)
    expect(byCode.EQTY.contractId).toBe(EQTY)
    for (const a of referenceAssets('testnet')) expect(a.issuer).toBe(TESTNET_ISSUER)
    expect(QUOTE_ASSETS.testnet).toMatchObject({
      code: 'USDx',
      issuer: 'GAE6ONGU5S3JHDBR5Z3BUVXCL4WLEHQVLBDNTCKHKOYFBYBPBW4IARFS',
      contractId: 'CAKXMQVKSW2AEKF5DSMDPHJAYGNVOQANHXLI64QJS2H3GOCXRW2GCICU',
      decimals: 7,
    })
  })

  it('has Testnet contract ids that are exactly the asset contracts of code and issuer', () => {
    for (const a of [...referenceAssets('testnet'), QUOTE_ASSETS.testnet]) {
      expect(new Asset(a.code, a.issuer).contractId(Networks.TESTNET), a.code).toBe(a.contractId)
      expect(isAccountId(a.issuer)).toBe(true)
      expect(isContractId(a.contractId)).toBe(true)
    }
  })

  it('uses mock placeholders that can never be mistaken for real ids', () => {
    expect(referenceAssets('mock').map((a) => a.contractId)).toEqual(['C_MOCK_FUND', 'C_MOCK_BOND', 'C_MOCK_EQTY'])
    expect(QUOTE_ASSETS.mock.contractId).toBe('C_MOCK_USDX')
    for (const g of [MOCK_ISSUER, MOCK_QUOTE_ISSUER]) {
      expect(g).toHaveLength(56)
      expect(g.startsWith('GMOCK')).toBe(true)
      expect(isAccountId(g)).toBe(false)
      expect(StrKey.isValidEd25519PublicKey(g)).toBe(false)
    }
    for (const a of referenceAssets('mock')) expect(isContractId(a.contractId)).toBe(false)
  })

  it('has unique keys and slugs, 7 decimals and URL-safe slugs', () => {
    const all = NETWORKS.flatMap((n) => [...referenceAssets(n)])
    expect(new Set(all.map((a) => a.contractId)).size).toBe(all.length)
    for (const n of NETWORKS) {
      const list = referenceAssets(n)
      expect(new Set(list.map((a) => a.slug)).size).toBe(list.length)
      for (const a of list) {
        expect(a.network).toBe(n)
        expect(a.decimals).toBe(7)
        expect(a.slug).toMatch(/^[a-z0-9-]{2,24}$/)
        expect(a.code).toMatch(/^[A-Za-z0-9]{1,12}$/)
        expect(a.contractId).not.toBe(QUOTE_ASSETS[n].contractId)
      }
    }
  })

  it('finds entries by contract id and by slug', () => {
    expect(findReferenceAsset(BOND)?.code).toBe('BOND')
    expect(findReferenceAsset(BOND)?.network).toBe('testnet')
    expect(findReferenceAsset('C_MOCK_BOND')?.network).toBe('mock')
    expect(findReferenceAsset(OTHER_BOND)).toBeNull()
    expect(findReferenceAsset('BOND')).toBeNull() // a code is not a key
    expect(findReferenceAsset(QUOTE_ASSETS.testnet.contractId)).toBeNull()
    expect(isReferenceAsset(RWA)).toBe(true)
    expect(isReferenceAsset(OTHER_BOND)).toBe(false)
    expect(findReferenceBySlug('testnet', 'bond')?.contractId).toBe(BOND)
    expect(findReferenceBySlug('testnet', 'BOND')?.contractId).toBe(BOND)
    expect(findReferenceBySlug('mock', 'bond')?.contractId).toBe('C_MOCK_BOND')
    expect(findReferenceBySlug('testnet', 'fund')).toBeNull()
    expect(findReferenceBySlug('mock', 'rwa')).toBeNull()
  })
})

describe('StrKey checks', () => {
  it('agrees with the SDK on valid keys of both kinds', () => {
    for (let i = 0; i < 300; i++) {
      const raw = Buffer.from(Array.from({ length: 32 }, (_, j) => (i * 131 + j * 17 + ((i * j) % 251)) & 0xff))
      const g = StrKey.encodeEd25519PublicKey(raw)
      const c = StrKey.encodeContract(raw)
      expect(isAccountId(g)).toBe(true)
      expect(isContractId(c)).toBe(true)
      expect(isAccountId(c)).toBe(false)
      expect(isContractId(g)).toBe(false)
    }
  })

  it('rejects a key with one character changed, as the SDK does', () => {
    const g = TESTNET_ISSUER
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    for (let pos = 1; pos < g.length; pos += 5) {
      for (const ch of [alphabet[(alphabet.indexOf(g[pos]) + 1) % 32], alphabet[(alphabet.indexOf(g[pos]) + 13) % 32]]) {
        const bad = g.slice(0, pos) + ch + g.slice(pos + 1)
        expect(isAccountId(bad), bad).toBe(StrKey.isValidEd25519PublicKey(bad))
        expect(isAccountId(bad), bad).toBe(false)
      }
    }
  })

  it('rejects other kinds of key and malformed text', () => {
    const raw = Buffer.alloc(32, 9)
    expect(isAccountId(StrKey.encodeEd25519SecretSeed(raw))).toBe(false) // S...
    expect(isContractId(StrKey.encodeEd25519SecretSeed(raw))).toBe(false)
    expect(isAccountId(StrKey.encodePreAuthTx(raw))).toBe(false) // T...
    for (const bad of ['', 'G', TESTNET_ISSUER.slice(0, 55), `${TESTNET_ISSUER}A`, TESTNET_ISSUER.toLowerCase(), `${TESTNET_ISSUER.slice(0, 55)}1`, ' '.repeat(56), 'C_MOCK_BOND']) {
      expect(isAccountId(bad), bad).toBe(false)
      expect(isContractId(bad), bad).toBe(false)
    }
  })
})

describe('tiers', () => {
  it('uses three words and explains each', () => {
    expect(ASSET_TIERS).toEqual(['Reference', 'Domain-linked', 'No domain link'])
    for (const t of ASSET_TIERS) {
      expect(TIER_MEANING[t]).toMatch(/^[A-Z].*\.$/)
      expect(findBannedWords(TIER_MEANING[t])).toEqual([])
      expect(TIER_MEANING[t].toLowerCase()).not.toContain('verified')
    }
    expect(findBannedWords(ASSET_LIST_NOTE)).toEqual([])
    expect(BANNED_WORDS.length).toBeGreaterThan(0)
  })

  it('gives Reference only to assets in the list', () => {
    expect(tierOf({ contractId: BOND })).toBe('Reference')
    expect(tierOf({ contractId: 'C_MOCK_FUND' })).toBe('Reference')
    expect(tierOf({ contractId: OTHER_BOND })).toBe('No domain link')
    expect(tierOf({ contractId: OTHER_BOND }, { domainLinked: true })).toBe('Domain-linked')
    expect(tierOf({ contractId: OTHER_BOND }, { domainLinked: false })).toBe('No domain link')
    expect(tierOf({ contractId: BOND }, { domainLinked: false })).toBe('Reference')
  })

  it('keys an asset by its contract id', () => {
    expect(assetKey({ contractId: BOND })).toBe(BOND)
    expect(assetKey(referenceAssets('mock')[0])).toBe('C_MOCK_FUND')
    expect(assetKey({ contractId: OTHER_BOND })).not.toBe(assetKey({ contractId: BOND })) // same code, two assets
  })
})

describe('parseAssetParam', () => {
  it('reads a slug, in any case', () => {
    expect(parseAssetParam('bond')).toEqual({ form: 'slug', slug: 'bond' })
    expect(parseAssetParam('BOND')).toEqual({ form: 'slug', slug: 'bond' })
    expect(parseAssetParam('us-500x', 'mock')).toEqual({ form: 'slug', slug: 'us-500x' })
  })

  it('reads CODE-ISSUER with a checksum on Testnet', () => {
    expect(parseAssetParam(`BOND-${TESTNET_ISSUER}`)).toEqual({ form: 'code-issuer', code: 'BOND', issuer: TESTNET_ISSUER })
    expect(parseAssetParam(`Bond-${OTHER_ISSUER}`)).toEqual({ form: 'code-issuer', code: 'Bond', issuer: OTHER_ISSUER }) // code keeps its case
    const badChecksum = `${TESTNET_ISSUER.slice(0, 55)}A`
    expect(parseAssetParam(`BOND-${badChecksum}`)).toBeNull()
    expect(parseAssetParam(`BOND-${MOCK_ISSUER}`)).toBeNull()
    expect(parseAssetParam(`TOOLONGCODE12-${TESTNET_ISSUER}`)).toBeNull()
    expect(parseAssetParam(`-${TESTNET_ISSUER}`)).toBeNull()
    expect(parseAssetParam(`BOND-${BOND}`)).toBeNull() // a contract id is not an issuer
  })

  it('reads a contract id with a checksum on Testnet', () => {
    expect(parseAssetParam(BOND)).toEqual({ form: 'contract', contractId: BOND })
    expect(parseAssetParam(OTHER_BOND)).toEqual({ form: 'contract', contractId: OTHER_BOND })
    expect(parseAssetParam(`${BOND.slice(0, 55)}A`)).toBeNull()
    expect(parseAssetParam(BOND.toLowerCase())).toBeNull()
    expect(parseAssetParam('C_MOCK_BOND')).toBeNull()
  })

  it('accepts placeholders on the mock network only', () => {
    expect(parseAssetParam('C_MOCK_BOND', 'mock')).toEqual({ form: 'contract', contractId: 'C_MOCK_BOND' })
    expect(parseAssetParam('C_FIXTURE_BOND_TWIN_ISSUER', 'mock')).toEqual({ form: 'contract', contractId: 'C_FIXTURE_BOND_TWIN_ISSUER' })
    expect(parseAssetParam(`BOND-${MOCK_ISSUER}`, 'mock')).toEqual({ form: 'code-issuer', code: 'BOND', issuer: MOCK_ISSUER })
    expect(parseAssetParam(`${BOND.slice(0, 55)}A`, 'mock')).toEqual({ form: 'contract', contractId: `${BOND.slice(0, 55)}A` })
    expect(parseAssetParam('c_mock_bond', 'mock')).toBeNull()
  })

  it('rejects everything else', () => {
    for (const bad of [
      '',
      'b',
      'bond/..',
      'bond?x=1',
      '<script>',
      'bond%20',
      'bo nd',
      'a'.repeat(25),
      'a'.repeat(200),
      `BOND:${TESTNET_ISSUER}`,
      `BOND-${TESTNET_ISSUER}-extra`,
      'javascript:alert(1)',
      '../../etc',
      'bönd',
    ]) {
      expect(parseAssetParam(bad), bad).toBeNull()
      expect(parseAssetParam(bad, 'mock'), bad).toBeNull()
    }
    expect(parseAssetParam(undefined as unknown as string)).toBeNull()
  })
})

describe('assetParam and assetPath', () => {
  it('uses the slug for a reference asset, whatever else is known', () => {
    expect(assetPath({ contractId: BOND, code: 'BOND' })).toBe('/markets/bond')
    expect(assetPath({ contractId: BOND, code: 'BOND', issuer: TESTNET_ISSUER })).toBe('/markets/bond')
    expect(assetPath({ contractId: RWA, code: 'RWA' })).toBe('/markets/rwa')
    expect(assetPath({ contractId: 'C_MOCK_FUND', code: 'FUND' })).toBe('/markets/fund')
    expect(assetPath(referenceAssets('testnet')[2])).toBe('/markets/eqty')
  })

  it('uses CODE-ISSUER for any other asset with a known issuer, else the contract id', () => {
    expect(assetPath({ contractId: OTHER_BOND, code: 'BOND', issuer: OTHER_ISSUER })).toBe(`/markets/BOND-${OTHER_ISSUER}`)
    expect(assetPath({ contractId: OTHER_BOND, code: 'BOND' })).toBe(`/markets/${OTHER_BOND}`)
    expect(assetPath({ contractId: OTHER_BOND, code: 'BOND', issuer: null })).toBe(`/markets/${OTHER_BOND}`)
    expect(assetParam({ contractId: OTHER_BOND, code: 'BOND', issuer: OTHER_ISSUER })).toBe(`BOND-${OTHER_ISSUER}`)
  })

  it('never gives a look-alike the slug of the reference asset', () => {
    expect(assetPath({ contractId: OTHER_BOND, code: 'BOND', issuer: OTHER_ISSUER })).not.toBe('/markets/bond')
  })

  it('produces segments that parse back to the same asset', () => {
    const listed: ListedAsset[] = [
      ...referenceAssets('testnet'),
      { contractId: OTHER_BOND, code: 'BOND', issuer: OTHER_ISSUER },
      { contractId: StrKey.encodeContract(Buffer.alloc(32, 3)), code: 'WASM' },
    ]
    for (const a of listed) {
      const r = resolveAssetParam(assetParam(a), 'testnet', listed)
      expect(r).toMatchObject({ status: 'found', contractId: a.contractId, isCanonical: true })
    }
  })
})

describe('resolveAssetParam', () => {
  const other: ListedAsset = { contractId: OTHER_BOND, code: 'BOND', issuer: OTHER_ISSUER }
  const listed: ListedAsset[] = [...referenceAssets('testnet'), other]

  it('resolves a slug to the reference asset', () => {
    expect(resolveAssetParam('bond', 'testnet')).toEqual({
      status: 'found',
      contractId: BOND,
      reference: findReferenceAsset(BOND),
      canonical: 'bond',
      isCanonical: true,
    })
    expect(resolveAssetParam('fund', 'mock')).toMatchObject({ status: 'found', contractId: 'C_MOCK_FUND', canonical: 'fund' })
  })

  it('marks aliases of a reference asset as not canonical', () => {
    expect(resolveAssetParam('BOND', 'testnet')).toMatchObject({ status: 'found', contractId: BOND, canonical: 'bond', isCanonical: false })
    expect(resolveAssetParam(BOND, 'testnet')).toMatchObject({ status: 'found', contractId: BOND, canonical: 'bond', isCanonical: false })
    expect(resolveAssetParam(`BOND-${TESTNET_ISSUER}`, 'testnet')).toMatchObject({ status: 'found', contractId: BOND, canonical: 'bond', isCanonical: false })
    expect(resolveAssetParam('C_MOCK_BOND', 'mock')).toMatchObject({ status: 'found', contractId: 'C_MOCK_BOND', canonical: 'bond', isCanonical: false })
    expect(resolveAssetParam(`BOND-${MOCK_ISSUER}`, 'mock')).toMatchObject({ status: 'found', contractId: 'C_MOCK_BOND', canonical: 'bond', isCanonical: false })
  })

  it('resolves another listed asset by CODE-ISSUER or contract id, never by its code', () => {
    expect(resolveAssetParam(`BOND-${OTHER_ISSUER}`, 'testnet', listed)).toEqual({
      status: 'found',
      contractId: OTHER_BOND,
      reference: null,
      canonical: `BOND-${OTHER_ISSUER}`,
      isCanonical: true,
    })
    expect(resolveAssetParam(OTHER_BOND, 'testnet', listed)).toMatchObject({
      status: 'found',
      contractId: OTHER_BOND,
      reference: null,
      canonical: `BOND-${OTHER_ISSUER}`,
      isCanonical: false,
    })
    // the code part is case-sensitive: `bond-G...` is a different asset code
    expect(resolveAssetParam(`bond-${OTHER_ISSUER}`, 'testnet', listed)).toMatchObject({ status: 'unknown' })
  })

  it('keeps the contract id as the canonical form when the issuer is not known', () => {
    expect(resolveAssetParam(OTHER_BOND, 'testnet', [{ contractId: OTHER_BOND, code: 'BOND' }])).toMatchObject({
      status: 'found',
      canonical: OTHER_BOND,
      isCanonical: true,
    })
  })

  it('reports a well-formed but unknown asset with its parsed form', () => {
    expect(resolveAssetParam('gold', 'testnet', listed)).toEqual({ status: 'unknown', param: { form: 'slug', slug: 'gold' } })
    expect(resolveAssetParam(OTHER_BOND, 'testnet')).toEqual({ status: 'unknown', param: { form: 'contract', contractId: OTHER_BOND } })
    expect(resolveAssetParam(`GOLD-${OTHER_ISSUER}`, 'testnet', listed)).toEqual({
      status: 'unknown',
      param: { form: 'code-issuer', code: 'GOLD', issuer: OTHER_ISSUER },
    })
  })

  it('does not resolve a reference asset of the other network', () => {
    expect(resolveAssetParam('rwa', 'mock')).toMatchObject({ status: 'unknown' })
    expect(resolveAssetParam('fund', 'testnet')).toMatchObject({ status: 'unknown' })
    expect(resolveAssetParam(BOND, 'mock')).toMatchObject({ status: 'unknown' })
    expect(resolveAssetParam('C_MOCK_BOND', 'testnet')).toEqual({ status: 'invalid' })
  })

  it('reports malformed input as invalid', () => {
    expect(resolveAssetParam('', 'testnet')).toEqual({ status: 'invalid' })
    expect(resolveAssetParam('<img src=x>', 'testnet')).toEqual({ status: 'invalid' })
    expect(resolveAssetParam(`${BOND.slice(0, 55)}A`, 'testnet')).toEqual({ status: 'invalid' })
  })
})

describe('similar codes', () => {
  it('folds confusable characters', () => {
    expect(skeleton('BOND')).toBe('bond')
    expect(skeleton('B0ND')).toBe('bond')
    expect(skeleton('8OND')).toBe('bond')
    expect(skeleton('U5Dx')).toBe('usdx')
    expect(skeleton('RVVA')).toBe('rwa')
    expect(skeleton('RNA')).toBe('ma')
    expect(skeleton('I1|')).toBe('lll')
    expect(skeleton('2')).toBe('z')
  })

  // The 17 cases of the research corpus (gap-open-listing-abuse, fixtures/hostile-strings.json, "codes").
  it.each([
    ['BOND', 'BOND', 'same'],
    ['Bond', 'BOND', 'same'],
    ['B0ND', 'BOND', 'same'],
    ['8OND', 'BOND', 'same'],
    ['BONDS', 'BOND', 'near'],
    ['xBOND', 'BOND', 'near'],
    ['BOND2', 'BOND', 'near'],
    ['BONO', 'BOND', 'near'],
    ['USDX', 'USDx', 'same'],
    ['U5Dx', 'USDx', 'same'],
    ['RVVA', 'RWA', 'same'],
    ['RWA1', 'RWA', 'near'],
    ['EQTY', 'BOND', null],
    ['EQTV', 'EQTY', 'near'],
    ['E0TY', 'EQTY', 'near'],
    ['GOLD', 'BOND', null],
    ['ABOND12345', 'BOND', null],
  ] as const)('%s against %s is %s', (code, ref, expected) => {
    expect(codeResemblance(code, ref)).toBe(expected)
  })

  it('does not call short unrelated codes near', () => {
    expect(codeResemblance('RWB', 'RWA')).toBeNull() // one edit, but the reference has only 3 characters
    expect(codeResemblance('FUND', 'BOND')).toBeNull()
    expect(codeResemblance('BO', 'BOND')).toBeNull()
    expect(codeResemblance('', 'BOND')).toBeNull()
  })

  it('never flags a reference asset or the quote token itself', () => {
    for (const n of NETWORKS) {
      for (const a of referenceAssets(n)) expect(similarCodeFlag(a, n)).toBeNull()
      expect(similarCodeFlag(QUOTE_ASSETS[n], n)).toBeNull()
    }
  })

  it('flags a same-code asset from another issuer', () => {
    expect(similarCodeFlag({ code: 'BOND', contractId: OTHER_BOND }, 'testnet')).toEqual({ reference: 'BOND', level: 'same' })
    expect(similarCodeFlag({ code: 'B0ND', contractId: OTHER_BOND }, 'testnet')).toEqual({ reference: 'BOND', level: 'same' })
    expect(similarCodeFlag({ code: 'USDX', contractId: OTHER_BOND }, 'testnet')).toEqual({ reference: 'USDx', level: 'same' })
    expect(similarCodeFlag({ code: 'FUND', contractId: 'C_FIXTURE_FUND_TWIN' }, 'mock')).toEqual({ reference: 'FUND', level: 'same' })
  })

  it('flags near codes, and prefers an exact resemblance over a near one', () => {
    expect(similarCodeFlag({ code: 'BONDS', contractId: OTHER_BOND }, 'testnet')).toEqual({ reference: 'BOND', level: 'near' })
    expect(similarCodeFlag({ code: 'RWA1', contractId: OTHER_BOND }, 'testnet')).toEqual({ reference: 'RWA', level: 'near' })
    expect(similarCodeFlag({ code: 'EQTV', contractId: OTHER_BOND }, 'testnet')).toEqual({ reference: 'EQTY', level: 'near' })
    expect(similarCodeFlag({ code: 'GOLD', contractId: OTHER_BOND }, 'testnet')).toBeNull()
    expect(similarCodeFlag({ code: 'WASM', contractId: OTHER_BOND }, 'testnet')).toBeNull()
  })

  it('compares against the codes of its own network', () => {
    expect(similarCodeFlag({ code: 'RWA', contractId: 'C_FIXTURE_RWA' }, 'mock')).toBeNull() // RWA is not a mock reference code
    expect(similarCodeFlag({ code: 'FUND', contractId: OTHER_BOND }, 'testnet')).toBeNull()
  })
})
