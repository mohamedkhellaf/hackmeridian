import { explorerAddress } from '../../core/explorer'
import { Address, Button, Callout } from '../../ui'
import { COPY } from './copy'
import type { Access } from './model'
import styles from './AccessNotice.module.css'

export interface AccessNoticeProps {
  access: Access
  code: string
  onConnect: () => void
}

/**
 * Says who must be connected to act. A guest gets "Connect wallet"; a wallet that is not the issuer is told whose
 * account is needed. The issuer needs no notice: the page header says who is connected.
 */
export function AccessNotice({ access, code, onConnect }: AccessNoticeProps) {
  if (access.kind === 'guest') {
    return (
      <Callout
        variant="info"
        title={COPY.access.guestTitle}
        actions={
          <Button onClick={onConnect}>
            {COPY.access.connect}
          </Button>
        }
      >
        <p>{COPY.access.guestBody(code)}</p>
      </Callout>
    )
  }
  if (access.kind === 'not-issuer') {
    return (
      <Callout variant="warning" title={COPY.access.notIssuerTitle(code)}>
        {access.issuer ? (
          <>
            <p className={styles.line}>
              <span>{COPY.access.notIssuerIssuedBy(code)}</span>
              <Address value={access.issuer} length="medium" explorerUrl={explorerAddress(access.issuer)} explorerLabel={COPY.asset.viewIssuer} copyLabel={COPY.asset.copyIssuer} />
            </p>
            <p className={styles.line}>
              <span>{COPY.access.notIssuerYouAre}</span>
              <Address value={access.connected} length="medium" you copyLabel={null} />
            </p>
            <p>{COPY.access.notIssuerFix}</p>
          </>
        ) : (
          <p>{COPY.access.notIssuerUnknown(code)}</p>
        )}
      </Callout>
    )
  }
  return null
}
