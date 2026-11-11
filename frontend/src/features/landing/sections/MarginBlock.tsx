import { Link as RouterLink } from '@tanstack/react-router'
import { PRO_ENABLED } from '../../../core/config'
import { Glyph, Link } from '../../../ui'
import { DOC_LINKS, MARGIN, SECTION } from '../copy'
import css from './MarginBlock.module.css'

/**
 * Margin, fenced off from everything else on the page: its own ground, a dashed edge, its own wording. None of
 * the covered contract's facts appear inside it, and nothing in it is called fully collateralized. The fence is
 * the separation; there is no "experimental" tag on it (brief 0.1).
 */
export function MarginBlock() {
  return (
    <section id={SECTION.margin} className={css.section} aria-labelledby="margin-heading">
      <div className={css.fence} data-testid="margin-block">
        <h2 id="margin-heading" className={css.heading}>
          <Glyph name="margin" size={24} className={css.glyph} />
          {MARGIN.heading}
        </h2>
        <div className={css.text}>
          <p>{MARGIN.body}</p>
          <p>{MARGIN.isolation}</p>
          <p className={css.links}>
            {PRO_ENABLED ? <Link render={<RouterLink to="/margin" />}>{MARGIN.open}</Link> : <span className={css.off}>{MARGIN.off}</span>}
            <Link external href={DOC_LINKS.marginEvidence}>
              {MARGIN.evidence}
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
