import { Link as RouterLink } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { PRO_ENABLED } from '../../core/config'
import { Card, Link } from '../../ui'
import {
  ISSUER_QUOTE_NOTE,
  ISSUER_ROWS,
  ISSUER_TABLE_CAPTION,
  ISSUER_TABLE_HEAD,
  MARGIN_INTRO,
  MARGIN_LINK,
  MARGIN_POINTS,
  MARGIN_TITLE,
  RISKS,
  RISK_ISSUER,
} from './content'
import type { RiskItem } from './content'
import { ProseTable } from './ProseTable'
import css from './Risks.module.css'

function Risk({ risk, children }: { risk: RiskItem; children?: ReactNode }) {
  return (
    <div className={css.risk}>
      <h3 className={css.title}>{risk.title}</h3>
      {risk.paragraphs.map((text) => (
        <p key={text} className={css.text}>
          {text}
        </p>
      ))}
      {children}
    </div>
  )
}

/** What can go wrong: the issuer first, with each action and its effect, then the other limits, then Margin apart. */
export function Risks() {
  return (
    <div className={css.root}>
      <Risk risk={RISK_ISSUER}>
        <div className={css.table}>
          <ProseTable
            caption={ISSUER_TABLE_CAPTION}
            first="wide"
            head={[ISSUER_TABLE_HEAD.action, ISSUER_TABLE_HEAD.effect]}
            rows={ISSUER_ROWS.map((row) => ({ header: row.action, cells: [row.effect] }))}
          />
        </div>
        <p className={css.text}>{ISSUER_QUOTE_NOTE}</p>
      </Risk>
      {RISKS.map((risk) => (
        <Risk key={risk.id} risk={risk} />
      ))}
      <Card className={css.margin} tone="sunken" as="section" aria-labelledby="learn-margin-title">
        <h3 className={css.title} id="learn-margin-title">
          {MARGIN_TITLE}
        </h3>
        <p className={css.marginText}>{MARGIN_INTRO}</p>
        <ul className={css.marginList}>
          {MARGIN_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        {PRO_ENABLED ? (
          <p>
            <Link render={<RouterLink to="/margin" />}>{MARGIN_LINK}</Link>
          </p>
        ) : null}
      </Card>
    </div>
  )
}
