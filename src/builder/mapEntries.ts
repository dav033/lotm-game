export type MapEntry = { tags: string; value: string }

// Cada linea no vacia es "etiquetas -> valor"; sin la flecha, la linea entera
// se usa como valor sin etiquetas (mismo espiritu que parseTierText).
export function parseMapEntries(text: string): MapEntry[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf('->')
      if (index === -1) return { tags: '', value: line }
      return { tags: line.slice(0, index).trim(), value: line.slice(index + 2).trim() }
    })
    .filter((entry) => entry.value)
}
