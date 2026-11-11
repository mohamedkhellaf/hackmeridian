/**
 * The pictures behind the brand files in `public/`, drawn with the real components so the social card and the
 * icons cannot drift from the design system. `brand.tsx` mounts them; `render.mjs` photographs them.
 */
import { Amount, ContractNote, Logo, Mark } from '../../../ui'
import styles from './brand.module.css'

/**
 * The 1200 by 630 social card, on the light paper ground: the logo, the landing's label and headline (no marker),
 * and the hero note with the floor the reader would set. No network label, no date, no second tagline.
 */
export function OgCard() {
  return (
    <div className={styles.card} data-brand-asset="og">
      <header className={styles.cardHead}>
        <Logo size={34} />
      </header>
      <div className={styles.cardBody}>
        <div className={styles.pitch}>
          <p className={styles.label}>Options on tokenized assets, on Stellar</p>
          <p className={styles.headline}>Set the lowest price you would sell at.</p>
        </div>
        <ContractNote
          className={styles.note}
          plain
          glyph="long-put"
          kind="Long put, EQTY"
          terms={[
            { label: 'I hold', value: <Amount value="5.00" unit="EQTY" figure="serif" /> },
            { label: 'Floor, per unit', value: <Amount value="10.00" unit="USDx" figure="serif" />, marked: true },
            { label: 'Collateral', value: '50.00 USDx in contract' },
          ]}
        />
      </div>
    </div>
  )
}

/** The mark on a 512 px canvas: on paper for touch and install icons, alone for the PNG favicon. */
export function BrandIcon({ ground }: { ground: 'paper' | 'none' }) {
  return (
    <div className={styles.icon} data-brand-asset="icon" data-ground={ground}>
      <Mark size={ground === 'paper' ? 320 : 480} />
    </div>
  )
}
