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
  TxStateWord,
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
      <Specimen title="Callout" note="Three variants, each with its icon and at most one heading line; the variant word is read out, not shown. Only a message that answers an action and must interrupt is an alert; standing disclosures are not." layout="stack">
        <Callout variant="info" title="No offer for these terms yet">
          You can post a request at these terms and escrow your premium, or choose a strike that has an offer.
        </Callout>
        <Callout variant="warning" title="Deadline in 2 h" actions={<Button size="sm">View position</Button>}>
          Your long put on BOND is in the money at the demo price. Exercise before 13 Nov 2026, 08:00 UTC or it expires.
        </Callout>
        <Callout variant="danger" title="The BOND issuer has not authorized your account" actions={<Button size="sm">Check again</Button>}>
          You cannot buy this option yet. Nothing was sent. Ask the issuer to authorize the account, then check again.
        </Callout>
        <Callout variant="warning" title="Withdrawals are blocked: an expired position is not settled yet." />
      </Specimen>

      <Specimen
        title="Tag"
        note="The only tag in the product, and it only carries a contract state name. One shape, two tones: ink while it waits or is in force, muted once carried out or ended."
      >
        {['Offered', 'Active', 'Exercised', 'Expired', 'Cancelled'].map((name) => (
          <Tag key={name} state={name} />
        ))}
        <Tag state="Listed" />
        <Tag state="Filled" />
        <Tag state="Reclaimed" />
      </Specimen>

      <Specimen title="Badge" note="A count of what the data says. Solid only for the one count that asks for action; next to a tab label it is a plain muted numeral. Never a status, never a marker for something new.">
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

      <Specimen title="Transaction state" note="One glyph and word per state, the same in Activity and in the issuer's recent actions. The word carries the meaning.">
        {(['pending', 'confirmed', 'failed', 'unknown', 'expired', 'declined'] as const).map((name) => (
          <TxStateWord key={name} state={name} />
        ))}
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

      <Specimen title="Timeline" note="A lifecycle: what happens and by when; each title says who acts. Used for an option's life and for a position's history." layout="split">
        <Timeline
          label="Life of this option"
          items={[
            { time: 'Now', title: 'You pay the premium', description: 'The maker locked 50.00 USDx in the contract before you pay.', status: 'done' },
            { time: 'Until the deadline', title: 'You exercise if it is worth it', description: 'You deliver 5 BOND and receive 50.00 USDx in the same transaction.', status: 'current' },
            { time: <DateTime value={SAMPLE_DEADLINE} />, title: 'The deadline passes', description: 'If you have not exercised by then, the right expires and the premium stays with the maker.', status: 'upcoming' },
            { time: 'After', title: 'The maker reclaims the collateral', status: 'upcoming' },
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
