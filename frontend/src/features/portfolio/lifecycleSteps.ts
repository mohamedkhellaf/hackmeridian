// The lifecycle of one option as ordered steps: what happened, what can happen now, what comes after, and who
// acts. Pure: the component turns the steps into the ui kit's Timeline and adds transaction links from Activity.
import { requiredCollateral } from '../../core/options/types'
import type { OptionOffer } from '../../core/options/types'
import { claimAmount } from '../../core/portfolio/positions'
import type { CoveredAction } from '../../data'
import { exactMoney, premiumOf, qtyOf, strikeOf } from './model'

export type StepStatus = 'done' | 'current' | 'upcoming'

export interface LifecycleStep {
  id: 'offered' | 'bought' | 'window' | 'at-deadline' | 'exercised' | 'expired' | 'claim' | 'reclaim' | 'cancelled' | 'after'
  title: string
  text: string
  /** Who acts in this step. */
  actor: string
  status: StepStatus
  /** Show the deadline as the time of this step. */
  atDeadline?: boolean
  /** The contract calls that carry out this step: a confirmed Activity entry of one of them links its transaction. */
  actions?: readonly CoveredAction[]
  /** The contract calls that create the option itself: linked through what their Activity entry says it created. */
  createdBy?: readonly CoveredAction[]
}

const ACTOR = { writer: 'The writer acts', holder: 'The holder acts', buyer: 'A buyer acts', nobody: 'Nobody acts' } as const

/** The steps of an option's life in order, with the one the chain is at marked `current`. */
export function lifecycleSteps(o: OptionOffer): LifecycleStep[] {
  const qty = exactMoney(qtyOf(o))
  const strike = exactMoney(strikeOf(o))
  const premium = exactMoney(premiumOf(o))
  const collateral = exactMoney(requiredCollateral(o))
  const claim = exactMoney(claimAmount(o))
  const put = o.kind === 'put'
  const sold = o.holder !== null

  const offered: LifecycleStep = {
    id: 'offered',
    title: 'Offered',
    text: `The writer locked ${collateral} in the contract and asked a premium of ${premium}.`,
    actor: ACTOR.writer,
    status: 'done',
    // Linked through what the transaction created: a written offer, or a request that a maker filled.
    createdBy: ['write-offer', 'fill-bid'],
  }
  const bought: LifecycleStep = {
    id: 'bought',
    title: 'Bought',
    text: `The premium of ${premium} went to the writer. The buyer became the holder.`,
    actor: ACTOR.buyer,
    status: 'done',
    actions: ['buy', 'buy-resale'],
  }
  const exerciseText = put
    ? `The holder can exercise at any time: deliver ${qty} and receive ${strike} in the same transaction.`
    : `The holder can exercise at any time: pay ${strike} and receive ${qty} in the same transaction.`
  const exercisedText = put ? `The holder delivered ${qty} and received ${strike}.` : `The holder paid ${strike} and received ${qty}.`

  switch (o.state) {
    case 'offered':
      return [
        offered,
        {
          id: 'bought',
          title: 'For sale',
          text: `Any eligible buyer can pay ${premium} and become the holder. The writer can cancel until then.`,
          actor: ACTOR.buyer,
          status: 'current',
        },
        {
          id: 'at-deadline',
          title: 'At the deadline',
          text: 'Nothing settles by itself. An offer nobody bought expires, and the writer reclaims the collateral.',
          actor: ACTOR.nobody,
          status: 'upcoming',
          atDeadline: true,
        },
      ]
    case 'active':
      return [
        offered,
        bought,
        { id: 'window', title: 'Until the deadline', text: exerciseText, actor: ACTOR.holder, status: 'current', atDeadline: true },
        {
          id: 'at-deadline',
          title: 'At the deadline',
          text: 'Nothing settles by itself. If the holder has not exercised, the option expires.',
          actor: ACTOR.nobody,
          status: 'upcoming',
        },
        {
          id: 'after',
          title: 'After',
          text: 'The writer claims what an exercise left in the contract, or reclaims the collateral once the option has expired.',
          actor: ACTOR.writer,
          status: 'upcoming',
        },
      ]
    case 'exercised':
      return [
        offered,
        bought,
        { id: 'exercised', title: 'Exercised', text: exercisedText, actor: ACTOR.holder, status: 'done', actions: ['exercise'] },
        { id: 'claim', title: 'Claim delivery', text: `${claim} waits in the contract until the writer claims it.`, actor: ACTOR.writer, status: 'current' },
      ]
    case 'settled':
      return [
        offered,
        bought,
        { id: 'exercised', title: 'Exercised', text: exercisedText, actor: ACTOR.holder, status: 'done', actions: ['exercise'] },
        {
          id: 'claim',
          title: 'Delivery claimed',
          text: `The writer claimed ${claim}. Nothing is left in the contract.`,
          actor: ACTOR.writer,
          status: 'done',
          actions: ['claim-delivery'],
        },
      ]
    case 'expired':
    case 'reclaimed': {
      const reclaimed = o.state === 'reclaimed'
      const expired: LifecycleStep = sold
        ? { id: 'expired', title: 'Expired', text: 'The deadline passed without an exercise. The right is gone.', actor: ACTOR.nobody, status: 'done', atDeadline: true }
        : { id: 'expired', title: 'Expired', text: 'The deadline passed without a buyer.', actor: ACTOR.nobody, status: 'done', atDeadline: true }
      const reclaim: LifecycleStep = reclaimed
        ? { id: 'reclaim', title: 'Collateral reclaimed', text: `The writer took ${collateral} back. Nothing is left in the contract.`, actor: ACTOR.writer, status: 'done', actions: ['reclaim'] }
        : { id: 'reclaim', title: 'Reclaim', text: `${collateral} waits in the contract until the writer reclaims it.`, actor: ACTOR.writer, status: 'current' }
      return sold ? [offered, bought, expired, reclaim] : [offered, expired, reclaim]
    }
    case 'cancelled':
      return [
        offered,
        {
          id: 'cancelled',
          title: 'Offer cancelled',
          text: `The writer withdrew the offer before anyone bought it. ${collateral} went back to the writer.`,
          actor: ACTOR.writer,
          status: 'done',
          actions: ['cancel-offer'],
        },
      ]
  }
}
