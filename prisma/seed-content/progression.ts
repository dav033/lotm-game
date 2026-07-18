// Contenido declarativo de la progresión temprana (fases 1 a 3). El seed y
// las pruebas leen estas constantes en lugar de repetir listas de slugs; el
// runtime del juego sigue leyendo siempre la base de datos, esto es solo
// para sembrar y validar de forma determinista.

import { getRecipeDefinitions } from './recipes'

/** Únicos elementos con los que arranca un perfil nuevo. */
export const STARTER_SLUGS = ['ojo', 'moneda', 'tierra', 'registro'] as const

/**
 * Requisitos AND que, al completarse, desbloquean en conjunto los cuatro
 * conceptos de transición de la Fase 1 a la Fase 2.
 */
export const PHASE1_TRANSITION_REQUIREMENT_SLUGS = ['mundo', 'historia', 'profecia', 'seer'] as const

/** Elementos que se desbloquean juntos al cumplirse los requisitos anteriores. */
export const PHASE1_TRANSITION_TARGET_SLUGS = ['espacio', 'misticismo', 'beyonder', 'humano'] as const

/** Requisito AND (elemento) para el desbloqueo compuesto de Tiempo. */
export const TIME_UNLOCK_REQUIREMENT_SLUGS = ['monster'] as const

/** Requisito de número de Secuencia (compuesto con lo anterior) para Tiempo. */
export const TIME_UNLOCK_SEQUENCE_NUMBER = 6

/** Slug del elemento cuyo desbloqueo compuesto exige Monster Y Secuencia 6. */
export const TIME_SLUG = 'tiempo'

/**
 * Recetas reservadas para una Fase 4 todavía sin diseñar. Se mantienen
 * declaradas (con `isActive: false` en recipes.ts) para no perder el diseño,
 * pero no deben producir elementos dentro del cierre de fases 1-3.
 */
export function getInactivePhase4RecipeInputKeys(): [string, number][][] {
  return getRecipeDefinitions()
    .filter((r) => r.isActive === false)
    .map((r) => r.ings)
}

// ---------------------------------------------------------------------------
// Cierres de fase esperados (fuente única para las pruebas de progresión).
// ---------------------------------------------------------------------------

/** Fase 1: exactamente 17 elementos (4 iniciales + 13 descubrimientos). */
export const PHASE1_CLOSURE_SLUGS = [
  'adivinacion',
  'campo',
  'continente',
  'dato',
  'fortuna',
  'historia',
  'moneda',
  'mundo',
  'observacion',
  'ojo',
  'percepcion',
  'profecia',
  'registro',
  'revelacion',
  'seer',
  'tierra',
  'vision',
] as const

/** Los 39 slugs nuevos que la Fase 2 añade sobre el cierre de la Fase 1. */
export const PHASE2_NEW_SLUGS = [
  'alegria',
  'apertura',
  'aprendiz',
  'astrologo',
  'ausencia',
  'avance',
  'beyonder',
  'cryptologist',
  'cuerpo-celeste',
  'deseo',
  'diferenciacion',
  'escriba',
  'escucha',
  'espacio',
  'espacio-exterior',
  'espiritualidad',
  'humano',
  'identidad',
  'ilusion',
  'intuicion',
  'magia',
  'marauder',
  'misticismo',
  'monster',
  'percepcion-espiritual',
  'poder-beyonder',
  'prometheus',
  'puerta',
  'robo',
  'robo-de-identidad',
  'secuencia-media',
  'separacion',
  'swindler',
  'trabajo',
  'trickmaster',
  'truco',
  'vacio',
  'vinculo',
  'vision-espiritual',
] as const

/** Cierre acumulado de la Fase 2: exactamente 56 elementos. */
export const PHASE2_CLOSURE_SLUGS = [...PHASE1_CLOSURE_SLUGS, ...PHASE2_NEW_SLUGS] as const

/** Los 18 slugs nuevos que la Fase 3 añade sobre el cierre de la Fase 2. */
export const PHASE3_NEW_SLUGS = [
  'acumulacion',
  'canto',
  'ciclo',
  'conocimiento',
  'continuidad',
  'desgaste',
  'destino',
  'edad',
  'era',
  'esfuerzo',
  'experiencia-2',
  'hambre',
  'linaje',
  'memoria',
  'retorno',
  'ritmo',
  'tiempo',
  'vejez',
] as const

/** Cierre acumulado de la Fase 3: exactamente 74 elementos. */
export const PHASE3_CLOSURE_SLUGS = [...PHASE2_CLOSURE_SLUGS, ...PHASE3_NEW_SLUGS] as const

/** Secuencias (elemento de secuencia) esperadas al completar la Fase 1. */
export const PHASE1_SEQUENCE_SLUGS = ['seer'] as const

/** Secuencias esperadas al completar la Fase 2 (acumulado sobre la Fase 1). */
export const PHASE2_SEQUENCE_SLUGS = [
  ...PHASE1_SEQUENCE_SLUGS,
  'monster',
  'aprendiz',
  'trickmaster',
  'astrologo',
  'escriba',
  'marauder',
  'swindler',
  'cryptologist',
  'prometheus',
] as const

/** Ningún avance de secuencia nuevo se añade en la Fase 3. */
export const PHASE3_SEQUENCE_SLUGS = PHASE2_SEQUENCE_SLUGS

// ---------------------------------------------------------------------------
// Constructores de las reglas de desbloqueo espontáneo, en el mismo formato
// que espera el simulador puro (progression-simulator.ts) y que seed-data.ts
// aplica sobre la base de datos.
// ---------------------------------------------------------------------------

export function buildDefaultAndRequirements(): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const target of PHASE1_TRANSITION_TARGET_SLUGS) {
    map[target] = [...PHASE1_TRANSITION_REQUIREMENT_SLUGS]
  }
  map[TIME_SLUG] = [...TIME_UNLOCK_REQUIREMENT_SLUGS]
  return map
}

/** Desencadenantes directos que el seed configura fuera de las recetas. */
export function buildDefaultTriggers(): Record<string, string[]> {
  return {
    'mundo-espiritual': ['proyeccion-astral'],
    magia: ['trickmaster'],
  }
}

/** Elementos que jamás deben aparecer en el cierre publicado de fases 1-3. */
export const EXPLOSION_REGRESSION_SLUGS = [
  'apuesta',
  'muerte',
  'fuerza',
  'familia',
  'cuerpo-espiritual',
  'informacion',
  'claridad',
  'prudencia',
  'pensamiento',
  'procedimiento',
  'ritual',
  'mundo-espiritual',
] as const
