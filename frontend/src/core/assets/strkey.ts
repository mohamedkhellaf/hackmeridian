// StrKey shape and checksum for Stellar account ids (`G...`) and contract ids (`C...`), without the Stellar SDK:
// this module is used to validate URL segments before anything heavier is loaded.
//
// A StrKey is base32 (RFC 4648 alphabet, no padding) of: one version byte, a 32-byte payload and a CRC16-XModem
// checksum of those 33 bytes, little-endian. 35 bytes give exactly 56 characters.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

const VERSION_ACCOUNT = 6 << 3 // 'G'
const VERSION_CONTRACT = 2 << 3 // 'C'

function decodeBase32(text: string): Uint8Array | null {
  if (text.length !== 56) return null
  const out = new Uint8Array(35)
  let bits = 0
  let value = 0
  let n = 0
  for (const ch of text) {
    const v = ALPHABET.indexOf(ch)
    if (v < 0) return null
    value = (value << 5) | v
    bits += 5
    if (bits >= 8) {
      bits -= 8
      out[n++] = (value >>> bits) & 0xff
      value &= (1 << bits) - 1
    }
  }
  return n === 35 && bits === 0 ? out : null
}

function crc16(bytes: Uint8Array): number {
  let crc = 0
  for (const byte of bytes) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc
}

function isStrKey(text: string, version: number): boolean {
  const raw = decodeBase32(text)
  if (!raw || raw[0] !== version) return false
  const crc = crc16(raw.subarray(0, 33))
  return raw[33] === (crc & 0xff) && raw[34] === crc >>> 8
}

/** True for a well-formed account id: 56 characters, starts with `G`, valid checksum. */
export const isAccountId = (text: string): boolean => isStrKey(text, VERSION_ACCOUNT)

/** True for a well-formed contract id: 56 characters, starts with `C`, valid checksum. */
export const isContractId = (text: string): boolean => isStrKey(text, VERSION_CONTRACT)
