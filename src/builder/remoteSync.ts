export type EditorCard<TState = unknown> = {
  id: string
  source?: string
  remoteId?: string
  state: TState
  [key: string]: unknown
}

export function isRemoteCard(card: EditorCard): boolean {
  return card.source === 'mcp' || card.id.startsWith('mcp:')
}

export function discardCachedRemoteCards<T extends EditorCard>(cards: T[]): T[] {
  return cards.filter((card) => !isRemoteCard(card))
}

export function mergeRemoteCards<T extends EditorCard>(current: T[], remote: T[]): T[] {
  return [...remote, ...discardCachedRemoteCards(current)]
}

export function localEditorSnapshot<T extends EditorCard>(
  batch: T[],
  editingId: string | null,
) {
  const localBatch = discardCachedRemoteCards(batch)
  const active = localBatch.find((card) => card.id === editingId) ?? localBatch[0] ?? null
  return {
    batch: localBatch,
    editingId: active?.id ?? null,
    state: active?.state ?? null,
  }
}
