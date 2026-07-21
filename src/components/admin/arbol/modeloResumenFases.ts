import {
  ORDEN_PANEL,
  agruparCombinaciones,
  type AristaArbol,
  type NodoArbol,
} from './tipos'

export const ID_POOL_FASES = '__pool_sin_fase__'

export type FaseParaResumen = {
  id: string
  name: string
  sortOrder: number
  unlockAtDiscoveryCount: number
  advancementRuleSummary?: string
  isActive: boolean
  ownElementIds: readonly string[]
  ownRitualIds: readonly string[]
}

export type AvanceParaResumen = {
  id: string
  targetElementId: string
}

export type RecetaParaResumen = {
  id: string
  isActive: boolean
}

export type ConteosFase = {
  elementos: number
  secuencias: number
  avances: number
  rituales: number
  total: number
}

export type NodoResumenFase = {
  id: string
  nombre: string
  sortOrder: number | null
  unlockAtDiscoveryCount: number | null
  advancementRuleSummary: string | null
  isActive: boolean
  esPool: boolean
  conteos: ConteosFase
}

export type InteraccionEntreFases = {
  origenId: string
  destinoId: string
  total: number
  tipos: Array<{ tipo: AristaArbol['tipo']; cantidad: number }>
}

type EntradaPropiedadNodos = {
  fases: readonly FaseParaResumen[]
  avances: readonly AvanceParaResumen[]
  nodos: readonly NodoArbol[]
}

type EntradaResumenFases = EntradaPropiedadNodos & {
  recetas: readonly RecetaParaResumen[]
  aristas: readonly AristaArbol[]
}

const compararFases = (a: FaseParaResumen, b: FaseParaResumen) =>
  a.sortOrder - b.sortOrder ||
  a.name.localeCompare(b.name, 'es') ||
  a.id.localeCompare(b.id)

const idSinPrefijo = (id: string, prefijo: string) =>
  id.startsWith(prefijo) ? id.slice(prefijo.length) : null

export function asignarPropiedadNodos({
  fases,
  avances,
  nodos,
}: EntradaPropiedadNodos): Map<string, string> {
  const elementoAFase = new Map<string, string>()
  const ritualAFase = new Map<string, string>()

  for (const fase of [...fases].sort(compararFases)) {
    for (const id of fase.ownElementIds) {
      if (!elementoAFase.has(id)) elementoAFase.set(id, fase.id)
    }
    for (const id of fase.ownRitualIds) {
      if (!ritualAFase.has(id)) ritualAFase.set(id, fase.id)
    }
  }

  const avancePorId = new Map(avances.map((avance) => [avance.id, avance]))
  const propiedad = new Map<string, string>()

  for (const nodo of nodos) {
    let faseId: string | undefined
    if (nodo.clase === 'elemento' || nodo.clase === 'secuencia') {
      const elementoId = idSinPrefijo(nodo.id, 'el:')
      faseId = elementoId ? elementoAFase.get(elementoId) : undefined
    } else if (nodo.clase === 'ritual') {
      const ritualId = idSinPrefijo(nodo.id, 'rit:')
      faseId = ritualId ? ritualAFase.get(ritualId) : undefined
    } else {
      const avanceId = idSinPrefijo(nodo.id, 'av:')
      const objetivoId = avanceId ? avancePorId.get(avanceId)?.targetElementId : undefined
      faseId = objetivoId ? elementoAFase.get(objetivoId) : undefined
    }
    propiedad.set(nodo.id, faseId ?? ID_POOL_FASES)
  }

  return propiedad
}

const conteosVacios = (): ConteosFase => ({
  elementos: 0,
  secuencias: 0,
  avances: 0,
  rituales: 0,
  total: 0,
})

export function construirResumenFases({
  fases,
  avances,
  recetas,
  nodos,
  aristas,
}: EntradaResumenFases): {
  fases: NodoResumenFase[]
  interacciones: InteraccionEntreFases[]
} {
  const fasesOrdenadas = [...fases].sort(compararFases)
  const propiedad = asignarPropiedadNodos({ fases: fasesOrdenadas, avances, nodos })
  const conteosPorFase = new Map(
    fasesOrdenadas.map((fase) => [fase.id, conteosVacios()] as const),
  )
  const nodosActivos = new Set(nodos.filter((nodo) => nodo.activo).map((nodo) => nodo.id))
  let usaPool = false

  for (const nodo of nodos) {
    if (!nodo.activo) continue
    const faseId = propiedad.get(nodo.id) ?? ID_POOL_FASES
    if (faseId === ID_POOL_FASES) usaPool = true
    const conteos = conteosPorFase.get(faseId) ?? conteosVacios()
    if (nodo.clase === 'elemento') conteos.elementos += 1
    else if (nodo.clase === 'secuencia') conteos.secuencias += 1
    else if (nodo.clase === 'avance') conteos.avances += 1
    else conteos.rituales += 1
    conteos.total += 1
    conteosPorFase.set(faseId, conteos)
  }

  const resumenFases: NodoResumenFase[] = fasesOrdenadas.map((fase) => ({
    id: fase.id,
    nombre: fase.name,
    sortOrder: fase.sortOrder,
    unlockAtDiscoveryCount: fase.unlockAtDiscoveryCount,
    advancementRuleSummary:
      fase.advancementRuleSummary ?? `Descubrir ${fase.unlockAtDiscoveryCount} elementos`,
    isActive: fase.isActive,
    esPool: false,
    conteos: conteosPorFase.get(fase.id) ?? conteosVacios(),
  }))
  if (usaPool) {
    resumenFases.push({
      id: ID_POOL_FASES,
      nombre: 'Pool / sin fase',
      sortOrder: null,
      unlockAtDiscoveryCount: null,
      advancementRuleSummary: null,
      isActive: true,
      esPool: true,
      conteos: conteosPorFase.get(ID_POOL_FASES) ?? conteosVacios(),
    })
  }

  const recetasInactivas = new Set(
    recetas.filter((receta) => !receta.isActive).map((receta) => `grupo:rec:${receta.id}`),
  )
  const acumuladas = new Map<string, {
    origenId: string
    destinoId: string
    tipos: Map<AristaArbol['tipo'], number>
  }>()

  for (const combo of agruparCombinaciones([...aristas])) {
    if (recetasInactivas.has(combo.id)) continue
    // Las entradas de un grupo son conjuntas; una entrada inactiva invalida
    // la combinación, mientras una salida secundaria inactiva puede omitirse.
    if (!combo.entradas.every((id) => nodosActivos.has(id))) continue
    const salidasActivas = combo.salidas.filter((id) => nodosActivos.has(id))
    if (salidasActivas.length === 0) continue

    const origenes = new Set(combo.entradas.map((id) => propiedad.get(id) ?? ID_POOL_FASES))
    const destinos = new Set(salidasActivas.map((id) => propiedad.get(id) ?? ID_POOL_FASES))
    for (const origenId of origenes) {
      for (const destinoId of destinos) {
        if (origenId === destinoId) continue
        const clave = `${origenId}\0${destinoId}`
        const acumulada = acumuladas.get(clave) ?? {
          origenId,
          destinoId,
          tipos: new Map<AristaArbol['tipo'], number>(),
        }
        acumulada.tipos.set(combo.tipo, (acumulada.tipos.get(combo.tipo) ?? 0) + 1)
        acumuladas.set(clave, acumulada)
      }
    }
  }

  const ordenPorId = new Map(resumenFases.map((fase, indice) => [fase.id, indice]))
  const interacciones = [...acumuladas.values()]
    .map(({ origenId, destinoId, tipos }) => {
      const tiposOrdenados = [...tipos]
        .map(([tipo, cantidad]) => ({ tipo, cantidad }))
        .sort((a, b) => ORDEN_PANEL[a.tipo] - ORDEN_PANEL[b.tipo] || a.tipo.localeCompare(b.tipo))
      return {
        origenId,
        destinoId,
        total: tiposOrdenados.reduce((total, tipo) => total + tipo.cantidad, 0),
        tipos: tiposOrdenados,
      }
    })
    .sort((a, b) =>
      (ordenPorId.get(a.origenId) ?? Number.MAX_SAFE_INTEGER) -
        (ordenPorId.get(b.origenId) ?? Number.MAX_SAFE_INTEGER) ||
      (ordenPorId.get(a.destinoId) ?? Number.MAX_SAFE_INTEGER) -
        (ordenPorId.get(b.destinoId) ?? Number.MAX_SAFE_INTEGER) ||
      a.origenId.localeCompare(b.origenId) ||
      a.destinoId.localeCompare(b.destinoId),
    )

  return { fases: resumenFases, interacciones }
}
