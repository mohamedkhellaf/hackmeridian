import type { MouseEvent, ReactNode } from 'react'
import { Mono } from '../ui'
import './reserves.css'

// Numbered definitions for the layer categories used in the legend and breakdown rows. The page uses hash
// routing, so footnote links scroll in place instead of changing location.hash.

export type FootnoteId = 1 | 2 | 3 | 4 | 5 | 6

const MARKS = ['¹', '²', '³', '⁴', '⁵', '⁶']

function jump(e: MouseEvent<HTMLAnchorElement>, target: string) {
  e.preventDefault()
  document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/** Superscript marker that jumps to its footnote. */
export function FnRef({ n }: { n: FootnoteId }) {
  return (
    <sup className="rs-fnref">
      <a href={`#fn-${n}`} onClick={(e) => jump(e, `fn-${n}`)} aria-label={`Footnote ${n}`}>
        {MARKS[n - 1]}
      </a>
    </sup>
  )
}

export function Footnotes() {
  const items: { n: FootnoteId; term: string; body: ReactNode }[] = [
    { n: 1, term: 'Open offers', body: 'Collateral locked by makers for offers that have not been bought yet. A maker can cancel an unsold offer and take the collateral back.' },
    { n: 2, term: 'Sold options', body: 'Collateral backing options that have been bought, until the holder exercises or the option expires.' },
    { n: 3, term: 'Unclaimed proceeds', body: 'What holders delivered or paid at exercise, waiting for the writer to claim it. It stays in the contract until then.' },
    { n: 4, term: 'Expired, to reclaim', body: 'Collateral of expired options that the writer has not taken back yet.' },
    {
      n: 5,
      term: 'Held and owed',
      body: (
        <>
          Held is the token's <Mono>balance(contract)</Mono> on its Stellar Asset Contract. Owed is <Mono>open_collateral(token)</Mono> on the options
          contract. Both are public reads.
        </>
      ),
    },
    {
      n: 6,
      term: 'If held is below owed',
      body: 'This happens if the issuer claws back the asset from the contract. Payouts are then served first come, first served until the balance runs out, so the last holders may not be paid. There is no refund.',
    },
  ]
  return (
    <ol className="rs-notes" aria-label="Footnotes">
      {items.map((it) => (
        <li key={it.n} id={`fn-${it.n}`}>
          <span className="rs-note-mark">{MARKS[it.n - 1]}</span>
          <span>
            <b>{it.term}.</b> {it.body}
          </span>
        </li>
      ))}
    </ol>
  )
}
