import type { ReactNode } from 'react'
import type { AssetFlags } from '../../core/assetfacts/assetFacts'
import { FLAG_LABELS, POWER_STATE } from '../../core/assetfacts/assetFacts'
import { isReferenceAsset } from '../../core/assets'
import { PRO_ENABLED, config } from '../../core/config'
import { explorerTx } from '../../core/explorer'
import { NO_VALUE, formatList } from '../../core/format'
import { useAssetFacts, useAssets, useOptionsClient } from '../../data'
import { CopyButton, KeyValue, KeyValueItem, RowHeader, Table, TableWrap, TBody, Td, Th, THead, Tr, TxLink, useIsPhone } from '../../ui'
import { ChainId } from './ChainId'
import {
  COVERED_FACTS,
  COVERED_HEADING,
  FIELD,
  FLAGS_KEY,
  FLAG_READING,
  MARGIN_ADMIN,
  MARGIN_FACTS,
  MARGIN_FIXTURE_NOTE,
  MARGIN_HEADING,
  MARGIN_LEDE,
  MARGIN_PUBLISHER,
  NEITHER_CAN,
  NEITHER_LABEL,
  ROLES_HEADING,
  ROLES_MOCK_NOTE,
  ROLES_SEPARATION,
  ROLE_LABEL,
  TOKENS_CAPTION,
  TOKENS_HEADING,
  TOKENS_NOTE,
  TOKEN_COLUMNS,
  UNRECORDED_NOTE,
  flagsFromRecord,
  flagsUnread,
  notImmutableNote,
  otherListedNote,
} from './copy'
import type { RoleCopy } from './copy'
import { COVERED_CONTRACT, MARGIN_CONTRACT, TOKEN_RECORDS, coveredRecordFor, marginRecordFor, findTokenRecord } from '../../core/deployments'
import type { ContractRecord } from '../../core/deployments'
import { FactList } from './FactList'
import type { Fact } from './FactList'
import css from './ContractsAndRoles.module.css'

// ---------------------------------------------------------------------------------------------- pieces

/** A 64-digit hash in full, in mono, with a copy button: a wasm hash has no explorer page, so copy is its use. */
function Hash({ value, what }: { value: string; what: string }) {
  return (
    <span className={css.hash}>
      <span className={css.hashText}>{value}</span>
      <CopyButton value={value} label={`Copy ${what}`} copiedMessage="Hash copied" />
    </span>
  )
}

/**
 * One ruled list per contract, in one order: the contract id in full, then version, wasm hash, deploy
 * transaction and deployer when the app has a record of them, then the facts.
 */
function contractRecord(contractId: string, record: ContractRecord | null, what: string, facts: readonly { label: string; text: string }[]): Fact[] {
  const rows: Fact[] = [{ term: FIELD.contract, text: <ChainId value={contractId} length="full" what={what} /> }]
  if (record) {
    rows.push(
      { term: FIELD.version, text: <span className={css.value}>{record.version}</span> },
      { term: FIELD.wasm, text: <Hash value={record.wasmHash} what={`the wasm hash of ${what}`} /> },
      { term: FIELD.deployTx, text: <TxLink hash={record.deployTx} explorerUrl={explorerTx(record.deployTx)} /> },
      { term: FIELD.deployer, text: <ChainId value={record.deployer} what={`the account that deployed ${what}`} /> },
    )
  }
  for (const fact of facts) rows.push({ term: fact.label, text: fact.text })
  return rows
}

// ---------------------------------------------------------------------------------------------- tokens

type Flags = Pick<AssetFlags, 'authRequired' | 'authRevocable' | 'clawback'>

interface TokenFacts {
  code: string
  role: 'quote' | 'underlying'
  contractId: string
  issuer: string | null
  /** `undefined` while the read is running, `null` when it failed and no record exists. */
  flags: Flags | null | undefined
  /** The flags come from the record, not from a read made now. */
  fromRecord: boolean
  /** The read failed. */
  unread: boolean
  notImmutable: boolean
}

/** A flag's answer in the words of the powers table (core/assetfacts), the same on the About tab and the Issuer page. */
const yesNo = (flag: boolean | undefined, flags: Flags | null | undefined): string =>
  flags === undefined ? FLAG_READING : flags === null || flag === undefined ? NO_VALUE : flag ? POWER_STATE.on : POWER_STATE.off

/** One token of a live build: the issuer flags are read from the network now, with the record as the fallback. */
function useLiveToken(token: { contractId: string; code: string; issuer?: string }, role: 'quote' | 'underlying', enabled: boolean): TokenFacts {
  const facts = useAssetFacts(token, { enabled })
  const record = findTokenRecord(token.contractId)
  const live = facts.data?.record?.flags ?? facts.data?.issuerInfo?.flags
  const failed = enabled && (facts.isError || (facts.data !== undefined && !live))
  const flags: Flags | null | undefined = live ?? (failed || !enabled ? (record?.flags ?? null) : undefined)
  const noneSet = flags ? !flags.authRequired && !flags.authRevocable && !flags.clawback : false
  return {
    code: token.code,
    role,
    contractId: token.contractId,
    issuer: facts.data?.issuer ?? token.issuer ?? record?.issuer ?? null,
    flags,
    fromRecord: !live && !!record && (failed || !enabled),
    unread: failed && !record,
    notImmutable: noneSet && (live ? facts.data?.issuerInfo?.flags.authImmutable === false : record?.note === 'not-immutable'),
  }
}

/** Collects one `TokenFacts` per token through a render prop, so each token keeps its own read. */
function LiveToken({ token, role, children }: { token: { contractId: string; code: string; issuer?: string }; role: 'quote' | 'underlying'; children: (facts: TokenFacts) => ReactNode }) {
  return <>{children(useLiveToken(token, role, true))}</>
}

function recordedTokens(): TokenFacts[] {
  return TOKEN_RECORDS.map((t) => ({
    code: t.code,
    role: t.role,
    contractId: t.contractId,
    issuer: t.issuer,
    flags: t.flags,
    fromRecord: true,
    unread: false,
    notImmutable: t.note === 'not-immutable',
  }))
}

function TokenRow({ token }: { token: TokenFacts }) {
  return (
    <Tr>
      <RowHeader>
        <span className={css.tokenCode}>{token.code}</span> <span className={css.tokenRole}>{ROLE_LABEL[token.role]}</span>
      </RowHeader>
      <Td>
        <ChainId value={token.contractId} length="short" what={`the ${token.code} token contract`} />
      </Td>
      <Td>{token.issuer ? <ChainId value={token.issuer} length="short" what={`the ${token.code} issuer`} /> : NO_VALUE}</Td>
      <Td muted={token.flags?.authRequired === false}>{yesNo(token.flags?.authRequired, token.flags)}</Td>
      <Td muted={token.flags?.authRevocable === false}>{yesNo(token.flags?.authRevocable, token.flags)}</Td>
      <Td muted={token.flags?.clawback === false}>{yesNo(token.flags?.clawback, token.flags)}</Td>
    </Tr>
  )
}

/** A flag answer on a phone: "No" in secondary ink, as in the table. */
function FlagValue({ flag, flags }: { flag: boolean | undefined; flags: Flags | null | undefined }) {
  return <span className={flag === false ? css.flagNo : undefined}>{yesNo(flag, flags)}</span>
}

function TokenBlock({ token }: { token: TokenFacts }) {
  return (
    <li className={css.tokenBlock}>
      <p className={css.tokenHead}>
        <span className={css.tokenCode}>{token.code}</span> <span className={css.tokenRole}>{ROLE_LABEL[token.role]}</span>
      </p>
      <KeyValue variant="plain" figures="sans">
        <KeyValueItem label={TOKEN_COLUMNS.contract}>
          <ChainId value={token.contractId} length="short" what={`the ${token.code} token contract`} />
        </KeyValueItem>
        <KeyValueItem label={TOKEN_COLUMNS.issuer}>{token.issuer ? <ChainId value={token.issuer} length="short" what={`the ${token.code} issuer`} /> : NO_VALUE}</KeyValueItem>
        <KeyValueItem label={FLAG_LABELS.required}>
          <FlagValue flag={token.flags?.authRequired} flags={token.flags} />
        </KeyValueItem>
        <KeyValueItem label={FLAG_LABELS.revocable}>
          <FlagValue flag={token.flags?.authRevocable} flags={token.flags} />
        </KeyValueItem>
        <KeyValueItem label={FLAG_LABELS.clawback}>
          <FlagValue flag={token.flags?.clawback} flags={token.flags} />
        </KeyValueItem>
      </KeyValue>
    </li>
  )
}

/** The footnotes under the token list: what could not be read, and the one fact worth a line per token. */
function tokenNotes(tokens: readonly TokenFacts[], recordedBuild: boolean): string[] {
  const notes: string[] = []
  const fallback = tokens.filter((t) => t.fromRecord && !recordedBuild).map((t) => t.code)
  if (fallback.length) notes.push(flagsFromRecord(formatList(fallback)))
  const unread = tokens.filter((t) => t.unread).map((t) => t.code)
  if (unread.length) notes.push(flagsUnread(formatList(unread)))
  for (const t of tokens) if (t.notImmutable) notes.push(notImmutableNote(t.code))
  return notes
}

function TokenList({ tokens, recordedBuild }: { tokens: readonly TokenFacts[]; recordedBuild: boolean }) {
  const phone = useIsPhone()
  const notes = tokenNotes(tokens, recordedBuild)
  return (
    <>
      {phone ? (
        <ul className={css.tokenBlocks} role="list" aria-label={TOKENS_CAPTION}>
          {tokens.map((t) => (
            <TokenBlock key={t.contractId} token={t} />
          ))}
        </ul>
      ) : (
        <TableWrap label={TOKENS_CAPTION}>
          <Table caption={TOKENS_CAPTION}>
            <THead>
              <Tr>
                <Th>{TOKEN_COLUMNS.token}</Th>
                <Th>{TOKEN_COLUMNS.contract}</Th>
                <Th>{TOKEN_COLUMNS.issuer}</Th>
                <Th>{FLAG_LABELS.required}</Th>
                <Th>{FLAG_LABELS.revocable}</Th>
                <Th>{FLAG_LABELS.clawback}</Th>
              </Tr>
            </THead>
            <TBody>
              {tokens.map((t) => (
                <TokenRow key={t.contractId} token={t} />
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
      <div className={css.tokenNotes}>
        <p>{TOKENS_NOTE}</p>
        <p>{FLAGS_KEY}</p>
        {notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </>
  )
}

/**
 * The tokens of a live build, each with its own read. The render-prop chain keeps one hook call per token
 * whatever the number of listed assets.
 */
function LiveTokens({ tokens }: { tokens: readonly { token: { contractId: string; code: string; issuer?: string }; role: 'quote' | 'underlying' }[] }) {
  const collect = (index: number, acc: TokenFacts[]): ReactNode => {
    if (index >= tokens.length) return <TokenList tokens={acc} recordedBuild={false} />
    const { token, role } = tokens[index]
    return (
      <LiveToken key={token.contractId} token={token} role={role}>
        {(facts) => collect(index + 1, [...acc, facts])}
      </LiveToken>
    )
  }
  return <>{collect(0, [])}</>
}

// ---------------------------------------------------------------------------------------------- roles

function Role({ copy, address }: { copy: RoleCopy; address: string | null }) {
  return (
    <div className={css.role}>
      <div className={css.roleHead}>
        <h4 className={css.roleName}>{copy.role}</h4>
        {address ? <ChainId value={address} what={`the Margin ${copy.role.toLowerCase()}`} /> : null}
      </div>
      <p className={css.roleSummary}>{copy.summary}</p>
    </div>
  )
}

function MarginBlock({ coveredIsMock }: { coveredIsMock: boolean }) {
  const configured = config.proContractId
  const record = configured ? marginRecordFor(configured) : MARGIN_CONTRACT
  const contractId = configured ?? MARGIN_CONTRACT.contractId
  return (
    <section className={css.margin} aria-labelledby="roles-margin">
      <header className={css.blockHead}>
        <h3 id="roles-margin" className={css.blockTitle}>
          {MARGIN_HEADING}
        </h3>
        <p className={css.lede}>{MARGIN_LEDE}</p>
        {!configured && !coveredIsMock ? <p className={css.note}>{MARGIN_FIXTURE_NOTE}</p> : null}
        {configured && !record ? <p className={css.note}>{UNRECORDED_NOTE}</p> : null}
      </header>
      <FactList variant="record" facts={contractRecord(contractId, record, 'the Margin contract', MARGIN_FACTS)} />
      <div className={css.roles}>
        <Role copy={MARGIN_ADMIN} address={record?.admin ?? null} />
        <Role copy={MARGIN_PUBLISHER} address={record?.publisher ?? null} />
      </div>
      <div className={css.neither}>
        <p className={css.listLabel} id="roles-neither">
          {NEITHER_LABEL}
        </p>
        <ul className={css.list} aria-labelledby="roles-neither">
          {NEITHER_CAN.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className={css.separation}>{ROLES_SEPARATION}</p>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------- section

/**
 * "Contracts and roles": the ids, the wasm hashes and who can change what. A mock build calls no contract, so
 * it lists the recorded Testnet deployment and says so; a live build shows the contract it points at.
 */
export function ContractsAndRoles() {
  const { isMock } = useOptionsClient()
  const assets = useAssets({ enabled: !isMock })
  const configured = config.optionsContractId
  const record = isMock ? COVERED_CONTRACT : coveredRecordFor(configured)
  const contractId = isMock ? COVERED_CONTRACT.contractId : (configured ?? COVERED_CONTRACT.contractId)
  // Anyone can list an asset, and each row here costs three reads: the table keeps to the quote token and the
  // reference assets, and counts the rest.
  const listed = assets.data?.underlyings ?? []
  const reference = listed.filter((token) => isReferenceAsset(token.contractId))
  const liveTokens = assets.data ? [{ token: assets.data.quote, role: 'quote' as const }, ...reference.map((token) => ({ token, role: 'underlying' as const }))] : null
  const otherListed = listed.length - reference.length

  return (
    <section className={css.root} aria-labelledby="roles-heading">
      <header className={css.head}>
        <h2 id="roles-heading">{ROLES_HEADING}</h2>
        {isMock ? <p className={css.note}>{ROLES_MOCK_NOTE}</p> : null}
      </header>

      <section className={css.block} aria-labelledby="roles-covered">
        <header className={css.blockHead}>
          <h3 id="roles-covered" className={css.blockTitle}>
            {COVERED_HEADING}
          </h3>
          {!isMock && !record ? <p className={css.note}>{UNRECORDED_NOTE}</p> : null}
        </header>
        <FactList variant="record" facts={contractRecord(contractId, record, 'the Covered contract', COVERED_FACTS)} />
      </section>

      <section className={css.block} aria-labelledby="roles-tokens">
        <h3 id="roles-tokens" className={css.blockTitle}>
          {TOKENS_HEADING}
        </h3>
        {isMock || !liveTokens ? <TokenList tokens={recordedTokens()} recordedBuild={isMock} /> : <LiveTokens tokens={liveTokens} />}
        {!isMock && otherListed > 0 ? <p className={css.otherListed}>{otherListedNote(otherListed)}</p> : null}
      </section>

      {PRO_ENABLED ? <MarginBlock coveredIsMock={isMock} /> : null}
    </section>
  )
}
