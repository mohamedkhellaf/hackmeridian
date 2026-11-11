import { runsFirstText } from '../model/names'
import type { RecordedStep } from './useReplayable'
import css from './RunsFirst.module.css'

/**
 * Fixture builds: beside a replayed action whose recorded step is not the next one, which steps a press runs
 * first ("Steps 5 to 7 run first: write a call (Maker A), buy a call (Alice), ..."). Nothing otherwise. A press
 * never applies other steps without saying so (ruling F11).
 */
export function RunsFirst({ step, id }: { step: RecordedStep | null; id?: string }) {
  const text = step ? runsFirstText(step.before) : ''
  if (!text) return null
  return (
    <span className={css.root} id={id}>
      {text}
    </span>
  )
}
