import { useState } from 'react'
import type { ReactNode } from 'react'
import { Banner, Dialog, Icon, Mono, StatusDot, Tag } from '../ui'
import { shortAddress } from '../options/format'
import { isMockToken } from '../stellar/tokens'
import type { TokenInfo } from '../options/types'
import { describeFlags, expertAccount, expertAsset, expertContract } from './assetFacts'
import type { HolderStatus } from './assetFacts'
import { useAssetFacts, useHolderStatus } from './useAssetFacts'
import './assetfacts.css'

const HOLDER_TEXT: Record<HolderStatus | 'error', { tone: 'ok' | 'warn' | 'neutral'; text: string }> = {
  issuer: { tone: 'neutral', text: 'You are the issuer of this asset.' },
  authorized: { tone: 'ok', text: 'Authorized: you can hold and move this token.' },
  'maintain-only': { tone: 'warn', text: 'Maintain-liabilities only: you can keep existing offers but not receive more.' },
  unauthorized: { tone: 'warn', text: 'Not authorized: the issuer has not approved your trustline.' },
  'no-trustline': { tone: 'warn', text: 'No trustline: add one before you can hold this token.' },
  unfunded: { tone: 'warn', text: 'Your account is not funded on Testnet yet.' },
  error: { tone: 'neutral', text: 'Could not check your authorization right now.' },
}

function CopyId({ value, label, href }: { value: string; label: string; href: string }) {
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
      <Mono title={value}>{shortAddress(value)}</Mono>
      <button type="button" className="af-icon-btn" onClick={copy} aria-label={`Copy ${label}`}>
        <Icon name={copied ? 'check' : 'copy'} size={14} />
      </button>
      <a className="af-icon-btn" href={href} target="_blank" rel="noreferrer" aria-label={`${label} on stellar.expert`}>
        <Icon name="external" size={14} />
      </a>
    </span>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="af-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** Compact issuer-control summary for one underlying. Usable inline or inside `AssetFactsDialog`. */
export function AssetFactsPanel({ token, me }: { token: TokenInfo; me: string | null }) {
  const mock = isMockToken(token.contractId)
  const facts = useAssetFacts(mock ? '' : token.contractId, token.code)
  const issuer = facts.state === 'ready' ? facts.data.issuer : null
  const holder = useHolderStatus(token.code, issuer, me)

  if (mock) {
    return <p className="af-note">Mock asset — no on-chain facts.</p>
  }
  if (facts.state === 'loading') return <p className="af-note" role="status">Loading asset facts…</p>
  if (facts.state === 'error') {
    return <Banner tone="warn">Could not read this asset from Testnet ({facts.message}). Try again in a moment.</Banner>
  }
  const d = facts.data
  if (d.native) {
    return <p className="af-note">Native XLM has no issuer: no authorization flags, no clawback.</p>
  }
  const flags = describeFlags(d.record?.flags ?? d.issuerInfo?.flags ?? { authRequired: false, authRevocable: false, clawback: false, authImmutable: false })
  const known = Boolean(d.record ?? d.issuerInfo)
  const t = d.record?.trustlines
  const issuerAddr = d.issuer as string

  return (
    <div className="af">
      {d.partial && <Banner tone="warn">Some on-chain facts could not be loaded; what is shown may be incomplete.</Banner>}
      <dl className="af-list">
        <Row label="Asset">
          <Mono>{d.code}</Mono>
        </Row>
        <Row label="Issuer">
          <CopyId value={issuerAddr} label="issuer address" href={expertAsset(d.code, issuerAddr)} />
        </Row>
        <Row label="Contract (SAC)">
          <CopyId value={token.contractId} label="contract id" href={expertContract(token.contractId)} />
        </Row>
        {d.issuerInfo && (
          <Row label="Issuer account">
            {d.issuerInfo.locked ? (
              <>
                <Tag tone="ok">Locked</Tag>
                <span className="af-sub">No key can sign for the issuer, so no new supply can be minted.</span>
              </>
            ) : (
              <>
                <Tag tone="warn">Not locked</Tag>
                <span className="af-sub">
                  The issuer can still sign: more supply can be issued and flags may change
                  {d.issuerInfo.homeDomain ? ` (home domain ${d.issuerInfo.homeDomain})` : ''}.
                </span>
              </>
            )}
            <a className="af-link" href={expertAccount(issuerAddr)} target="_blank" rel="noreferrer">
              View issuer <Icon name="external" size={12} />
            </a>
          </Row>
        )}
        {t && (
          <Row label="Trustlines">
            <span className="ui-mono">
              {t.authorized} authorized / {t.total} total
            </span>
            {(t.maintainOnly > 0 || t.unauthorized > 0) && (
              <span className="af-sub">
                {t.maintainOnly} maintain-only, {t.unauthorized} unauthorized
              </span>
            )}
          </Row>
        )}
        {me && holder && (
          <Row label="Your status">
            <StatusDot tone={HOLDER_TEXT[holder].tone} /> <span>{HOLDER_TEXT[holder].text}</span>
          </Row>
        )}
      </dl>

      <h3 className="af-h">Issuer controls</h3>
      {known ? (
        <ul className="af-flags">
          {flags.map((f) => (
            <li key={f.key} className="af-flag">
              <Tag tone={!f.on ? 'ok' : f.key === 'required' ? 'neutral' : 'warn'}>{f.on ? 'On' : 'Off'}</Tag>
              <div>
                <b>{f.label}</b>
                <span className="af-sub">{f.consequence}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="af-note">No flag data available for this asset yet.</p>
      )}
    </div>
  )
}

export function AssetFactsDialog({ token, me, onClose }: { token: TokenInfo; me: string | null; onClose: () => void }) {
  return (
    <Dialog title={`${token.code} asset facts`} onClose={onClose} width={520}>
      <AssetFactsPanel token={token} me={me} />
    </Dialog>
  )
}
