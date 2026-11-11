import * as ui from '../../../ui'
import { DOMAIN_GLYPHS, Glyph, Logo, Mark, Wordmark } from '../../../ui'
import type { IconComponent, MarkCut, PayoffGlyph } from '../../../ui'
import { Example, Section, Specimen } from '../Specimen'
import styles from '../Gallery.module.css'

const CUTS: { cut: MarkCut; name: string; sizes: number[] }[] = [
  { cut: 'two-ink', name: 'Two inks. The standard cut', sizes: [16, 24, 32, 48, 96] },
  { cut: 'hollow', name: 'One ink, hollow upper part. Stamps and one-colour print', sizes: [16, 24, 32, 48, 96] },
  { cut: 'display', name: 'Display cut, hatched at 45 degrees. 48 px and up', sizes: [48, 96] },
]

const PAYOFFS: { name: PayoffGlyph; word: string }[] = [
  { name: 'long-call', word: 'Long call' },
  { name: 'long-put', word: 'Long put' },
  { name: 'short-call', word: 'Short call' },
  { name: 'short-put', word: 'Short put' },
]

const DOMAIN_WORDS: Record<string, string> = {
  fund: 'Fund',
  bond: 'Bond',
  equity: 'Equity',
  quote: 'Quote token',
  reserve: 'Reserves',
  margin: 'Margin',
  issuer: 'Issuer',
  expiry: 'Deadline',
}

/* Every icon the barrel exports, found by its name, so a new icon shows up here without touching this file. */
const ICONS = Object.entries(ui)
  .filter(([name, value]) => /^Icon[A-Z]/.test(name) && name !== 'IconButton' && typeof value === 'function')
  .map(([name, value]) => ({ name, Icon: value as IconComponent }))
  .sort((a, b) => a.name.localeCompare(b.name))

export function BrandSection() {
  return (
    <Section
      id="brand"
      title="Brand"
      lead="The Counterpart mark is a square sheet cut in two along the payoff line: two parties, one contract. The lower part takes the ink of the page and the upper part the royal ink, so the mark follows the theme."
    >
      <Specimen title="Mark" note="No shield, no star, no rocket. Clear space is half the mark on every side." layout="stack">
        {CUTS.map(({ cut, name, sizes }) => (
          <Example key={cut} label={name}>
            <div className={styles.marks}>
              {sizes.map((size) => (
                <Mark key={size} cut={cut} size={size} />
              ))}
            </div>
          </Example>
        ))}
      </Specimen>

      <Specimen title="Wordmark and lockup" note="Source Serif 4, weight 620, tracking −0.012 em. It is set as text.">
        <Example label="Wordmark">
          <Wordmark className={styles.wordmarkLarge} />
        </Example>
        <Example label="Lockup, 22 px (navigation)">
          <Logo size={22} />
        </Example>
        <Example label="Lockup, 32 px">
          <Logo size={32} />
        </Example>
      </Specimen>

      <Specimen
        title="Payoff glyphs"
        note="14 by 10 box, 1.6 px stroke, round caps. Always next to the word. A short position is the long one mirrored."
      >
        <div className={styles.glyphRow}>
          {PAYOFFS.map(({ name, word }) => (
            <span key={name} className={styles.glyphItem}>
              <Glyph name={name} />
              {word}
            </span>
          ))}
        </div>
        <div className={styles.glyphRow}>
          {PAYOFFS.map(({ name, word }) => (
            <span key={name} className={styles.glyphItem}>
              <Glyph name={name} size={24} />
              <span className="ui-h2">{word}</span>
            </span>
          ))}
        </div>
      </Specimen>

      <Specimen title="Domain glyphs" note="Asset types and the nouns of the product. 24 grid, 1.5 px stroke, square caps: drawn like the rules of a form.">
        <div className={styles.glyphRow}>
          {DOMAIN_GLYPHS.map((name) => (
            <span key={name} className={styles.glyphItem}>
              <Glyph name={name} size={24} />
              <Glyph name={name} size={16} />
              {DOMAIN_WORDS[name]}
            </span>
          ))}
        </div>
      </Specimen>

      <Specimen
        title="Icons"
        note="Phosphor, behind domain names. Regular at 16 px in rows and buttons, Light at 20 px in navigation and callouts. Imported only through src/ui."
      >
        <ul className={styles.iconGrid}>
          {ICONS.map(({ name, Icon }) => (
            <li key={name}>
              <Icon size={16} />
              <Icon size={20} />
              <span>{name.slice(4)}</span>
            </li>
          ))}
        </ul>
      </Specimen>
    </Section>
  )
}
