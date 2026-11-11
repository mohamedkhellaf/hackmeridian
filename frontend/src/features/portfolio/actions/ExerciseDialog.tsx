// Exercise: the one action with a deadline. The review states both legs in a sentence, shows what the wallet
// needs to deliver or pay against what it has, where the strike stands at the reference price, and warns inside
// the last 15 minutes. An exercise the reference says loses value needs an explicit tick.
import { useMemo, useState } from 'react'
import { explorerAddress, isMockId } from '../../../core/explorer'
import { formatExact, formatUnits } from '../../../core/format'
import type { PreTradeAction } from '../../../core/options/preTrade'
import { requiredCollateral } from '../../../core/options/types'
import type { OptionOffer } from '../../../core/options/types'
import { claimAmount } from '../../../core/portfolio/positions'
import { exerciseValue, optionMoneyness, priceOf } from '../../../core/reference'
import { optionReference, useExercise, useMe, usePreTrade } from '../../../data'
import { Address, Amount, Checkbox, Countdown, DateTime, KeyValue, KeyValueItem } from '../../../ui'
import { ATOMIC_NOTE, NOTE_TERMS, RECEIPT, exerciseCopy, outOfTheMoneyConsent } from '../copy'
import { MONEYNESS_WORD, exactMoney, glyphOf, referenceFigure, referenceName, serialOf, strikeExact, strikeText } from '../model'
import { ActionDialog, CheckLines, Issue } from './ActionDialog'
import type { ActionDialogProps } from './ActionDialog'
import css from './dialogs.module.css'

export interface ExerciseDialogProps {
  open: boolean
  onClose: () => void
  /** The option as it was when the dialog opened. The dialog re-reads it before signing. */
  option: OptionOffer
  receiptAction?: ActionDialogProps['receiptAction']
  finalFocus?: ActionDialogProps['finalFocus']
}

export function ExerciseDialog({ open, onClose, option: o, receiptAction, finalFocus }: ExerciseDialogProps) {
  const me = useMe()
  const exercise = useExercise()
  const [checking, setChecking] = useState(false)
  const [consent, setConsent] = useState(false)
  const reviewing = open && exercise.state.phase === 'idle'

  const action = useMemo<PreTradeAction>(() => ({ type: 'exercise', option: o }), [o])
  const check = usePreTrade(action, { enabled: reviewing })

  const reference = optionReference(o)
  const moneyness = optionMoneyness(o, reference)
  const value = exerciseValue(o, reference)
  const figure = referenceFigure(reference, o.quote)
  const hasReference = priceOf(reference) !== null && figure !== null

  const issues = (check?.issues ?? []).filter((i) => i.code !== 'not-connected')
  const blocking = issues.find((i) => i.level === 'block') ?? null
  const needsConsent = issues.some((i) => i.code === 'out-of-the-money')
  const copy = exerciseCopy(o)
  // PUT: the holder delivers the underlying and receives the strike. CALL: pays the strike, receives the underlying.
  const pays = claimAmount(o)
  const receives = requiredCollateral(o)

  const start = async () => {
    if (!check) return
    setChecking(true)
    const fresh = await check.recheck().catch(() => null)
    setChecking(false)
    // A failed re-check is not a refusal: the contract is the final check. A blocking result stops here, and the
    // lines above now say why.
    if (fresh?.blocked) return
    await exercise.run(o)
  }

  const blockedReason = blocking ? blocking.message : needsConsent && !consent ? 'Tick the box above to exercise out of the money.' : null

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      copy={copy}
      serial={serialOf(o.id)}
      glyph={glyphOf(o.kind, 'holder')}
      tx={exercise}
      onConfirm={() => void start()}
      checking={checking}
      blockedReason={me ? blockedReason : null}
      receiptState="Exercised"
      receiptAction={receiptAction}
      finalFocus={finalFocus}
      receiptTerms={[
        { label: o.kind === 'put' ? RECEIPT.delivered : RECEIPT.paid, value: exactMoney(pays) },
        { label: RECEIPT.received, value: exactMoney(receives), marked: true },
      ]}
    >
      <p className={css.note}>{ATOMIC_NOTE}</p>
      <KeyValue>
        <KeyValueItem label={NOTE_TERMS.strike}>
          <Amount value={strikeText(o)} exact={strikeExact(o)} unit={`${o.quote.code} per ${o.underlying.code}`} figure="serif" />
        </KeyValueItem>
        <KeyValueItem
          label={NOTE_TERMS.deadline}
          hint={
            <span className={css.inline}>
              <Countdown to={o.expiry * 1000} warnBelowMs={2 * 3_600_000} label="Time left to exercise" />
            </span>
          }
        >
          <DateTime value={o.expiry * 1000} local="below" />
        </KeyValueItem>
        {hasReference ? (
          <KeyValueItem label={NOTE_TERMS.moneyness} hint={`Reference price ${figure} ${o.quote.code} (${referenceName(reference)}). ${reference.note}`}>
            {MONEYNESS_WORD[moneyness]}
          </KeyValueItem>
        ) : null}
        {hasReference && value !== null ? (
          <KeyValueItem label={NOTE_TERMS.exerciseValue} hint="Against not exercising, at the reference price. The premium is not counted.">
            {value === 0n ? (
              <Amount value={formatUnits(0n, o.quote.decimals)} unit={o.quote.code} figure="serif" />
            ) : (
              <Amount
                value={formatUnits(value < 0n ? -value : value, o.quote.decimals)}
                exact={formatExact(value < 0n ? -value : value, o.quote.decimals)}
                unit={o.quote.code}
                direction={value > 0n ? 'gain' : 'loss'}
                figure="serif"
              />
            )}
          </KeyValueItem>
        ) : null}
        <KeyValueItem label={NOTE_TERMS.writer}>
          <Address value={o.writer} length="medium" explorerUrl={isMockId(o.writer) ? undefined : explorerAddress(o.writer)} explorerLabel="View the writer on the explorer" />
        </KeyValueItem>
      </KeyValue>
      <CheckLines lines={[check?.state ?? null, check?.funds ?? null]} />
      {issues.map((i) => (
        <Issue key={i.code} level={i.level}>
          {i.message}
        </Issue>
      ))}
      {needsConsent && me ? (
        <Checkbox checked={consent} onCheckedChange={setConsent}>
          {outOfTheMoneyConsent(referenceName(reference))}
        </Checkbox>
      ) : null}
    </ActionDialog>
  )
}
