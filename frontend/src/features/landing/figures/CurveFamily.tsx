import { useMemo } from 'react'
import { curveFamily } from './curveFamily'
import css from './CurveFamily.module.css'

export interface CurveFamilyProps {
  width?: number
  height?: number
  className?: string
}

/** The decorative plate. Hidden from assistive technology: it carries no information. */
export function CurveFamily({ width = 640, height = 300, className }: CurveFamilyProps) {
  const curves = useMemo(() => curveFamily({ width, height }), [width, height])
  return (
    <svg
      className={className ? `${css.plate} ${className}` : css.plate}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMaxYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      {curves.map((curve, i) => (
        <path key={i} d={curve.d} className={curve.payoff ? css.payoff : css.curve} opacity={curve.payoff ? undefined : curve.opacity} />
      ))}
    </svg>
  )
}
