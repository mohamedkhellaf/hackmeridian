import { useEffect, useState } from 'react'
import { SCENES, stepScene } from './scenes'
import './demo.css'

const active = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('present') === '1'

/** Screen-recording aid. Renders nothing and changes nothing unless the URL has ?present=1. */
export function PresentationMode() {
  const [on] = useState(active)
  const [index, setIndex] = useState(0)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!on) return
    document.body.classList.add('present')
    return () => document.body.classList.remove('present')
  }, [on])

  useEffect(() => {
    if (!on) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (e.key === 'ArrowRight') setIndex((i) => stepScene(i, 1))
      else if (e.key === 'ArrowLeft') setIndex((i) => stepScene(i, -1))
      else if (e.key === 'h' || e.key === 'H') setHidden((h) => !h)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [on])

  if (!on || hidden) return null
  const s = SCENES[index]
  return (
    <div className="present-caption" role="status" aria-live="polite">
      <span className="present-title">{s.title}</span>
      <span className="present-meta">
        {index + 1}/{SCENES.length}
      </span>
    </div>
  )
}
