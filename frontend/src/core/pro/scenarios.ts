// The recorded scenarios of packages/risk/fixtures/pro_v0.json, named in plain English. The fixture file names
// them in snake_case and describes them in French; the interface shows these titles and summaries instead.
// A unit test (features/margin/model/model.test.ts) checks that every scenario of the file has an entry here.

export interface ScenarioCopy {
  title: string
  summary: string
}

export const SCENARIO_COPY: Record<string, ScenarioCopy> = {
  happy_path_otm: {
    title: 'Uncovered sale that expires out of the money',
    summary: 'A writer sells a call, withdraws the margin it does not need, and the call expires worthless.',
  },
  insufficient_margin_reverts: {
    title: 'Underfunded buy is refused',
    summary: 'A buy against a writer with too little margin creates nothing and moves no funds.',
  },
  snapshot_bounds: {
    title: 'Limits on the publisher',
    summary: 'The contract refuses snapshots outside its bounds: a mark outside arbitrage limits, the extreme-scenario floor, an old timestamp.',
  },
  liquidation_to_private_taker: {
    title: 'Takeover by another writer',
    summary: 'The price climbs until the account value falls below the liquidation level, and another writer takes the book over.',
  },
  gap_to_vault: {
    title: 'Price gap, takeover by the vault',
    summary: 'The price jumps. A private takeover is refused, the vault takes the book over and carries the shortfall.',
  },
  settlement_pro_rata_deficit: {
    title: 'Settlement with a deficit',
    summary: 'Nobody takes the account over before the deadline. Margin and vault are not enough: holders are paid pro rata and the deficit is shown.',
  },
  limits_and_staleness: {
    title: 'Caps and stale snapshots',
    summary: 'Open-interest caps, a snapshot that is too old, and the settlement window.',
  },
  american_exercise: {
    title: 'Early exercise',
    summary: 'A holder exercises before the deadline at the price of a recent snapshot. A liquidatable writer is taken over first, and a book owned by the vault waits for the deadline.',
  },
  review_regressions: {
    title: 'Review cases',
    summary: 'Roles kept out of the market, the premium floor, withdrawals frozen after the deadline, takeover of a live series, the vault shared pro rata between writers.',
  },
  writer_cash_pro_rata: {
    title: 'One writer short on two series',
    summary: 'An insolvent writer on two series with the same deadline: the cash is shared pro rata, whatever the order of settlement.',
  },
  negative_paths: {
    title: 'Refusals',
    summary: 'Actions the contract refuses: opening margin at buy, a second fill, a cancel by someone else, an expired quote, and more.',
  },
  takeover_debt: {
    title: 'Takeover debt, repaid',
    summary: 'A takeover by the vault leaves a shortfall. It becomes the writer debt and is collected from the writer cash at settlement (final price 112.00).',
  },
  takeover_debt_cash_short: {
    title: 'Takeover debt, cash short',
    summary: 'The same debt when the writer cash cannot cover it (final price 140.00): the rest stays a recorded debt.',
  },
  private_takeover_debt: {
    title: 'Private takeover of an indebted writer',
    summary: 'A writer who already owes the vault is taken over by another writer. The takeover collects what the vault is owed first.',
  },
  margin_boundaries: {
    title: 'Exact boundaries',
    summary: 'Rounding of the opening requirement, an account between the two levels, and a first LP deposit refused while the vault is in loss.',
  },
  taker_oi_cap: {
    title: 'Open-interest cap on a taker',
    summary: 'A writer who takes a book over privately stays under the open-interest cap per writer.',
  },
}

const sentenceCase = (id: string) => {
  const text = id.replace(/_/g, ' ').trim()
  return text ? text[0].toUpperCase() + text.slice(1) : id
}

/** Title and one-line summary of a scenario; an unknown name falls back to its id in sentence case. */
export function scenarioCopy(name: string): ScenarioCopy {
  return SCENARIO_COPY[name] ?? { title: sentenceCase(name), summary: '' }
}

