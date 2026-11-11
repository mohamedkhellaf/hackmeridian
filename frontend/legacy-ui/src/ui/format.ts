/** Display form of a contract id: "Mock asset" for mock ids (C_MOCK_*), else the first 4 and last 4 characters. */
export function shortContractId(id: string): string {
  if (id.startsWith('C_MOCK_')) return 'Mock asset'
  return id.length > 12 ? `${id.slice(0, 4)}\u2026${id.slice(-4)}` : id
}
