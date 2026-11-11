import { CopyButton } from './CopyButton'
import { groupAddress, shortenAddress, shortenHash } from './format'
import type { AddressLength } from './format'
import { IconExternal } from './icons'
import { cx } from './internal/cx'
import styles from './Address.module.css'

export interface AddressProps {
  /** The full account or contract id. */
  value: string
  /** `short` (4+4) in tables, `medium` (6+6) on decision surfaces, `full` where an address is checked or pasted. */
  length?: AddressLength
  /** Link to the explorer page of this address. Built by the caller; `ui/` knows no network. */
  explorerUrl?: string
  /** What the link opens, for its accessible name ("View the maker on the explorer"). */
  explorerLabel?: string
  /** Set to `null` to leave the copy button out. */
  copyLabel?: string | null
  /** A known label shown before the id ("Maker A", "Issuer"). Never "Verified". */
  name?: string
  /** Marks the connected wallet's own address with "(you)". */
  you?: boolean
  className?: string
}

/** Proof is a truncated id in mono with a copy button and an explorer link. */
export function Address({
  value,
  length = 'short',
  explorerUrl,
  explorerLabel = 'View on the explorer',
  copyLabel = 'Copy address',
  name,
  you = false,
  className,
}: AddressProps) {
  return (
    <span className={cx(styles.root, className)} data-length={length}>
      {name ? <span className={styles.name}>{name}</span> : null}
      {length === 'full' ? (
        <span className={cx(styles.id, styles.full)}>
          {groupAddress(value).map((group, i) => (
            <span key={i}>{group}</span>
          ))}
        </span>
      ) : (
        <span className={styles.id}>{shortenAddress(value, length)}</span>
      )}
      {you ? <span className={styles.you}>(you)</span> : null}
      {copyLabel ? <CopyButton value={value} label={copyLabel} copiedMessage="Address copied" /> : null}
      {explorerUrl ? (
        <a className={styles.out} href={explorerUrl} target="_blank" rel="noopener noreferrer">
          <IconExternal />
          <span className="ui-vh">{explorerLabel} (opens in a new tab)</span>
        </a>
      ) : null}
    </span>
  )
}

export interface TxLinkProps {
  /** The full transaction hash. */
  hash: string
  /** Link to the explorer page of this transaction. Without it the hash is plain text. */
  explorerUrl?: string
  /** Adds a copy button. */
  copy?: boolean
  className?: string
}

/** A transaction as `1c3bb34c…9f7a`: a link to the explorer, with an optional copy button. */
export function TxLink({ hash, explorerUrl, copy = false, className }: TxLinkProps) {
  const short = shortenHash(hash)
  return (
    <span className={cx(styles.root, className)}>
      {explorerUrl ? (
        <a className={cx(styles.id, styles.txLink)} href={explorerUrl} target="_blank" rel="noopener noreferrer">
          <span className="ui-vh">View transaction </span>
          {short}
          <span className="ui-vh"> on the explorer (opens in a new tab)</span>
          <IconExternal size={14} className={styles.txIcon} />
        </a>
      ) : (
        <span className={styles.id}>{short}</span>
      )}
      {copy ? <CopyButton value={hash} label="Copy transaction hash" copiedMessage="Hash copied" /> : null}
    </span>
  )
}
