/**
 * True when a page's own code could not be fetched: the connection dropped, or a newer version of the app was
 * published and the old file names are gone. Each browser words it differently.
 */
export function isChunkLoadError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /dynamically imported module|importing a module script failed|error loading dynamically imported|ChunkLoadError|unable to preload css/i.test(text)
}

/** The text of an error for the "Technical detail" block: the message only, capped, never a stack. */
export function errorDetail(error: unknown): string {
  const text = error instanceof Error ? error.message || error.name : String(error)
  return text.length > 600 ? `${text.slice(0, 600)}…` : text
}
