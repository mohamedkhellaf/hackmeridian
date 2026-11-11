import { useState } from 'react'
import {
  Badge,
  Button,
  Callout,
  DateTime,
  Select,
  Skeleton,
  Spinner,
  Stepper,
  TX_STATES,
  TX_STATE_LABEL,
  Tag,
  Timeline,
  TxLink,
  TxStepper,
} from '../../../ui'
import type { TxState } from '../../../ui'
import { Example, Section, Specimen } from '../Specimen'
import styles from '../Gallery.module.css'
import { EXPLORER, SAMPLE_DEADLINE, SAMPLE_HASH } from './sample'

/* What each transaction state means and what to do. In the app this copy lives with the ticket. */
const TX_MEANING: Record<TxState, string> = {
  checking: 'Simulating the transaction against the latest ledger. Nothing has been sent.',
  signing: 'Open your wallet and approve the transaction. You can still cancel there.',
  submitting: 'Signed. Sending it to the network.',
  pending: 'Sent. Waiting for a ledger to include it, usually under 10 seconds. You can close this.',
  confirmed: 'Included in a ledger. The option is yours.',
  failed: 'The network included the transaction but the contract refused it. The network fee was charged.',
  unknown: 'Not confirmed yet. It can still go through. Check again before sending another.',
  expired: 'Expired without being included. Nothing was charged. Send it again.',
  declined: 'Declined in your wallet. Nothing was sent.',
}

export function FeedbackSection() {
  const [state, setState] = useState<TxState>('pending')
  const hasHash = state === 'pending' || state === 'confirmed' || state === 'failed' || state === 'unknown' || state === 'expired'
  return (
    <Section
      id="feedback"
      title="Feedback"
      lead="State is said in words. Colour, shape and icons repeat it; they never carry it alone. Nothing here reassures: a message states what happened, what it means for the money and what to do."
    >
      <Specimen title="Callout" note="Three variants, each with an icon and a word. Only a message that answers an action and must interrupt is an alert; standing disclosures are not." layout="stack">
        <Callout variant="info" title="Demo price">
          Strikes are placed around 9.82 USDx, a fixed figure for this demo. It is not a market price.
        </Callout>
        <Callout variant="warning" title="Deadline in 2 h" actions={<Button size="sm">View position</Button>}>
          Your long put on BOND is in the money at the demo price. Exercise before 13 Nov 2026, 08:00 UTC or it expires.
        </Callout>
        <Callout variant="danger" title="The BOND issuer has not authorized your account" actions={<Button size="sm">Check again</Button>}>
          You cannot buy this option yet. Nothing was sent. Ask the issuer to authorize the account, then check again.
        </Callout>
        <Callout variant="warning" label="Experimental" title="Margin is a separate contract with partial collateral" />
      </Specimen>

      <Specimen
        title="Tag"
        note="The only tag in the product, and it only carries a contract state name. Shape tells the group: outline waits, ink is in force, filled was carried out, dashed has ended."
      >
        {['Offered', 'Active', 'Exercised', 'Expired', 'Cancelled'].map((name) => (
          <Tag key={name} state={name} />
        ))}
        <Tag state="Listed" />
        <Tag state="Filled" />
        <Tag state="Reclaimed" />
      </Specimen>

      <Specimen title="Badge" note="A count of what the data says. Never a status, never a marker for something new.">
        <Example label="Actions waiting, on a navigation item">
          <span className={styles.glyphItem}>
            Portfolio <Badge count={2} label="2 actions waiting" />
          </span>
        </Example>
        <Example label="Quiet, next to a tab label">
          <span className={styles.glyphItem}>
            Holding <Badge count={12} tone="quiet" />
          </span>
        </Example>
        <Example label="Capped">
          <Badge count={140} />
        </Example>
      </Specimen>

      <Specimen
        title="Transaction steps"
        note="One state machine for Covered and Margin: check, sign, submit, confirm. The three failure stages always read differently: nothing was sent, outcome unknown, fee charged."
        layout="split"
        surface
      >
        <div>
          <Select<TxState>
            label="State"
            value={state}
            onValueChange={setState}
            options={TX_STATES.map((value) => ({ value, label: TX_STATE_LABEL[value] }))}
          />
        </div>
        <TxStepper
          state={state}
          hash={hasHash ? <TxLink hash={SAMPLE_HASH} explorerUrl={EXPLORER} copy /> : undefined}
        >
          {TX_MEANING[state]}
        </TxStepper>
        <Example label="Refused by the check: failed before anything was sent">
          <TxStepper state="failed" failedAt="check">
            The BOND issuer has not authorized your account. Nothing was sent and no fee was charged.
          </TxStepper>
        </Example>
        <Example label="Declined in the wallet">
          <TxStepper state="declined">{TX_MEANING.declined}</TxStepper>
        </Example>
      </Specimen>

      <Specimen title="Stepper" note="The general form: an ordered list where each step states its status in words." layout="split">
        <Stepper
          label="Get test funds"
          steps={[
            { label: 'Fund the account with Friendbot', status: 'done' },
            { label: 'Add trustlines for BOND and USDx', status: 'current', detail: 'Two operations in one transaction.' },
            { label: 'Swap XLM for test tokens', status: 'upcoming' },
          ]}
        />
      </Specimen>

      <Specimen title="Timeline" note="A lifecycle: what happens, who acts and by when. Used for an option's life and for a position's history." layout="split">
        <Timeline
          label="Life of this option"
          items={[
            { time: 'Now', actor: 'You', title: 'Pay the premium', description: 'The maker locked 50.00 USDx in the contract before you pay.', status: 'done' },
            { time: 'Until the deadline', actor: 'You', title: 'Exercise if it is worth it', description: 'You deliver 5 BOND and receive 50.00 USDx in the same transaction.', status: 'current' },
            { time: <DateTime value={SAMPLE_DEADLINE} />, actor: 'Nobody', title: 'The right ends', description: 'Nothing settles by itself. An option not exercised by then expires.', status: 'upcoming' },
            { time: 'After', actor: 'The maker', title: 'Reclaims the collateral', status: 'upcoming' },
          ]}
        />
      </Specimen>

      <Specimen title="Skeleton" note="Content-shaped, for the first load of a view only. Later refreshes keep the data on screen." layout="split">
        <Example label="Text" wide>
          <Skeleton lines={3} />
        </Example>
        <Example label="Rows" wide>
          <Skeleton variant="rows" lines={4} />
        </Example>
        <Example label="Block" wide>
          <Skeleton variant="block" height="7rem" />
        </Example>
      </Specimen>

      <Specimen title="Spinner" note="For one module that is waiting 2 to 10 seconds. Always next to a word.">
        <span className={styles.glyphItem}>
          <Spinner /> Checking
        </span>
        <span className={styles.glyphItem}>
          <Spinner size="md" /> Reading the ledger
        </span>
      </Specimen>
    </Section>
  )
}
