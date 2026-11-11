/** Session flag: the margin default-risk warning was acknowledged in this tab. */
export const MARGIN_ACK_KEY = 'stellsec.margin.ack'

export function hasMarginAck(): boolean {
  try {
    return globalThis.sessionStorage?.getItem(MARGIN_ACK_KEY) === '1'
  } catch {
    return false
  }
}

export function setMarginAck(): void {
  try {
    globalThis.sessionStorage?.setItem(MARGIN_ACK_KEY, '1')
  } catch {
    // Storage blocked: the warning shows again next time.
  }
}

/** Where Continue lands: the margin section's Trade screen. */
export const MARGIN_TRADE_HREF = '#/pro/trade'
