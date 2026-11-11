// The lifecycle of one option as ordered steps: what happened, what can happen now and what comes after. The
// viewer's own steps are in the second person; the other side is named by its role. Pure: the component turns
// the steps into the ui kit's Timeline and adds transaction links from Activity.
import { requiredCollateral } from '../../core/options/types'
import type { OptionOffer } from '../../core/options/types'
import { claimAmount } from '../../core/portfolio/positions'
import type { Role } from '../../core/portfolio/positions'
import type { CoveredAction } from '../../data'
import { exactMoney, premiumOf, qtyOf, strikeOf } from './model'

export type StepStatus = 'done' | 'current' | 'upcoming'

export interface LifecycleStep {
  id: 'requested' | 'offered' | 'bought' | 'resold' | 'window' | 'at-deadline' | 'exercised' | 'expired' | 'claim' | 'reclaim' | 'cancelled' | 'after'
  title: string
  text: string
  status: StepStatus
  /** Show the deadline as the time of this step. */
  atDeadline?: boolean
  /** The contract calls that carry out this step: a confirmed Activity entry of one of them links its transaction. */
  actions?: readonly CoveredAction[]
  /** The contract calls that create the option itself: linked through what their Activity entry says it created. */
  createdBy?: readonly CoveredAction[]
}

export interface LifecycleContext {
  /** The viewer's side of the option, or null for a guest or a wallet on neither side. */
  role: Role | null
  /** The option was created by a maker filling a request (the request's buyer escrowed the premium first). */
  fromRequest?: boolean
  /** This browser bought the option from its previous holder. */
  resold?: boolean
  /**
   * It is proven that this wallet paid the original premium (its own buy confirmed from this browser, or its own
   * request filled into the option). Holding the option does not prove it: a resale elsewhere or a transfer also
   * makes a holder, so without proof the first sale is told in the third person.
   */
  paid?: boolean
}

const DEADLINE_STEP = 'The deadline passes'

/** The steps of an option's life in order, with the one the chain is at marked `current`. */
export function lifecycleSteps(o: OptionOffer, ctx: LifecycleContext = { role: null }): LifecycleStep[] {
  const { role, fromRequest = false, resold = false, paid = false } = ctx
  const qty = exactMoney(qtyOf(o))
  const strike = exactMoney(strikeOf(o))
  const premium = exactMoney(premiumOf(o))
  const collateral = exactMoney(requiredCollateral(o))
  const claim = exactMoney(claimAmount(o))
  const put = o.kind === 'put'
  const sold = o.holder !== null
  const maker = role === 'writer'
  // "You" for the first sale only when this wallet's own payment is proven; a resale buyer did not take part in it.
  const holder = role === 'holder'
  const firstBuyer = holder && paid && !resold

  const created: LifecycleStep[] = fromRequest
    ? [
        {
          id: 'requested',
          title: 'Requested',
          text: firstBuyer ? `You escrowed a premium of ${premium} for this option.` : `A buyer escrowed a premium of ${premium} for this option.`,
          status: 'done',
        },
        {
          id: 'offered',
          title: 'Request filled',
          text: maker
            ? `You filled the request: you locked ${collateral} in the contract and received the premium.`
            : `A maker filled the request, locked ${collateral} in the contract and received the premium.`,
          status: 'done',
          createdBy: ['fill-bid'],
        },
      ]
    : [
        {
          id: 'offered',
          title: 'Offered',
          text: maker ? `You locked ${collateral} in the contract and asked a premium of ${premium}.` : `The maker locked ${collateral} in the contract and asked a premium of ${premium}.`,
          status: 'done',
          createdBy: ['write-offer', 'fill-bid'],
        },
      ]

  const bought: LifecycleStep[] = fromRequest
    ? []
    : [
        {
          id: 'bought',
          title: 'Bought',
          text: firstBuyer
            ? `You paid the premium of ${premium} to the maker and became the holder.`
            : maker
              ? `A buyer paid you the premium of ${premium} and became the holder.`
              : `A buyer paid the premium of ${premium} to the maker and became the holder.`,
          status: 'done',
          actions: ['buy'],
        },
      ]
  const resale: LifecycleStep[] = resold
    ? [{ id: 'resold', title: 'Resold', text: 'You bought the option from its holder. The price went to that holder.', status: 'done', actions: ['buy-resale'] }]
    : []
  const history = [...created, ...bought, ...resale]

  const theHolder = holder ? 'you' : 'the holder'
  const exerciseText = put
    ? `${holder ? 'You' : 'The holder'} can exercise at any time: deliver ${qty} and receive ${strike} in the same transaction.`
    : `${holder ? 'You' : 'The holder'} can exercise at any time: pay ${strike} and receive ${qty} in the same transaction.`
  const exercisedText = put ? `${holder ? 'You' : 'The holder'} delivered ${qty} and received ${strike}.` : `${holder ? 'You' : 'The holder'} paid ${strike} and received ${qty}.`

  switch (o.state) {
    case 'offered':
      return [
        ...created,
        {
          id: 'bought',
          title: 'For sale',
          text: maker
            ? `Any eligible buyer can pay ${premium} and become the holder. You can cancel until then.`
            : `Any eligible buyer can pay ${premium} and become the holder. The maker can cancel until then.`,
          status: 'current',
        },
        {
          id: 'at-deadline',
          title: DEADLINE_STEP,
          text: maker ? 'An offer nobody bought expires, and you reclaim the collateral.' : 'An offer nobody bought expires, and the maker reclaims the collateral.',
          status: 'upcoming',
          atDeadline: true,
        },
      ]
    case 'active':
      return [
        ...history,
        { id: 'window', title: 'Until the deadline', text: exerciseText, status: 'current' },
        {
          id: 'at-deadline',
          title: DEADLINE_STEP,
          text: `If ${theHolder} ${holder ? 'have' : 'has'} not exercised, the option expires.`,
          status: 'upcoming',
          atDeadline: true,
        },
        {
          id: 'after',
          title: 'After',
          text: maker
            ? 'You claim what an exercise left in the contract, or reclaim the collateral once the option has expired.'
            : 'The maker claims what an exercise left in the contract, or reclaims the collateral once the option has expired.',
          status: 'upcoming',
        },
      ]
    case 'exercised':
      return [
        ...history,
        { id: 'exercised', title: 'Exercised', text: exercisedText, status: 'done', actions: ['exercise'] },
        { id: 'claim', title: 'Claim delivery', text: maker ? `${claim} waits in the contract until you claim it.` : `${claim} waits in the contract until the maker claims it.`, status: 'current' },
      ]
    case 'settled':
      return [
        ...history,
        { id: 'exercised', title: 'Exercised', text: exercisedText, status: 'done', actions: ['exercise'] },
        {
          id: 'claim',
          title: 'Delivery claimed',
          text: maker ? `You claimed ${claim}. Nothing is left in the contract.` : `The maker claimed ${claim}. Nothing is left in the contract.`,
          status: 'done',
          actions: ['claim-delivery'],
        },
      ]
    case 'expired':
    case 'reclaimed': {
      const reclaimed = o.state === 'reclaimed'
      const expired: LifecycleStep = {
        id: 'expired',
        title: DEADLINE_STEP,
        text: sold ? 'The option expired without an exercise. The right is gone.' : 'The offer expired without a buyer.',
        status: 'done',
        atDeadline: true,
      }
      const reclaim: LifecycleStep = reclaimed
        ? {
            id: 'reclaim',
            title: 'Collateral reclaimed',
            text: maker ? `You took ${collateral} back. Nothing is left in the contract.` : `The maker took ${collateral} back. Nothing is left in the contract.`,
            status: 'done',
            actions: ['reclaim'],
          }
        : { id: 'reclaim', title: 'Reclaim', text: maker ? `${collateral} waits in the contract until you reclaim it.` : `${collateral} waits in the contract until the maker reclaims it.`, status: 'current' }
      return sold ? [...history, expired, reclaim] : [...created, expired, reclaim]
    }
    case 'cancelled':
      return [
        ...created,
        {
          id: 'cancelled',
          title: 'Offer cancelled',
          text: maker
            ? `You withdrew the offer before anyone bought it. ${collateral} went back to your wallet.`
            : `The maker withdrew the offer before anyone bought it. ${collateral} went back to the maker.`,
          status: 'done',
          actions: ['cancel-offer'],
        },
      ]
  }
}
