export type PestanaArbol = 'explorador' | 'caminos' | 'fases' | 'mapa-fases' | 'mapa'

export function normalizarPestanaArbol(value: unknown): PestanaArbol {
  const tab = Array.isArray(value) ? value[0] : value
  return tab === 'caminos' || tab === 'fases' || tab === 'mapa-fases' || tab === 'mapa'
    ? tab
    : 'explorador'
}
