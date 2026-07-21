import {
  agruparCombinaciones,
  type AristaArbol,
  type Combinacion,
  type NodoArbol,
} from './tipos'

type EntradaSubgrafoFase = {
  nodos: readonly NodoArbol[]
  aristas: readonly AristaArbol[]
  phaseElementIds: readonly string[]
  initialElementIds: readonly string[]
  reachableElementIds: readonly string[]
  previousReachableElementIds: readonly string[]
  inactiveRecipeIds: readonly string[]
}

const idNodoElemento = (id: string) => `el:${id}`

export function construirSubgrafoFase({
  nodos,
  aristas,
  phaseElementIds,
  initialElementIds,
  reachableElementIds,
  previousReachableElementIds,
  inactiveRecipeIds,
}: EntradaSubgrafoFase): { nodos: NodoArbol[]; aristas: AristaArbol[] } {
  const porId = new Map(nodos.map((nodo) => [nodo.id, nodo]))
  const propios = new Set(phaseElementIds.map(idNodoElemento))
  const iniciales = new Set(initialElementIds.map(idNodoElemento))
  const heredados = new Set(previousReachableElementIds.map(idNodoElemento))
  const elementosPermitidos = new Set([
    ...reachableElementIds.map(idNodoElemento),
    ...propios,
  ])
  const recetasInactivas = new Set(inactiveRecipeIds)
  const puedeParticipar = (id: string) => {
    const nodo = porId.get(id)
    if (!nodo?.activo) return false
    return nodo.clase !== 'elemento' && nodo.clase !== 'secuencia'
      ? true
      : elementosPermitidos.has(id)
  }

  const combinaciones = agruparCombinaciones([...aristas]).filter((combo) => {
    if (combo.tipo === 'fallo') return false
    if (
      combo.tipo === 'receta' &&
      combo.id.startsWith('grupo:rec:') &&
      recetasInactivas.has(combo.id.slice('grupo:rec:'.length))
    ) {
      return false
    }
    return combo.entradas.every(puedeParticipar)
  })
  const combinacionesPorSalida = new Map<string, Combinacion[]>()
  for (const combo of combinaciones) {
    for (const salida of combo.salidas) {
      if (!puedeParticipar(salida)) continue
      const existentes = combinacionesPorSalida.get(salida) ?? []
      existentes.push(combo)
      combinacionesPorSalida.set(salida, existentes)
    }
  }

  const incluidos = new Set([...propios].filter((id) => porId.has(id)))
  const combinacionesIncluidas = new Map<string, Combinacion>()
  const visitados = new Set<string>()
  const pendientes = [...propios]

  while (pendientes.length > 0) {
    const actual = pendientes.pop()!
    if (visitados.has(actual)) continue
    visitados.add(actual)
    if (iniciales.has(actual) || heredados.has(actual)) continue

    for (const combo of combinacionesPorSalida.get(actual) ?? []) {
      const salidas = combo.salidas.filter(puedeParticipar)
      combinacionesIncluidas.set(combo.id, { ...combo, salidas })
      for (const id of [...combo.entradas, ...salidas]) incluidos.add(id)
      for (const entrada of combo.entradas) {
        if (!iniciales.has(entrada) && !heredados.has(entrada)) pendientes.push(entrada)
      }
    }
  }

  const aristasFase: AristaArbol[] = []
  for (const combo of combinacionesIncluidas.values()) {
    const grupo = combo.id.startsWith('grupo:') ? combo.id.slice('grupo:'.length) : undefined
    for (const de of combo.entradas) {
      for (const a of combo.salidas) {
        aristasFase.push({ de, a, tipo: combo.tipo, via: combo.via, grupo })
      }
    }
  }

  const gradoEntrada = new Map<string, number>()
  const gradoSalida = new Map<string, number>()
  for (const combo of agruparCombinaciones(aristasFase)) {
    for (const de of combo.entradas) gradoSalida.set(de, (gradoSalida.get(de) ?? 0) + 1)
    for (const a of combo.salidas) gradoEntrada.set(a, (gradoEntrada.get(a) ?? 0) + 1)
  }

  return {
    nodos: nodos
      .filter((nodo) => incluidos.has(nodo.id))
      .map((nodo) => ({
        ...nodo,
        inicial: iniciales.has(nodo.id),
        gradoEntrada: gradoEntrada.get(nodo.id) ?? 0,
        gradoSalida: gradoSalida.get(nodo.id) ?? 0,
      })),
    aristas: aristasFase,
  }
}
