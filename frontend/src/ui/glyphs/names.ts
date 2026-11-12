/** The four payoff shapes. Always printed next to the word; the glyph is never the only carrier. */
export type PayoffGlyph = 'long-call' | 'long-put' | 'short-call' | 'short-put'

/** Nouns of the domain. Assets carry no glyph: their code and type are words. */
export type DomainGlyph = 'quote' | 'reserve' | 'margin' | 'issuer' | 'expiry'

export type GlyphName = PayoffGlyph | DomainGlyph

export const PAYOFF_GLYPHS: readonly PayoffGlyph[] = ['long-call', 'long-put', 'short-call', 'short-put']
export const DOMAIN_GLYPHS: readonly DomainGlyph[] = ['quote', 'reserve', 'margin', 'issuer', 'expiry']
