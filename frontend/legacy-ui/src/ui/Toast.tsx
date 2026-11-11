import { useEffect } from 'react'
import { explorerTx } from '../config'
import { Icon } from './Icon'

/** Result of a transaction, shown as a toast. */
export type Notice = { kind: 'ok'; text: string; hash: string; mock: boolean } | { kind: 'err'; text: string }

/**
 * One-line transaction notice. Success shows the label and the tx hash (stellar.expert link, or "(mock)" for the
 * in-memory client) and dismisses after 6s. Errors stay until dismissed. Any notice clears on route change.
 * It sits below dialogs (z-index), bottom right on desktop and under the top bar on phones.
 */
export function NoticeToast({ notice, onDismiss }: { notice: Notice | null; onDismiss: () => void }) {
  useEffect(() => {
    if (notice?.kind !== 'ok') return
    const t = window.setTimeout(onDismiss, 6000)
    return () => window.clearTimeout(t)
  }, [notice, onDismiss])

  useEffect(() => {
    if (!notice) return
    window.addEventListener('hashchange', onDismiss)
    return () => window.removeEventListener('hashchange', onDismiss)
  }, [notice, onDismiss])

  if (!notice) return null
  const ok = notice.kind === 'ok'
  return (
    <div className="ui-toast-region">
      <div className={`ui-toast ui-toast--${ok ? 'ok' : 'err'}`} role={ok ? 'status' : 'alert'}>
        <div className="ui-toast-body">
          {ok ? (
            <>
              <strong>{notice.text}</strong>{' '}
              <span className="ui-toast-tx">
                tx{' '}
                {notice.mock ? (
                  <span className="ui-mono">{notice.hash.slice(0, 12)}… (mock)</span>
                ) : (
                  <a className="ui-mono" href={explorerTx(notice.hash)} target="_blank" rel="noreferrer">
                    {notice.hash.slice(0, 12)}…
                  </a>
                )}
              </span>
            </>
          ) : (
            <>
              <strong>Transaction failed.</strong> <span className="ui-toast-msg">{notice.text}</span>
            </>
          )}
        </div>
        <button type="button" className="ui-toast-close" aria-label="Dismiss notification" onClick={onDismiss}>
          <Icon name="close" size={14} />
        </button>
      </div>
    </div>
  )
}
