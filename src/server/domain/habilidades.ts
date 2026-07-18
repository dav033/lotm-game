// Facultades otorgadas por secuencias: sistema de pistas y análisis de
// elementos. La propiedad de una facultad se DERIVA de PlayerDiscovery (el
// elemento de secuencia correspondiente descubierto y activo); no existe
// tabla separada de desbloqueos y el servidor siempre recalcula, nunca
// confía en un "unlocked" enviado por el cliente.

// ---------------------------------------------------------------------------
// Definición central y extensible de facultades
// ---------------------------------------------------------------------------

export type AbilityKey = 'seer' | 'savant' | 'mysteryPryer' | 'apprenticeMemory'

export const ABILITY_DEFINITIONS = {
  seer: {
    requiredElementSlug: 'seer',
    nombre: 'Adivinación del Vidente',
  },
  savant: {
    requiredElementSlug: 'savant',
    nombre: 'Archivo del Savant',
    implemented: false,
    capacity: 5,
  },
  mysteryPryer: {
    requiredElementSlug: 'mystery-pryer',
    nombre: 'Visión del Mystery Pryer',
  },
  apprenticeMemory: {
    requiredElementSlug: 'aprendiz',
    nombre: 'Memoria del Aprendiz',
  },
} as const

export const ABILITY_KEYS = Object.keys(ABILITY_DEFINITIONS) as AbilityKey[]

// Metadatos de desbloqueo que sí pueden viajar al navegador. Savant declara
// su forma futura (capacidad y uso) aunque todavía no esté implementada.
export type PlayerAbilities = {
  seer: { unlocked: boolean }
  savant: { unlocked: boolean; implemented: false; capacity: number; used: number }
  mysteryPryer: { unlocked: boolean }
  apprenticeMemory: { unlocked: boolean }
}

// Un jugador posee una facultad cuando ha descubierto el elemento ACTIVO con
// el slug requerido. La actividad se garantiza en la consulta que construye
// el conjunto de slugs; aquí solo se miran slugs estables, nunca nombres.
export function facultadesDesdeSlugs(slugsDescubiertos: ReadonlySet<string>): PlayerAbilities {
  return {
    seer: { unlocked: slugsDescubiertos.has(ABILITY_DEFINITIONS.seer.requiredElementSlug) },
    savant: {
      unlocked: slugsDescubiertos.has(ABILITY_DEFINITIONS.savant.requiredElementSlug),
      implemented: false,
      capacity: ABILITY_DEFINITIONS.savant.capacity,
      used: 0,
    },
    mysteryPryer: {
      unlocked: slugsDescubiertos.has(ABILITY_DEFINITIONS.mysteryPryer.requiredElementSlug),
    },
    apprenticeMemory: {
      unlocked: slugsDescubiertos.has(ABILITY_DEFINITIONS.apprenticeMemory.requiredElementSlug),
    },
  }
}

export function facultadesBloqueadas(): PlayerAbilities {
  return facultadesDesdeSlugs(new Set())
}

// Facultades que pasan de bloqueadas a desbloqueadas entre dos estados; sirve
// para la notificación única por sesión («Nueva facultad: …»).
export function desbloqueosNuevos(
  antes: PlayerAbilities,
  despues: PlayerAbilities,
): AbilityKey[] {
  return ABILITY_KEYS.filter((key) => !antes[key].unlocked && despues[key].unlocked)
}

// ---------------------------------------------------------------------------
// Potencial actual ("combinaciones pendientes ejecutables")
// ---------------------------------------------------------------------------
//
// Una "combinación pendiente ejecutable" es una acción única del jugador que:
//  1. involucra el elemento analizado;
//  2. es válida bajo las reglas actuales del servidor (misma definición de
//     validez que el resolvedor real de combinar.ts: fórmula activa,
//     contenido activo, exactamente dos unidades, ingredientes utilizables);
//  3. puede ejecutarse con los descubrimientos, avances y rituales del perfil;
//  4. todavía no se ha resuelto con éxito por este perfil
//     (PlayerCombinationStat.successes > 0 marca la inputKey como resuelta;
//     los intentos fallidos NO quitan potencial).
//
// Se excluyen: rituales (no se ejecutan en la mesa), desbloqueos espontáneos,
// logros, consecuencias de fallos de ritual y cualquier fórmula hipotética o
// imposible ahora mismo.

export type FormulaPotencial = {
  /** Clave canónica de acción: la inputKey de la receta o del avance. */
  actionKey: string
  /** Elementos ingrediente únicos que participan en la fórmula. */
  ingredientElementIds: string[]
  /** Unidades totales; el resolvedor solo acepta exactamente 2. */
  totalUnidades: number
  /** Receta o avance activo. */
  activa: boolean
  /** Todos los elementos ingrediente están activos (el resolvedor los rechaza si no). */
  ingredientesActivos: boolean
  /**
   * La fórmula produciría algo ahora: para recetas, al menos una salida
   * activa y no protegida por un avance (misma regla que combinar.ts); para
   * creación de avances, ambos caminos activos.
   */
  salidasValidas: boolean
}

export type AplicacionAvancePotencial = {
  /** Clave sintética interna: `advance-application:<advanceId>`. Nunca sale del servidor. */
  actionKey: string
  sourceElementId: string
  targetElementId: string
  /** PlayerAdvance con cantidad > 0. */
  owned: boolean
  advanceActivo: boolean
  /** Camino origen y destino activos y elemento destino activo. */
  contenidoActivo: boolean
  /**
   * Regla idéntica a combinar.ts: sin rituales activos, o al menos un ritual
   * activo ya preparado por el perfil (PlayerRitual).
   */
  ritualSatisfecho: boolean
}

export type SnapshotPotencial = {
  /** Elementos activos descubiertos por el perfil. */
  discoveredElementIds: Set<string>
  /** inputKeys con al menos un éxito (PlayerCombinationStat.successes > 0). */
  resolvedInputKeys: Set<string>
  formulas: FormulaPotencial[]
  aplicaciones: AplicacionAvancePotencial[]
}

// Cálculo puro: recibe el snapshot normalizado y devuelve, por elemento
// descubierto, cuántas acciones pendientes lo involucran. Sin Prisma, sin
// efectos secundarios: llamarlo nunca altera el estado del jugador.
export function calcularPotencialPorElemento(
  snapshot: SnapshotPotencial,
): Map<string, number> {
  const conteos = new Map<string, number>()
  const accionesVistas = new Set<string>()
  const incrementar = (elementId: string) =>
    conteos.set(elementId, (conteos.get(elementId) ?? 0) + 1)

  for (const formula of snapshot.formulas) {
    if (accionesVistas.has(formula.actionKey)) continue
    if (!formula.activa || !formula.ingredientesActivos || !formula.salidasValidas) continue
    if (formula.totalUnidades !== 2) continue
    if (snapshot.resolvedInputKeys.has(formula.actionKey)) continue
    if (!formula.ingredientElementIds.every((id) => snapshot.discoveredElementIds.has(id))) {
      continue
    }
    // Acción única: receta y avance que comparten inputKey cuentan una vez;
    // una receta con varias salidas también; una autocombinación también.
    accionesVistas.add(formula.actionKey)
    for (const id of new Set(formula.ingredientElementIds)) incrementar(id)
  }

  for (const aplicacion of snapshot.aplicaciones) {
    if (accionesVistas.has(aplicacion.actionKey)) continue
    if (!aplicacion.owned || !aplicacion.advanceActivo) continue
    if (!aplicacion.contenidoActivo || !aplicacion.ritualSatisfecho) continue
    if (!snapshot.discoveredElementIds.has(aplicacion.sourceElementId)) continue
    // Aplicar un avance cuya secuencia destino ya se descubrió no aporta
    // potencial de pista: esa línea de experimentación ya se cerró.
    if (snapshot.discoveredElementIds.has(aplicacion.targetElementId)) continue
    accionesVistas.add(aplicacion.actionKey)
    incrementar(aplicacion.sourceElementId)
  }

  return conteos
}

// ---------------------------------------------------------------------------
// Tiers de potencial (Visión del Mystery Pryer)
// ---------------------------------------------------------------------------

export type PotentialTier = 1 | 2 | 3 | 4 | 5

// Límites superiores de los tiers I–IV; V es abierto. Única fuente numérica:
// la función, el texto del rango y los tests derivan de aquí.
const LIMITE_SUPERIOR = [3, 12, 18, 24] as const

export function potentialTierFromCount(count: number): PotentialTier {
  // Guarda ante valores inválidos: el tier más bajo, nunca un error.
  if (!Number.isFinite(count) || count < 0) return 1
  if (count <= LIMITE_SUPERIOR[0]) return 1
  if (count <= LIMITE_SUPERIOR[1]) return 2
  if (count <= LIMITE_SUPERIOR[2]) return 3
  if (count <= LIMITE_SUPERIOR[3]) return 4
  return 5
}

export const NUMERAL_TIER: Record<PotentialTier, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
}

export const POTENTIAL_TIER_LABELS: Record<PotentialTier, string> = {
  1: 'Tenue',
  2: 'Latente',
  3: 'Resonante',
  4: 'Excepcional',
  5: 'Desbordante',
}

// Rango público del tier ("0–3", "4–12", …): parte de la mecánica, se muestra
// en la leyenda. Derivado de LIMITE_SUPERIOR para no duplicar números.
export function rangoDeTier(tier: PotentialTier): string {
  const inferior = tier === 1 ? 0 : LIMITE_SUPERIOR[tier - 2] + 1
  if (tier === 5) return `${inferior}+`
  return `${inferior}–${LIMITE_SUPERIOR[tier - 1]}`
}

// ---------------------------------------------------------------------------
// Formas públicas de respuesta (privacidad por construcción)
// ---------------------------------------------------------------------------

// Vidente: solo el elemento analizado y el recuento exacto. Nada de
// compañeros, recetas, avances, inputKeys, salidas ni secuencias.
export function resultadoVidentePublico(elementId: string, count: number) {
  return { elementId, availableCombinationCount: count }
}

// Mystery Pryer: solo el tier; jamás el recuento exacto que lo originó.
export function entradaPotencialPublica(elementId: string, count: number) {
  return { elementId, tier: potentialTierFromCount(count) }
}

/**
 * TODO(ARCHIVO_SAVANT — no implementado a propósito):
 *
 * Implementar esta facultad solo cuando el dominio de combinación tenga una
 * clasificación canónica de disponibilidad que no filtre contenido, p. ej.:
 * DISPONIBLE | BLOQUEADA_SECUENCIA | BLOQUEADA_RITUAL | BLOQUEADA_CONOCIMIENTO
 * | INEXISTENTE.
 *
 * El futuro Archivo del Savant debe:
 * - persistir como máximo cinco pares de entrada bloqueados y normalizados
 *   por perfil;
 * - aceptar únicamente combinaciones clasificadas como BLOQUEADA_* por el
 *   servidor;
 * - no tratar jamás una combinación INEXISTENTE como contenido oculto;
 * - no revelar salidas ocultas, secuencias destino, fórmulas de rituales,
 *   nombres de caminos ni metadatos de elementos no descubiertos;
 * - impedir inputKeys guardadas duplicadas;
 * - imponer el límite de cinco huecos de forma transaccional en el servidor;
 * - permitir borrar o reemplazar entradas guardadas;
 * - reevaluar las entradas tras cada cambio de progresión relevante;
 * - marcar una entrada como disponible cuando su bloqueo desaparece, sin
 *   autoejecutarla;
 * - definir el comportamiento de reinicio y borrar las entradas guardadas
 *   cuando se reinicia un perfil;
 * - incluir migración de Prisma, comprobaciones de autorización, validación
 *   de API, manejo de concurrencia y pruebas;
 * - usar el constructor canónico de inputKey existente en vez de guardar
 *   cadenas compuestas por el cliente.
 *
 * No deducir "bloqueada" de una combinación fallida genérica hasta que las
 * reglas del conocimiento prohibido estén formalmente modeladas.
 */
