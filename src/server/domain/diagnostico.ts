// Herramientas de diagnóstico del árbol de combinaciones. Funciones puras
// sobre datos ya cargados: fáciles de probar y sin atadura a la base de datos.

// ---------------------------------------------------------------------------
// Tipos de entrada
// ---------------------------------------------------------------------------

export type DiagElement = {
  id: string
  slug: string
  name: string
  type: string
  isStarter: boolean
  isActive: boolean
  unlockedByType: string | null
  unlockedBySequenceNumber: number | null
  requiredElementIds: string[]
}

// Desencadenante espontáneo: `elementId` se desbloquea al descubrir `triggerId`.
export type DiagTrigger = { elementId: string; triggerId: string }

export type DiagRecipe = {
  id: string
  inputKey: string
  isActive: boolean
  outputElementIds: string[]
  ingredients: { elementId: string; quantity: number }[]
}

export type DiagSequence = {
  id: string
  elementId: string
  pathwayId: string
  number: number
  name: string
  isActive: boolean
}

export type DiagRitual = {
  id: string
  advanceId: string
  name: string
  inputKey: string
  isActive: boolean
  requiredSequenceNumber: number
  ingredients: { elementId: string; quantity: number }[]
  failureOutputIds: string[]
}

export type DiagAdvance = {
  id: string
  internalName: string
  inputKey: string
  isActive: boolean
  sourceSequenceId: string
  targetSequenceId: string
  ingredients: { elementId: string; quantity: number }[]
  rituals: DiagRitual[]
}

// ---------------------------------------------------------------------------
// Tipos de salida
// ---------------------------------------------------------------------------

export type DiagRouteKind =
  | 'starter'
  | 'spontaneous'
  | 'recipe'
  | 'advance'
  | 'ritual-failure'
  | 'unreachable'

export type DiagBestRoute = {
  kind: DiagRouteKind
  label: string
  detail: string
  id?: string
}

export type DiagDifficulty =
  | 'trivial'
  | 'easy'
  | 'moderate'
  | 'hard'
  | 'extreme'
  | 'impossible'

export const DIFICULTAD_LABELS: Record<DiagDifficulty, string> = {
  trivial: 'Trivial',
  easy: 'Fácil',
  moderate: 'Moderada',
  hard: 'Difícil',
  extreme: 'Extrema',
  impossible: 'Inalcanzable',
}

export const DIFICULTAD_ORDEN: Record<DiagDifficulty, number> = {
  impossible: 100,
  extreme: 5,
  hard: 4,
  moderate: 3,
  easy: 2,
  trivial: 1,
}

export type DiagParticipation = {
  recipes: number
  advances: number
  rituals: number
  spontaneous: number
  total: number
}

export type DiagElementResult = {
  elementId: string
  reachable: boolean
  depth: number | null
  cost: number | null
  alternatives: number
  routeSummary: string
  participation: DiagParticipation
  bestRoute: DiagBestRoute
  routeRequiresRitual: boolean
  difficulty: DiagDifficulty
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function totalQuantity(items: { quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

function idsUnicos(ids: string[]): string[] {
  return [...new Set(ids)]
}

function costoConjunto(
  ids: string[],
  costos: Map<string, number | null>,
): number | null {
  let total = 0
  for (const id of idsUnicos(ids)) {
    const c = costos.get(id)
    if (c == null) return null
    total += c
  }
  return total
}

function profundidadConjunto(
  ids: string[],
  profundidades: Map<string, number | null>,
): number | null {
  let max = -1
  for (const id of idsUnicos(ids)) {
    const p = profundidades.get(id)
    if (p == null) return null
    if (p > max) max = p
  }
  return max === -1 ? 0 : max
}

function dificultadDe(
  costo: number | null,
  profundidad: number | null,
  requiereRitual: boolean,
  alternativas: number,
  alcanzable: boolean,
  tipoRuta: DiagRouteKind,
): DiagDifficulty {
  if (!alcanzable) return 'impossible'
  if (tipoRuta === 'starter') return 'trivial'
  const penalizacionAlternativas = alternativas <= 1 ? 1 : 0
  const bonusProfundidad = (profundidad ?? 0) > 3 ? 1 : 0
  const score =
    (costo ?? 0) + (requiereRitual ? 3 : 0) + bonusProfundidad + penalizacionAlternativas
  if (score <= 1) return 'trivial'
  if (score <= 3) return 'easy'
  if (score <= 6) return 'moderate'
  if (score <= 10) return 'hard'
  return 'extreme'
}

function resumenRutas(
  recetasValidas: number,
  alternativasAvance: number,
  alternativasRitual: number,
  alternativasEspontaneas: number,
  alternativasFallo: number,
  esInicial: boolean,
): string {
  const partes: string[] = []
  if (esInicial) partes.push('Inicial')
  if (recetasValidas > 0) partes.push(`${recetasValidas} receta${recetasValidas === 1 ? '' : 's'}`)
  if (alternativasAvance > 0 && alternativasRitual === 0)
    partes.push(`${alternativasAvance} avance${alternativasAvance === 1 ? '' : 's'}`)
  if (alternativasRitual > 0)
    partes.push(`${alternativasRitual} ritual${alternativasRitual === 1 ? '' : 's'}`)
  if (alternativasEspontaneas > 0)
    partes.push(`${alternativasEspontaneas} desbloqueo${alternativasEspontaneas === 1 ? '' : 's'}`)
  if (alternativasFallo > 0)
    partes.push(`${alternativasFallo} fallo${alternativasFallo === 1 ? '' : 's'}`)
  return partes.length > 0 ? partes.join(' · ') : '—'
}

export function resumenParticipacion(p: DiagParticipation): string {
  return `${p.total} (R:${p.recipes} A:${p.advances} Ri:${p.rituals} D:${p.spontaneous})`
}

function compararRutas(
  a: { costo: number | null; profundidad: number | null },
  b: { costo: number | null; profundidad: number | null },
): boolean {
  // a es mejor que b? Igualdad no mejora: evita oscilaciones por tie-break.
  const ca = a.costo ?? Infinity
  const cb = b.costo ?? Infinity
  if (ca !== cb) return ca < cb
  const pa = a.profundidad ?? Infinity
  const pb = b.profundidad ?? Infinity
  return pa < pb
}

// ---------------------------------------------------------------------------
// Análisis principal
// ---------------------------------------------------------------------------

/**
 * Análisis completo de progresión. Devuelve un resultado por cada elemento
 * activo (los inactivos aparecen como inalcanzables sin métricas).
 *
 * El `costo` es una estimación mínima de operaciones de combinación, no un
 * valor exacto: cada receta suma +1, crear un avance +1 y aplicarlo +1; los
 * rituales no suman operación pero añaden requisitos de preparación. La
 * profundidad es el número de pasos encadenados de la ruta más corta.
 */
export function analizarProgresion(
  elements: DiagElement[],
  recipes: DiagRecipe[],
  sequences: DiagSequence[],
  advances: DiagAdvance[],
  triggers: DiagTrigger[] = [],
): Map<string, DiagElementResult> {
  const activos = elements.filter((e) => e.isActive)
  const activosPorId = new Map(activos.map((e) => [e.id, e]))

  const secuenciasActivas = sequences.filter((s) => s.isActive)
  const secuenciaPorId = new Map(secuenciasActivas.map((s) => [s.id, s]))

  // Avance activo: avance activo + caminos (secuencias) activos.
  const avancesActivos = advances.filter(
    (a) =>
      a.isActive &&
      secuenciaPorId.has(a.sourceSequenceId) &&
      secuenciaPorId.has(a.targetSequenceId),
  )

  // Salidas de receta protegidas: una secuencia destino de un avance activo.
  const salidasProtegidas = new Set<string>(
    avancesActivos
      .map((a) => secuenciaPorId.get(a.targetSequenceId)?.elementId)
      .filter((id): id is string => id != null),
  )

  // Recetas válidas: activas, exactamente 2 unidades y con al menos una salida
  // activa y no protegida.
  const recetasValidas = recipes.filter((r) => {
    if (!r.isActive) return false
    if (totalQuantity(r.ingredients) !== 2) return false
    return r.outputElementIds.some(
      (oid) => activosPorId.has(oid) && !salidasProtegidas.has(oid),
    )
  })

  // Rituales activos: ritual activo y su avance padre activo.
  const ritualesActivos = avancesActivos.flatMap((a) =>
    a.rituals.filter((r) => r.isActive),
  )

  // Mapas de resultados mutables durante la relajación.
  const alcanzable = new Map<string, boolean>()
  const costo = new Map<string, number | null>()
  const profundidad = new Map<string, number | null>()
  const mejorRuta = new Map<string, DiagBestRoute>()
  const requiereRitual = new Map<string, boolean>()

  for (const e of activos) {
    alcanzable.set(e.id, false)
    costo.set(e.id, null)
    profundidad.set(e.id, null)
  }

  for (const e of activos) {
    if (e.isStarter) {
      alcanzable.set(e.id, true)
      costo.set(e.id, 0)
      profundidad.set(e.id, 0)
      mejorRuta.set(e.id, {
        kind: 'starter',
        label: 'Elemento inicial',
        detail: 'starter',
      })
      requiereRitual.set(e.id, false)
    }
  }

  // Mapas de triggers espontáneos.
  const triggersPorElemento = new Map<string, DiagTrigger[]>()
  for (const t of triggers) {
    const lista = triggersPorElemento.get(t.elementId) ?? []
    lista.push(t)
    triggersPorElemento.set(t.elementId, lista)
  }

  // Secuencias alcanzables por número (se actualiza en cada iteración).
  function secuenciasAlcanzablesPorNumero(numero: number): DiagSequence[] {
    return secuenciasActivas.filter(
      (s) => s.number === numero && (alcanzable.get(s.elementId) ?? false),
    )
  }

  function intentarActualizar(
    elementId: string,
    candidato: {
      costo: number | null
      profundidad: number | null
      ruta: DiagBestRoute
      ritual: boolean
    },
  ): boolean {
    const actual = {
      costo: costo.get(elementId) ?? null,
      profundidad: profundidad.get(elementId) ?? null,
    }
    const actualAlcanzable = alcanzable.get(elementId) ?? false
    const candidatoAlcanzable = candidato.costo != null && candidato.profundidad != null

    if (!candidatoAlcanzable) return false
    if (!actualAlcanzable || compararRutas(candidato, actual)) {
      alcanzable.set(elementId, true)
      costo.set(elementId, candidato.costo)
      profundidad.set(elementId, candidato.profundidad)
      mejorRuta.set(elementId, candidato.ruta)
      requiereRitual.set(elementId, candidato.ritual)
      return true
    }
    return false
  }

  let cambiado = true
  while (cambiado) {
    cambiado = false

    // 1. Desbloqueos espontáneos (por tipo, trigger o número de secuencia).
    for (const e of activos) {
      const opciones: {
        costo: number | null
        profundidad: number | null
        ruta: DiagBestRoute
      }[] = []

      if (e.unlockedByType) {
        const detonadores = activos.filter(
          (x) =>
            x.id !== e.id &&
            x.type === e.unlockedByType &&
            (alcanzable.get(x.id) ?? false),
        )
        for (const d of detonadores) {
          const c = costo.get(d.id)
          const p = profundidad.get(d.id)
          if (c == null || p == null) continue
          opciones.push({
            costo: c,
            profundidad: p + 1,
            ruta: {
              kind: 'spontaneous',
              label: `Desbloqueo por tipo ${e.unlockedByType}`,
              detail: d.name,
              id: d.id,
            },
          })
        }
      }

      if (e.unlockedBySequenceNumber != null) {
        const detonadores = secuenciasAlcanzablesPorNumero(e.unlockedBySequenceNumber)
        for (const d of detonadores) {
          const c = costo.get(d.elementId)
          const p = profundidad.get(d.elementId)
          if (c == null || p == null) continue
          opciones.push({
            costo: c,
            profundidad: p + 1,
            ruta: {
              kind: 'spontaneous',
              label: `Desbloqueo por secuencia ${e.unlockedBySequenceNumber}`,
              detail: d.name,
              id: d.id,
            },
          })
        }
      }

      for (const t of triggersPorElemento.get(e.id) ?? []) {
        const d = activosPorId.get(t.triggerId)
        if (!d || !(alcanzable.get(d.id) ?? false)) continue
        const c = costo.get(d.id)
        const p = profundidad.get(d.id)
        if (c == null || p == null) continue
        opciones.push({
          costo: c,
          profundidad: p + 1,
          ruta: {
            kind: 'spontaneous',
            label: `Desbloqueo por ${d.name}`,
            detail: d.name,
            id: d.id,
          },
        })
      }

      // Desbloqueo por requisitos AND: todos los elementos requeridos deben ser alcanzables.
      if (e.requiredElementIds.length > 0) {
        const requisitosAlcanzables = e.requiredElementIds.every(
          (id) => alcanzable.get(id) ?? false,
        )
        if (requisitosAlcanzables) {
          const c = costoConjunto(e.requiredElementIds, costo)
          const p = profundidadConjunto(e.requiredElementIds, profundidad)
          if (c != null && p != null) {
            opciones.push({
              costo: c,
              profundidad: p + 1,
              ruta: {
                kind: 'spontaneous',
                label: 'Desbloqueo por requisitos',
                detail: e.requiredElementIds
                  .map((id) => activosPorId.get(id)?.name ?? id)
                  .join(' + '),
                id: e.id,
              },
            })
          }
        }
      }

      // Elegir la mejor opción espontánea.
      let mejor = opciones[0]
      for (const o of opciones.slice(1)) {
        if (compararRutas(o, mejor)) mejor = o
      }
      if (mejor) {
        if (
          intentarActualizar(e.id, {
            costo: mejor.costo,
            profundidad: mejor.profundidad,
            ruta: mejor.ruta,
            ritual: false,
          })
        ) {
          cambiado = true
        }
      }
    }

    // 2. Recetas.
    for (const r of recetasValidas) {
      const idsIngredientes = r.ingredients.map((i) => i.elementId)
      if (!idsIngredientes.every((id) => alcanzable.get(id) ?? false)) continue

      const c = costoConjunto(idsIngredientes, costo)
      const p = profundidadConjunto(idsIngredientes, profundidad)
      if (c == null || p == null) continue

      for (const oid of r.outputElementIds) {
        if (!activosPorId.has(oid)) continue
        if (salidasProtegidas.has(oid)) continue
        const candidato = {
          costo: c + 1,
          profundidad: p + 1,
          ruta: {
            kind: 'recipe' as const,
            label: `Receta: ${r.inputKey}`,
            detail: r.inputKey,
            id: r.id,
          },
          ritual: false,
        }
        if (intentarActualizar(oid, candidato)) cambiado = true
      }
    }

    // 3. Avances.
    for (const a of avancesActivos) {
      if (totalQuantity(a.ingredients) !== 2) continue
      const idsIngredientes = a.ingredients.map((i) => i.elementId)
      const sourceSeq = secuenciaPorId.get(a.sourceSequenceId)
      if (!sourceSeq) continue
      const sourceElementId = sourceSeq.elementId
      const idsPrevios = [...idsIngredientes, sourceElementId]

      if (!idsPrevios.every((id) => alcanzable.get(id) ?? false)) continue

      const cBase = costoConjunto(idsPrevios, costo)
      const pBase = profundidadConjunto(idsPrevios, profundidad)
      if (cBase == null || pBase == null) continue

      const targetSeq = secuenciaPorId.get(a.targetSequenceId)
      if (!targetSeq) continue
      const targetElementId = targetSeq.elementId

      const ritualesDelAvance = a.rituals.filter((r) => r.isActive)

      if (ritualesDelAvance.length === 0) {
        const candidato = {
          costo: cBase + 2,
          profundidad: pBase + 2,
          ruta: {
            kind: 'advance' as const,
            label: `Avance: ${a.internalName}`,
            detail: a.internalName,
            id: a.id,
          },
          ritual: false,
        }
        if (intentarActualizar(targetElementId, candidato)) cambiado = true
      } else {
        // Rituales que se pueden preparar ahora.
        const ritualesPreparables = ritualesDelAvance.filter((ritual) => {
          const ingredientesOk = ritual.ingredients.every(
            (i) => alcanzable.get(i.elementId) ?? false,
          )
          if (!ingredientesOk) return false
          return secuenciasAlcanzablesPorNumero(ritual.requiredSequenceNumber).length > 0
        })

        for (const ritual of ritualesPreparables) {
          for (const secuenciaRequerida of secuenciasAlcanzablesPorNumero(
            ritual.requiredSequenceNumber,
          )) {
            const idsRequisitos = [
              ...idsPrevios,
              ...ritual.ingredients.map((i) => i.elementId),
              secuenciaRequerida.elementId,
            ]
            const costoRequisitos = costoConjunto(idsRequisitos, costo)
            const profundidadRequisitos = profundidadConjunto(idsRequisitos, profundidad)
            if (costoRequisitos == null || profundidadRequisitos == null) continue
            const candidato = {
              costo: costoRequisitos + 2,
              profundidad: profundidadRequisitos + 2,
              ruta: {
                kind: 'advance' as const,
                label: `Avance: ${a.internalName} + ${ritual.name}`,
                detail: `${a.internalName} · ${ritual.name}`,
                id: a.id,
              },
              ritual: true,
            }
            if (intentarActualizar(targetElementId, candidato)) cambiado = true
          }
        }

        // El jugador puede intentar el avance sin preparar un ritual aunque
        // ya reúna sus requisitos. El runtime combina las consecuencias de
        // todos los rituales alternativos activos y elimina duplicados.
        for (const ritual of ritualesDelAvance) {
          for (const oid of ritual.failureOutputIds) {
            if (!activosPorId.has(oid)) continue
            const candidato = {
              costo: cBase + 2,
              profundidad: pBase + 2,
              ruta: {
                kind: 'ritual-failure' as const,
                label: `Avance fallido: ${ritual.name}`,
                detail: a.internalName,
                id: a.id,
              },
              ritual: false,
            }
            if (intentarActualizar(oid, candidato)) cambiado = true
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Cálculo estático de participación y alternativas
  // -------------------------------------------------------------------------

  const participacionRecetas = new Map<string, Set<string>>()
  const participacionAvances = new Map<string, Set<string>>()
  const participacionRituales = new Map<string, Set<string>>()
  const participacionSpontaneous = new Map<string, Set<string>>()

  for (const e of activos) {
    participacionRecetas.set(e.id, new Set())
    participacionAvances.set(e.id, new Set())
    participacionRituales.set(e.id, new Set())
    participacionSpontaneous.set(e.id, new Set())
  }

  for (const r of recetasValidas) {
    const ids = new Set([
      ...r.ingredients.map((i) => i.elementId),
      ...r.outputElementIds,
    ])
    for (const id of ids) {
      if (participacionRecetas.has(id)) {
        participacionRecetas.get(id)?.add(r.id)
      }
    }
  }

  for (const a of avancesActivos) {
    const ids = new Set([
      ...a.ingredients.map((i) => i.elementId),
      secuenciaPorId.get(a.sourceSequenceId)?.elementId,
      secuenciaPorId.get(a.targetSequenceId)?.elementId,
    ].filter((id): id is string => id != null))
    for (const id of ids) {
      if (participacionAvances.has(id)) {
        participacionAvances.get(id)?.add(a.id)
      }
    }
  }

  for (const r of ritualesActivos) {
    const ids = new Set([
      ...r.ingredients.map((i) => i.elementId),
      ...r.failureOutputIds,
      ...secuenciasActivas
        .filter((s) => s.number === r.requiredSequenceNumber)
        .map((s) => s.elementId),
    ])
    for (const id of ids) {
      if (participacionRituales.has(id)) {
        participacionRituales.get(id)?.add(r.id)
      }
    }
  }

  for (const t of triggers) {
    const regla = `elemento:${t.elementId}:${t.triggerId}`
    if (participacionSpontaneous.has(t.elementId)) {
      participacionSpontaneous.get(t.elementId)?.add(regla)
    }
    if (participacionSpontaneous.has(t.triggerId)) {
      participacionSpontaneous.get(t.triggerId)?.add(regla)
    }
  }

  for (const e of activos) {
    if (e.requiredElementIds.length > 0) {
      const regla = `and:${e.id}`
      participacionSpontaneous.get(e.id)?.add(regla)
      for (const reqId of e.requiredElementIds) {
        if (participacionSpontaneous.has(reqId)) {
          participacionSpontaneous.get(reqId)?.add(regla)
        }
      }
    }
  }

  for (const e of activos) {
    if (e.unlockedByType) {
      const regla = `tipo:${e.id}`
      participacionSpontaneous.get(e.id)?.add(regla)
      for (const detonador of activos.filter((x) => x.type === e.unlockedByType)) {
        participacionSpontaneous.get(detonador.id)?.add(regla)
      }
    }
    if (e.unlockedBySequenceNumber != null) {
      const regla = `secuencia:${e.id}`
      participacionSpontaneous.get(e.id)?.add(regla)
      for (const detonador of secuenciasActivas.filter(
        (s) => s.number === e.unlockedBySequenceNumber,
      )) {
        participacionSpontaneous.get(detonador.elementId)?.add(regla)
      }
    }
  }

  // Alternativas: recetas ejecutables y avances/rituales preparables.
  const alternativasRecetas = new Map<string, number>()
  const alternativasAvances = new Map<string, number>()
  const alternativasRituales = new Map<string, number>()
  const alternativasEspontaneas = new Map<string, number>()
  const alternativasFallos = new Map<string, number>()
  for (const e of activos) {
    alternativasRecetas.set(e.id, 0)
    alternativasAvances.set(e.id, 0)
    alternativasRituales.set(e.id, 0)
    alternativasEspontaneas.set(e.id, 0)
    alternativasFallos.set(e.id, 0)
  }

  for (const r of recetasValidas) {
    const idsIngredientes = r.ingredients.map((i) => i.elementId)
    if (!idsIngredientes.every((id) => alcanzable.get(id) ?? false)) continue
    for (const oid of r.outputElementIds) {
      if (activosPorId.has(oid) && !salidasProtegidas.has(oid)) {
        alternativasRecetas.set(oid, (alternativasRecetas.get(oid) ?? 0) + 1)
      }
    }
  }

  for (const e of activos) {
    let alternativas = 0
    if (e.unlockedByType) {
      alternativas += activos.filter(
        (x) =>
          x.id !== e.id &&
          x.type === e.unlockedByType &&
          (alcanzable.get(x.id) ?? false),
      ).length
    }
    if (e.unlockedBySequenceNumber != null) {
      alternativas += secuenciasAlcanzablesPorNumero(e.unlockedBySequenceNumber).length
    }
    alternativas += (triggersPorElemento.get(e.id) ?? []).filter(
      (t) => alcanzable.get(t.triggerId) ?? false,
    ).length
    if (e.requiredElementIds.length > 0) {
      const todosRequisitosAlcanzables = e.requiredElementIds.every(
        (id) => alcanzable.get(id) ?? false,
      )
      if (todosRequisitosAlcanzables) alternativas += 1
    }
    alternativasEspontaneas.set(e.id, alternativas)
  }

  for (const a of avancesActivos) {
    if (totalQuantity(a.ingredients) !== 2) continue
    const idsIngredientes = a.ingredients.map((i) => i.elementId)
    const sourceSeq = secuenciaPorId.get(a.sourceSequenceId)
    const targetSeq = secuenciaPorId.get(a.targetSequenceId)
    if (!sourceSeq || !targetSeq) continue
    const idsPrevios = [...idsIngredientes, sourceSeq.elementId]
    if (!idsPrevios.every((id) => alcanzable.get(id) ?? false)) continue

    const ritualesDelAvance = a.rituals.filter((r) => r.isActive)
    if (ritualesDelAvance.length === 0) {
      alternativasAvances.set(
        targetSeq.elementId,
        (alternativasAvances.get(targetSeq.elementId) ?? 0) + 1,
      )
    } else {
      const preparables = ritualesDelAvance.filter((ritual) => {
        const ingredientesOk = ritual.ingredients.every(
          (i) => alcanzable.get(i.elementId) ?? false,
        )
        if (!ingredientesOk) return false
        return secuenciasAlcanzablesPorNumero(ritual.requiredSequenceNumber).length > 0
      })
      if (preparables.length > 0) {
        alternativasRituales.set(
          targetSeq.elementId,
          (alternativasRituales.get(targetSeq.elementId) ?? 0) + preparables.length,
        )
      }

      for (const ritual of ritualesDelAvance) {
        for (const oid of ritual.failureOutputIds) {
          if (activosPorId.has(oid)) {
            alternativasFallos.set(oid, (alternativasFallos.get(oid) ?? 0) + 1)
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Construcción del resultado final
  // -------------------------------------------------------------------------

  const resultados = new Map<string, DiagElementResult>()

  for (const e of elements) {
    const esActivo = e.isActive
    const alcan = esActivo ? (alcanzable.get(e.id) ?? false) : false
    const c = esActivo ? (costo.get(e.id) ?? null) : null
    const p = esActivo ? (profundidad.get(e.id) ?? null) : null
    const ruta = mejorRuta.get(e.id) ?? {
      kind: 'unreachable' as const,
      label: esActivo ? 'Sin ruta válida' : 'Inactivo',
      detail: esActivo ? 'inalcanzable' : 'inactivo',
    }
    const ritual = requiereRitual.get(e.id) ?? false
    const altRecetas = alternativasRecetas.get(e.id) ?? 0
    const altAvances = alternativasAvances.get(e.id) ?? 0
    const altRituales = alternativasRituales.get(e.id) ?? 0
    const altEspontaneas = alternativasEspontaneas.get(e.id) ?? 0
    const altFallos = alternativasFallos.get(e.id) ?? 0
    const alternativaInicial = e.isStarter && e.isActive ? 1 : 0
    const alternativasTotales =
      altRecetas + altAvances + altRituales + altEspontaneas + altFallos + alternativaInicial

    const part: DiagParticipation = {
      recipes: participacionRecetas.get(e.id)?.size ?? 0,
      advances: participacionAvances.get(e.id)?.size ?? 0,
      rituals: participacionRituales.get(e.id)?.size ?? 0,
      spontaneous: participacionSpontaneous.get(e.id)?.size ?? 0,
      total:
        (participacionRecetas.get(e.id)?.size ?? 0) +
        (participacionAvances.get(e.id)?.size ?? 0) +
        (participacionRituales.get(e.id)?.size ?? 0) +
        (participacionSpontaneous.get(e.id)?.size ?? 0),
    }

    resultados.set(e.id, {
      elementId: e.id,
      reachable: alcan,
      depth: p,
      cost: c,
      alternatives: alternativasTotales,
      routeSummary: resumenRutas(
        altRecetas,
        altAvances,
        altRituales,
        altEspontaneas,
        altFallos,
        alternativaInicial === 1,
      ),
      participation: part,
      bestRoute: ruta,
      routeRequiresRitual: ritual,
      difficulty: dificultadDe(
        c,
        p,
        ritual,
        alternativasTotales,
        alcan,
        ruta.kind,
      ),
    })
  }

  return resultados
}

// ---------------------------------------------------------------------------
// Funciones de compatibilidad (se mantienen para no romper el panel)
// ---------------------------------------------------------------------------

export function calcularAlcanzables(
  elements: DiagElement[],
  recipes: DiagRecipe[],
  sequences: DiagSequence[] = [],
  advances: DiagAdvance[] = [],
  triggers: DiagTrigger[] = [],
): Set<string> {
  const analisis = analizarProgresion(elements, recipes, sequences, advances, triggers)
  return new Set(
    elements.filter((e) => analisis.get(e.id)?.reachable).map((e) => e.id),
  )
}

export function elementosInalcanzables(
  elements: DiagElement[],
  recipes: DiagRecipe[],
  sequences: DiagSequence[] = [],
  advances: DiagAdvance[] = [],
  triggers: DiagTrigger[] = [],
): DiagElement[] {
  const analisis = analizarProgresion(elements, recipes, sequences, advances, triggers)
  return elements.filter((e) => e.isActive && !analisis.get(e.id)?.reachable)
}

/** Recetas que comparten inputKey (datos antiguos o importaciones inválidas). */
export function recetasDuplicadas(recipes: DiagRecipe[]): Map<string, DiagRecipe[]> {
  const byKey = new Map<string, DiagRecipe[]>()
  for (const r of recipes) {
    const list = byKey.get(r.inputKey) ?? []
    list.push(r)
    byKey.set(r.inputKey, list)
  }
  return new Map([...byKey.entries()].filter(([, list]) => list.length > 1))
}

/**
 * Ciclos en el grafo ingrediente → resultado (A produce B y B produce A).
 * Solo advertencia: pueden ser intencionales. Devuelve los ciclos hallados
 * como listas de ids de elementos.
 */
export function detectarCiclos(recipes: DiagRecipe[]): string[][] {
  const edges = new Map<string, Set<string>>()
  for (const r of recipes.filter((x) => x.isActive)) {
    for (const ing of r.ingredients) {
      if (!edges.has(ing.elementId)) edges.set(ing.elementId, new Set())
      for (const oid of r.outputElementIds) {
        edges.get(ing.elementId)?.add(oid)
      }
    }
  }

  const cycles: string[][] = []
  const seenCycleKeys = new Set<string>()
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []

  const visit = (node: string) => {
    state.set(node, 'visiting')
    stack.push(node)
    for (const next of edges.get(node) ?? []) {
      const s = state.get(next)
      if (s === 'visiting') {
        const start = stack.indexOf(next)
        const cycle = stack.slice(start)
        const key = [...cycle].sort().join('>')
        if (!seenCycleKeys.has(key)) {
          seenCycleKeys.add(key)
          cycles.push([...cycle, next])
        }
      } else if (!s) {
        visit(next)
      }
    }
    stack.pop()
    state.set(node, 'done')
  }

  for (const node of edges.keys()) {
    if (!state.has(node)) visit(node)
  }
  return cycles
}

/**
 * Elementos "sin uso": no son iniciales, no participan en ninguna receta
 * válida, avance, ritual o desbloqueo activo, ni representan una secuencia.
 */
export function elementosSinUso(
  elements: DiagElement[],
  recipes: DiagRecipe[],
  sequences: DiagSequence[],
  advances: DiagAdvance[],
  rituals: DiagRitual[],
  triggers: DiagTrigger[] = [],
): DiagElement[] {
  const analisis = analizarProgresion(elements, recipes, sequences, advances, triggers)
  const secuenciaElementIds = new Set(sequences.map((s) => s.elementId))
  const activos = elements.filter((e) => e.isActive)

  return elements.filter((e) => {
    if (!e.isActive || e.isStarter) return false
    const part = analisis.get(e.id)?.participation
    if (!part) return false
    const enRitual = rituals.some(
      (r) => r.isActive && r.ingredients.some((i) => i.elementId === e.id),
    )
    const enTrigger = triggers.some(
      (t) => t.elementId === e.id || t.triggerId === e.id,
    )
    const enSpontaneous =
      e.unlockedByType != null ||
      e.unlockedBySequenceNumber != null ||
      e.requiredElementIds.length > 0
    const esRequisitoAND = activos.some((x) => x.requiredElementIds.includes(e.id))
    return (
      part.total === 0 &&
      !secuenciaElementIds.has(e.id) &&
      !enRitual &&
      !enTrigger &&
      !enSpontaneous &&
      !esRequisitoAND
    )
  })
}
