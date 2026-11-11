// The listed expiries as one radio group (a date with the time left under it), and a link to the orders on
// dates that are not listed.
import { countOf, formatUtc } from '../../../core/format'
import type { ExpiryColumn } from '../../../data'
import { Link, Segmented, VisuallyHidden } from '../../../ui'
import { COPY, OFFERS } from './copy'
import { expiryLabel, leftLabel } from './model'
import { OTHER_OFFERS_ID } from './OtherOffers'
import styles from './ExpiryBar.module.css'

export interface ExpiryBarProps {
  columns: readonly ExpiryColumn[]
  /** The `day` of the column shown. */
  value: string
  onChange: (day: string) => void
  /** Orders on dates that are not listed. Zero hides the link. */
  otherDates: number
}

export function ExpiryBar({ columns, value, onChange, otherDates }: ExpiryBarProps) {
  return (
    <div className={styles.root}>
      <Segmented
        label={COPY.expiryLabel}
        value={value}
        onValueChange={onChange}
        options={columns.map((c) => ({
          value: c.day,
          label: expiryLabel(c.expiry),
          detail: (
            <>
              {leftLabel(c.secondsLeft)}
              <VisuallyHidden>
                {' '}
                {COPY.left}, {formatUtc(c.expiry)}, {countOf(c.offers, OFFERS)}
              </VisuallyHidden>
            </>
          ),
        }))}
      />
      {otherDates > 0 ? (
        <Link href={`#${OTHER_OFFERS_ID}`} tone="quiet" className={styles.other}>
          {COPY.otherDatesLink(otherDates)}
        </Link>
      ) : null}
    </div>
  )
}
