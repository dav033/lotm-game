import { z } from 'zod'

// Tipos lógicos de elemento: texto plano validado con Zod (sin enums del motor
// de base de datos, para poder migrar a PostgreSQL sin fricción).
export const ELEMENT_TYPES = [
  'MUNDANO',
  'CONCEPTO',
  'MISTICISMO',
  'BEYONDER',
  'CRIATURA',
  'OBJETO',
  'OTRO',
] as const

export type ElementType = (typeof ELEMENT_TYPES)[number]

export const elementTypeSchema = z.enum(ELEMENT_TYPES)

// Etiquetas en castellano para mostrar cada tipo en la interfaz.
export const ELEMENT_TYPE_LABELS: Record<ElementType, string> = {
  MUNDANO: 'Mundano',
  CONCEPTO: 'Concepto',
  MISTICISMO: 'Misticismo',
  BEYONDER: 'Beyonder',
  CRIATURA: 'Criatura',
  OBJETO: 'Objeto',
  OTRO: 'Otro',
}

// En la base el tipo viaja como texto plano; si llega un valor desconocido se
// muestra tal cual en lugar de romper la interfaz.
export function etiquetaTipo(type: string): string {
  if (type === 'AVANCE') return 'Avance'
  return (ELEMENT_TYPE_LABELS as Record<string, string>)[type] ?? type
}

// Datos de un elemento que sí pueden viajar al navegador.
export type ElementPublicData = {
  kind: 'ELEMENT' | 'ADVANCE'
  id: string
  slug: string
  name: string
  description: string
  iconKey: string
  imageUrl: string | null
  type: string
  tier: number
  isMajorDiscovery: boolean
  derivationLabel: string | null
  // Presente solo cuando el elemento representa una secuencia de un camino
  // (p. ej. "Secuencia 9 · Camino del Vidente"); ayuda a usar los avances.
  sequenceLabel?: string | null
}

export type ProgressionPhasePublicData = {
  slug: string
  name: string
  sortOrder: number
}

export type PathwayReveal = {
  categoryPath: string[]
  pathwayName: string
  sequenceNumber: number
  sequenceName: string
  title: string
  text: string
}

export type AchievementPublicData = {
  id: string
  slug: string
  name: string
  description: string
  iconKey: string
  unlockedAt: string
}

export type RecipeOutputData = {
  element: ElementPublicData
  quantity: number
  isNewDiscovery: boolean
}

// Delta incremental de la Memoria del Aprendiz: acompaña la respuesta de una
// combinación entre dos Elementos normales (nunca la aplicación de un
// Avance) cuando el resultado es un NO_RECIPE genuino o un éxito genuino.
// El cliente lo aplica directamente sobre su Set en memoria, sin recargar el
// historial completo tras cada intento.
export type ApprenticeMemoryDelta =
  | { inputKey: string; status: 'FAILED' }
  | { inputKey: string; status: 'RESOLVED' }

export type ResolvedCombineResult = {
  kind: 'RESOLVED'
  success: boolean
  message: string
  inputKey: string
  results: RecipeOutputData[]
  isNewPathwayUnlock: boolean
  pathwayReveal: PathwayReveal | null
  consumedSlugs: string[]
  unlockedAchievements: AchievementPublicData[]
  /** Ausente (no `null`) cuando la combinación no fue un par de Elementos normales. */
  memoryDelta?: ApprenticeMemoryDelta
}

export type RitualKnowledgeRequiredResult = {
  kind: 'RITUAL_KNOWLEDGE_REQUIRED'
  message: string
}

export type RitualPreparationRequiredResult = {
  kind: 'RITUAL_PREPARATION_REQUIRED'
  message: string
  confirmationRequired: true
}

export type CombineResult =
  | ResolvedCombineResult
  | RitualKnowledgeRequiredResult
  | RitualPreparationRequiredResult

export const MENSAJE_SIN_RECETA = 'La combinación no responde.'

// Panel de depuración (solo admin): receta activa aún no descubierta por
// completo, con sus ingredientes y resultados (pueden estar ocultos).
export type RecetaPendienteElemento = ElementPublicData & { quantity: number; discovered: boolean }

export type RecetaPendiente = {
  recipeId: string
  ingredientes: RecetaPendienteElemento[]
  resultados: RecetaPendienteElemento[]
}
