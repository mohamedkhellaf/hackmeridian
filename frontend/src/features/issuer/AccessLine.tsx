import { explorerAddress } from '../../core/explorer'
import { Address, Button } from '../../ui'
import { COPY } from './copy'
import type { Access, IssuerAsset } from './model'
import styles from './AccessLine.module.css'

export interface AccessLineProps {
  access: Access
  code: string
  /** The asset's issuer: undefined while it is read, null when it cannot be known. */
  issuer: string | null | undefined
  /** Another listed asset the connected account issues. */
  otherIssued: IssuerAsset | null
  onConnect: () => void
  onRetry: () => void
  onOpen: (contractId: string) => void
}

/**
 * Who is looking, in one quiet line under the title: the issuer is told so; anyone else that the page is read
 * only and whose signature acts, with "Connect wallet" for a guest. Being read only is the normal case, not a
 * warning. Nothing on mock data, where the page's one sentence says it all.
 */
export function AccessLine({ access, code, issuer, otherIssued, onConnect, onRetry, onOpen }: AccessLineProps) {
  const c = COPY.access
  const other = otherIssued ? (
    <span className={styles.line}>
      <span>{c.otherIssued(otherIssued.code)}</span>
      <Button size="sm" onClick={() => onOpen(otherIssued.contractId)}>
        {c.openOther(otherIssued.code)}
      </Button>
    </span>
  ) : null

  switch (access.kind) {
    case 'mock':
      return null
    case 'issuer':
      return <span>{c.issuer(code)}</span>
    case 'checking':
      return <span>{c.checking(code)}</span>
    case 'unchecked':
      return (
        <span className={styles.line}>
          <span>{c.unchecked(code)}</span>
          <Button size="sm" onClick={onRetry}>
            {COPY.page.retry}
          </Button>
        </span>
      )
    case 'not-issuer':
      return (
        <>
          {access.issuer ? <ReadOnly code={code} issuer={access.issuer} /> : <span>{c.notIssuer(code)}</span>}
          {other}
        </>
      )
    case 'guest':
      return (
        <>
          {issuer ? <ReadOnly code={code} issuer={issuer} /> : <span>{c.readOnlyUnknown(code)}</span>}
          <Button size="sm" onClick={onConnect}>
            {c.connect}
          </Button>
        </>
      )
  }
}

function ReadOnly({ code, issuer }: { code: string; issuer: string }) {
  return (
    <span className={styles.line}>
      <span>{COPY.access.readOnly(code)}</span>
      <Address value={issuer} length="medium" explorerUrl={explorerAddress(issuer)} explorerLabel={COPY.asset.viewIssuer} copyLabel={COPY.asset.copyIssuer} />
    </span>
  )
}
