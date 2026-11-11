import { Link as RouterLink } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { PRO_ENABLED } from '../../core/config'
import { explorerAccount } from '../../core/explorer'
import { useActivity, useOptionsClient } from '../../data'
import { Address, announce, Button, ButtonLink, Callout, EmptyNote, Link, PageHeader, useIsPhone } from '../../ui'
import { useWallet } from '../../wallet'
import { ActivityList } from './ActivityList'
import { ActivityTable } from './ActivityTable'
import {
  CLEAR_FINISHED,
  CONNECT,
  EMPTY_ACTION,
  EMPTY_HINT,
  EMPTY_TITLE,
  EXPLORER_LINK,
  EXPLORER_RECORD,
  GUEST_HINT,
  GUEST_TITLE,
  LOCAL_ONLY,
  MOCK_NOTE,
  PAGE_DESCRIPTION,
  PAGE_DESCRIPTION_GUEST,
  PAGE_TITLE,
  UNKNOWN_TEXT,
  UNKNOWN_TEXT_MANY,
  UNKNOWN_TITLE,
  cleared,
  countLine,
} from './copy'
import { activityRows, settledCount } from './model'
import css from './ActivityPage.module.css'

/**
 * Activity: every transaction started from this browser as the connected wallet, with its state in words, its
 * hash and a link to what it concerns. The list is local; the page says so before anything else.
 */
export function ActivityPage() {
  const wallet = useWallet()
  const { me, isMock } = useOptionsClient()
  const activity = useActivity()
  const phone = useIsPhone()
  const [checking, setChecking] = useState<string | null>(null)

  const rows = useMemo(() => activityRows(activity.entries, { marginEnabled: PRO_ENABLED }), [activity.entries])
  const settled = settledCount(rows)
  const showProduct = rows.some((r) => r.product === 'margin')

  const onCheck = (id: string) => {
    setChecking(id)
    // The runner announces the result; the row then shows it.
    void activity.check(id).finally(() => setChecking((current) => (current === id ? null : current)))
  }

  const onClear = () => {
    activity.clearSettled()
    announce(cleared(settled))
  }

  return (
    <div className={css.page}>
      <PageHeader
        title={PAGE_TITLE}
        description={me ? PAGE_DESCRIPTION : PAGE_DESCRIPTION_GUEST}
      />

      <div className={css.local} data-testid="local-only">
        <p className={css.localLine}>{LOCAL_ONLY}</p>
        {me && !isMock ? (
          <p>
            {EXPLORER_RECORD}{' '}
            <Link href={explorerAccount(me)} external>
              {EXPLORER_LINK}
            </Link>
          </p>
        ) : null}
        {isMock ? <p>{MOCK_NOTE}</p> : null}
        {me ? (
          <p className={css.wallet}>
            <span>Wallet</span>
            <Address value={me} length="medium" copyLabel="Copy the wallet address" explorerUrl={isMock ? undefined : explorerAccount(me)} explorerLabel="View the wallet on the explorer" />
          </p>
        ) : null}
      </div>

      {!me ? (
        <EmptyNote
          headingLevel={2}
          title={GUEST_TITLE}
          hint={GUEST_HINT}
          action={
            <Button variant="secondary" onClick={() => void wallet.connect()}>
              {CONNECT}
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyNote
          headingLevel={2}
          title={EMPTY_TITLE}
          hint={EMPTY_HINT}
          action={
            <ButtonLink variant="secondary" render={<RouterLink to="/markets" />}>
              {EMPTY_ACTION}
            </ButtonLink>
          }
        />
      ) : (
        <>
          {activity.unknown > 0 ? (
            <Callout variant="warning" title={UNKNOWN_TITLE(activity.unknown)}>
              <p>{activity.unknown === 1 ? UNKNOWN_TEXT : UNKNOWN_TEXT_MANY}</p>
            </Callout>
          ) : null}
          <div className={css.list}>
            <div className={css.toolbar}>
              <p className={css.count} data-testid="activity-count">
                {countLine(rows.length, activity.inFlight, activity.unknown)}
              </p>
              {settled > 0 ? (
                <Button variant="quiet" size="sm" className={css.clear} onClick={onClear}>
                  {CLEAR_FINISHED}
                </Button>
              ) : null}
            </div>
            {phone ? (
              <ActivityList rows={rows} showProduct={showProduct} checking={checking} onCheck={onCheck} />
            ) : (
              <ActivityTable rows={rows} showProduct={showProduct} checking={checking} onCheck={onCheck} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
