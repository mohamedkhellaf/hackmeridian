import { useEffect, useRef, useState } from 'react'
import { announce } from './announce'
import { IconButton } from './Button'
import { IconCheck, IconCopy } from './icons'

export interface CopyButtonProps {
  /** The full string to copy, never the shortened form. */
  value: string
  /** Names the thing: "Copy maker address", "Copy transaction hash". */
  label: string
  /** Announced and shown briefly after copying. */
  copiedMessage?: string
  size?: 'md' | 'sm'
  className?: string
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the selection fallback (insecure context, denied permission).
  }
  // The fallback selects text in a hidden field, which takes focus: give it back, or focus would drop to the page
  // body (and, inside a drawer, escape the modal).
  const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.setAttribute('tabindex', '-1')
    area.setAttribute('aria-hidden', 'true')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  } finally {
    before?.focus({ preventScroll: true })
  }
}

/** Copies a value, confirms with a tick for 1.5 s and announces it. A failure is said too, never swallowed. */
export function CopyButton({ value, label, copiedMessage = 'Copied', size = 'sm', className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <IconButton
      className={className}
      size={size}
      label={copied ? copiedMessage : label}
      icon={copied ? <IconCheck /> : <IconCopy />}
      onClick={() => {
        void writeClipboard(value).then((ok) => {
          if (!ok) {
            announce('Could not copy. Select the text and copy it by hand.', 'assertive')
            return
          }
          announce(copiedMessage)
          setCopied(true)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => setCopied(false), 1500)
        })
      }}
    />
  )
}
