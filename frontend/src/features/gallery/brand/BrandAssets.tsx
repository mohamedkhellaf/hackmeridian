/**
 * The pictures behind the brand files in `public/`, drawn with the real components so the social card and the
 * icons cannot drift from the design system. `brand.tsx` mounts them; `render.mjs` photographs them.
 */
import { Amount, ContractNote, Logo, Mark, Marker } from '../../../ui'
import styles from './brand.module.css'

/** The 1200 by 630 social card, on the light paper ground. */
export function OgCard() {
  return (
    <div className={styles.card} data-brand-asset="og">
      <header className={styles.cardHead}>
        <Logo size={34} />
        <span className={styles.status}>Stellar Testnet</span>
      </header>
      <div className={styles.cardBody}>
        <div className={styles.pitch}>
          <p className={styles.label}>Options on tokenized assets, on Stellar</p>
          <p className={styles.headline}>
            Set the <Marker band>lowest price</Marker> you would sell at.
          </p>
        </div>
        <ContractNote
          className={styles.note}
          serialLabel="Example"
          serial="note"
          glyph="long-put"
          kind="Long put, BOND"
          terms={[
            { label: 'I hold', value: <Amount value="5.00" unit="BOND" figure="serif" /> },
            { label: 'Floor, per unit', value: <Amount value="10.00" unit="USDx" figure="serif" />, marked: true },
            { label: 'Until', value: '13 Nov 2026, 08:00 UTC' },
            { label: 'Collateral', value: '50.00 USDx in contract' },
          ]}
        />
      </div>
      <footer className={styles.cardFoot}>
        <span>Fictional assets and makers. No real funds. Unaudited.</span>
        <span>Collateral is locked in the contract before you pay.</span>
      </footer>
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
