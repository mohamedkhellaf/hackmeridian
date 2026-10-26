import { useState } from 'react'
import type { ReactNode } from 'react'
import { Banner, Dialog, Icon } from '../ui'
import { shortAddress } from '../options/format'
import { isMockToken } from '../stellar/tokens'
import type { TokenInfo } from '../options/types'
import { expertAccount, expertContract } from './assetFacts'
import type { HolderStatus } from './assetFacts'
import { useAssetFacts, useHolderStatus } from './useAssetFacts'
import './assetfacts.css'

const TRUSTLINE: Record<HolderStatus | 'error', string> = {
  issuer: 'Issuer',
  authorized: 'Authorized',
  'maintain-only': 'Maintain only',
  unauthorized: 'Not authorized',
  'no-trustline': 'None',
  unfunded: 'None',
  error: 'Unavailable',
}

/** Truncated id in mono linking to stellar.expert, with a copy button. */
function ProofId({ value, label, href }: { value: string; label: string; href: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {},
    )
  }
  return (
    <span className="af-id">
      <a className="ui-mono" href={href} target="_blank" rel="noreferrer" title={value}>
        {shortAddress(value)}
      </a>
      <button type="button" className="af-copy" onClick={copy} aria-label={`Copy ${label}`}>
        <Icon name={copied ? 'check' : 'copy'} size={14} />
      </button>
    </span>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

const onOff = (on: boolean | undefined) => (on == null ? 'Unknown' : on ? 'On' : 'Off')

/** Issuer, contract, flags and the viewer's trustline for one underlying. Usable inline or inside `AssetFactsDialog`. */
export function AssetFactsPanel({ token, me }: { token: TokenInfo; me: string | null }) {
  const mock = isMockToken(token.contractId)
  const facts = useAssetFacts(mock ? '' : token.contractId, token.code)
  const issuer = facts.state === 'ready' ? facts.data.issuer : null
  const holder = useHolderStatus(token.code, issuer, me)

  if (mock) return <p className="af-note">Mock asset. No on-chain facts.</p>
  if (facts.state === 'loading')
    return (
      <p className="af-note" role="status">
        Loading
      </p>
    )
  if (facts.state === 'error') return <Banner tone="warn">Could not read this asset from Testnet: {facts.message}</Banner>
  const d = facts.data
  if (d.native) return <p className="af-note">Native XLM. No issuer and no flags.</p>

  const flags = d.record?.flags ?? d.issuerInfo?.flags ?? null
  const issuerAddr = d.issuer as string
  const canSeize = !!flags && (flags.authRevocable || flags.clawback)

  return (
    <div className="af">
      {d.partial && <Banner tone="warn">Some facts could not be read from Horizon.</Banner>}
      <dl className="ui-kv">
        <Row label="Issuer">
          <ProofId value={issuerAddr} label="issuer address" href={expertAccount(issuerAddr)} />
        </Row>
        <Row label="Asset contract">
          <ProofId value={token.contractId} label="asset contract id" href={expertContract(token.contractId)} />
        </Row>
        <Row label="Auth required">{onOff(flags?.authRequired)}</Row>
        <Row label="Revocable">{onOff(flags?.authRevocable)}</Row>
        <Row label="Clawback">{onOff(flags?.clawback)}</Row>
        {me && <Row label="Trustline">{holder ? TRUSTLINE[holder] : 'Loading'}</Row>}
      </dl>
      {canSeize && <p className="af-note">The issuer can freeze or claw back this asset, which can block settlement.</p>}
    </div>
  )
}

export function AssetFactsDialog({ token, me, onClose }: { token: TokenInfo; me: string | null; onClose: () => void }) {
  return (
    <Dialog title={token.code} onClose={onClose} width={440}>
      <AssetFactsPanel token={token} me={me} />
    </Dialog>
  )
}
