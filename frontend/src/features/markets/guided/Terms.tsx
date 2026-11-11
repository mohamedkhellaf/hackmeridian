import type { ReactNode } from 'react'
import { AmountField, ChoiceChips, Marker } from '../../../ui'

import styles from './Terms.module.css'
import type { ChoiceChip } from '../../../ui'

export interface TermsProps {
  /** The quantity field. */
  qty: {
    label: string
    text: string
    unit: string
    decimals: number
    onChange: (text: string) => void
    onMax?: () => void
    maxLabel?: string
    /** The wallet balance, right of the label. */
    aside?: ReactNode
    hint?: ReactNode
    error?: ReactNode
  }
  strike: {
    label: string
    /** The chosen strike as a figure and its unit. */
    figure: string
    unit: string
    /** Where it stands against the reference, in words. */
    hint?: string
    chipsLabel: string
    /** The reference price with its label and note. */
    reference: ReactNode
    chips: readonly ChoiceChip[]
    value: string | null
    onChange: (value: string) => void
  }
  expiry: {
    label: string
    /** `20 Nov`, `08:00 UTC`, and the machine-readable instant. */
    day: string
    time: string
    iso: string
    hint?: string
    chipsLabel: string
    chips: readonly ChoiceChip[]
    value: string | null
    onChange: (value: string) => void
  }
  legend: string
}

/**
 * The three plain inputs of the contract note (brief 4.3): a quantity, a price per unit and a deadline. The top
 * row states them as three figures, as on the landing note; the two rows of chips under it change the price and
 * the date.
 */
export function Terms({ qty, strike, expiry, legend }: TermsProps) {
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <AmountField
          className={styles.qty}
          label={qty.label}
          value={qty.text}
          onValueChange={qty.onChange}
          unit={qty.unit}
          decimals={qty.decimals}
          onMax={qty.onMax}
          maxLabel={qty.maxLabel}
          aside={qty.aside}
          hint={qty.hint}
          error={qty.error}
        />
        <dl className={styles.figures}>
          <div className={styles.figure}>
            <dt>{strike.label}</dt>
            <dd>
              <span className={styles.value} data-testid="guided-strike">
                <Marker>{strike.figure}</Marker> <span className={styles.unit}>{strike.unit}</span>
              </span>
              {strike.hint ? <span className={styles.hint}>{strike.hint}</span> : null}
            </dd>
          </div>
          <div className={styles.figure}>
            <dt>{expiry.label}</dt>
            <dd>
              <time className={styles.value} dateTime={expiry.iso} data-testid="guided-expiry">
                {expiry.day} <span className={styles.unit}>{expiry.time}</span>
              </time>
              {expiry.hint ? <span className={styles.hint}>{expiry.hint}</span> : null}
            </dd>
          </div>
        </dl>
      </div>
      <ChoiceChips appearance="note" label={strike.chipsLabel} aside={strike.reference} chips={strike.chips} value={strike.value} onValueChange={strike.onChange} columns={Math.max(strike.chips.length, 1)} />
      <ChoiceChips appearance="note" width="fixed" label={expiry.chipsLabel} chips={expiry.chips} value={expiry.value} onValueChange={expiry.onChange} columns={Math.max(expiry.chips.length, 1)} />
      <p className={styles.legend}>{legend}</p>
    </div>
  )
}
