// The states of an asset page that are not the page itself: first load, a failed read, and no such asset.
import { Link as RouterLink } from '@tanstack/react-router'
import { assetParam, findReferenceAsset } from '../../../core/assets'
import type { TokenInfo } from '../../../core/options/types'
import { Button, ButtonLink, Callout, EmptyNote, Link, PageHeader, Skeleton } from '../../../ui'
import { ALL_MARKETS, ASSET_ERROR, ASSET_HEADING, ASSET_LOADING, NOT_FOUND, NOT_FOUND_HEADING, NOT_FOUND_LISTED, RETRY, typeLine } from '../copy'
import { BackToMarkets } from '../parts'
import { ASSET_ROUTE, MARKETS_ROUTE } from '../routing'
import styles from './AssetStates.module.css'

export function AssetPageSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <h1 className="ui-vh" tabIndex={-1}>
        {ASSET_LOADING}
      </h1>
      <Skeleton width="5rem" />
      <Skeleton variant="block" width="12rem" height="2.25rem" />
      <Skeleton variant="block" height="5rem" />
      <Skeleton variant="block" height="2.25rem" />
      <div className={styles.skeletonBody}>
        <Skeleton variant="block" height="26rem" />
        <Skeleton variant="block" height="18rem" className={styles.skeletonRail} />
      </div>
    </div>
  )
}

export function AssetPageError({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className={styles.state}>
      <PageHeader title={ASSET_HEADING} back={<BackToMarkets />} />
      <Callout variant="danger" title={ASSET_ERROR} actions={<Button onClick={onRetry}>{RETRY}</Button>}>
        {message}
      </Callout>
    </div>
  )
}

export interface AssetNotFoundProps {
  /** `invalid`: the segment is not an asset address at all. `unknown`: well formed, not listed. */
  reason: 'invalid' | 'unknown'
  /** The assets the contract lists, when they are known: offered as the way on. */
  listed?: readonly TokenInfo[]
}

/** A fixed view: the segment of the URL is never printed back. */
export function AssetNotFound({ reason, listed }: AssetNotFoundProps) {
  const reference = (listed ?? []).filter((t) => findReferenceAsset(t.contractId) !== null)
  const shown = reference.length > 0 ? reference : (listed ?? []).slice(0, 6)
  return (
    <div className={styles.state}>
      <PageHeader title={NOT_FOUND_HEADING} back={<BackToMarkets />} />
      <EmptyNote
        headingLevel={2}
        title={NOT_FOUND[reason].title}
        hint={NOT_FOUND[reason].hint}
        action={
          <ButtonLink variant="primary" render={<RouterLink to={MARKETS_ROUTE} />}>
            {ALL_MARKETS}
          </ButtonLink>
        }
      />
      {shown.length > 0 ? (
        <nav className={styles.listed} aria-label={NOT_FOUND_LISTED}>
          <h2 className={styles.listedTitle}>{NOT_FOUND_LISTED}</h2>
          <ul className={styles.listedList} role="list">
            {shown.map((t) => (
              <li key={t.contractId}>
                <Link tone="ink" render={<RouterLink to={ASSET_ROUTE} params={{ asset: assetParam(t) }} />}>
                  {t.code}
                </Link>
                <span className={styles.listedType}>{typeLine(findReferenceAsset(t.contractId)?.typeLabel ?? null)}</span>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  )
}
