// Contenido declarativo del grafo. Las agrupaciones históricas se conservan
// para documentar temas; la disponibilidad autoritativa vive en phases.ts.

/**
 * Únicos elementos con los que arranca un perfil nuevo (y con los que se
 * reinicia uno existente). Ojo, Moneda, Tierra y Humano: nada más.
 */
export const STARTER_SLUGS = ['ojo', 'moneda', 'tierra', 'humano'] as const

/** Slug del contenido prohibido Tiempo, conservado en el catálogo pero inactivo. */
export const TIME_SLUG = 'tiempo'

/**
 * Cierre orgánico actual de la Fase 1. Al agotarlo se abre la Fase 2 y se
 * conceden Misticismo, Beyonder y Agua.
 */
export const DISCOVERY_COUNT_TRANSITION_THRESHOLD = 39

/** Elementos que la Fase 2 concede al alcanzar el umbral anterior. */
export const DISCOVERY_COUNT_TRANSITION_TARGET_SLUGS = ['misticismo', 'beyonder', 'agua'] as const

// ---------------------------------------------------------------------------
// Cierres esperados (fuente única para las pruebas de progresión). Cada
// bloque documenta los slugs NUEVOS que aporta y expone también el cierre
// acumulado hasta ese punto.
// ---------------------------------------------------------------------------

/**
 * Cierre derivado desde los cuatro starters y el pool global antes de la
 * apertura mística.
 */
export const PHASE1_CLOSURE_SLUGS = [
  'acumulacion',
  'adivinacion',
  'alegria',
  'apuesta',
  'campo',
  'canto',
  'ciclo',
  'ciudad',
  'comunidad',
  'continente',
  'continuidad',
  'desgaste',
  'destino',
  'era',
  'escucha',
  'esfuerzo',
  'extasis',
  'familia',
  'fortuna',
  'fuerza',
  'guerrero',
  'humano',
  'linaje',
  'moneda',
  'multitud',
  'mundo',
  'nacion',
  'observacion',
  'ojo',
  'percepcion',
  'retorno',
  'revelacion',
  'ritmo',
  'ruptura',
  'seer',
  'tierra',
  'trabajo',
  'vinculo',
  'vision',
] as const

/**
 * Agrupación histórica de la apertura mística: las tres concesiones de fase
 * y los doce elementos que producen transitivamente.
 */
export const MYSTIC_OPENING_NEW_SLUGS = [
  'agua',
  'misticismo',
  'beyonder',
  'cuerpo-espiritual',
  'espiritualidad',
  'percepcion-espiritual',
  'poder-beyonder',
  'rio',
  'river-of-fate',
  'parasitismo',
  'avatar',
  'vision-espiritual',
  'intuicion',
  'monster',
  'avance',
] as const

/** Agrupación histórica de 57 elementos. No restringe la progresión. */
export const MYSTIC_OPENING_EXPECTED_SLUGS = [
  ...PHASE1_CLOSURE_SLUGS,
  ...MYSTIC_OPENING_NEW_SLUGS,
] as const

/**
 * Agrupación histórica del primer bloque de sustitución de Tiempo:
 * Acumulación y Continuidad por rutas alternativas.
 */
export const ACUMULACION_BLOCK_NEW_SLUGS = [
  'acumulacion',
  'mar',
  'multitud',
  'continuidad',
  'ciclo',
  'linaje',
  'ritmo',
  'canto',
] as const

/** Agrupación histórica acumulada tras Acumulación: 65 elementos. */
export const ACUMULACION_CLOSURE_SLUGS = [
  ...MYSTIC_OPENING_EXPECTED_SLUGS,
  ...ACUMULACION_BLOCK_NEW_SLUGS,
] as const

/**
 * Agrupación histórica del segundo bloque de sustitución de Tiempo:
 * Esfuerzo por ruta alternativa y Desgaste.
 */
export const ESFUERZO_BLOCK_NEW_SLUGS = ['esfuerzo', 'desgaste'] as const

/** Agrupación histórica acumulada tras Esfuerzo: 67 elementos. */
export const ESFUERZO_CLOSURE_SLUGS = [
  ...ACUMULACION_CLOSURE_SLUGS,
  ...ESFUERZO_BLOCK_NEW_SLUGS,
] as const

/**
 * Agrupación histórica del tercer bloque de sustitución de Tiempo: Registro
 * deja de ser inicial y pasa a fabricarse, junto
 * con todo lo que su apertura habilita de forma natural (incluye Magia vía
 * su desencadenante directo desde Trickmaster, y Magia acuática que Magia
 * habilita a su vez).
 */
export const REGISTRO_BLOCK_NEW_SLUGS = [
  'registro',
  'dato',
  'profecia',
  'trickmaster',
  'astrologo',
  'escriba',
  'cryptologist',
  'prometheus',
  'magia',
  'magia-acuatica',
  'carta-nautica',
  'navegacion',
  'secuencia-media',
] as const

/** Agrupación histórica acumulada tras Registro: 80 elementos. */
export const REGISTRO_CLOSURE_SLUGS = [
  ...ESFUERZO_CLOSURE_SLUGS,
  ...REGISTRO_BLOCK_NEW_SLUGS,
] as const

/** Agrupación histórica del cuarto bloque: Era por ruta alternativa. */
export const ERA_BLOCK_NEW_SLUGS = ['era'] as const

/** Agrupación histórica acumulada tras Era: 81 elementos. */
export const ERA_CLOSURE_SLUGS = [...REGISTRO_CLOSURE_SLUGS, ...ERA_BLOCK_NEW_SLUGS] as const

/** Agrupación histórica del quinto bloque: Historia por registro + era. */
export const HISTORIA_BLOCK_NEW_SLUGS = ['historia'] as const

/** Agrupación histórica acumulada tras Historia: 82 elementos. */
export const HISTORIA_CLOSURE_SLUGS = [...ERA_CLOSURE_SLUGS, ...HISTORIA_BLOCK_NEW_SLUGS] as const

/** Agrupación histórica del sexto bloque: Retorno por ruta alternativa. */
export const RETORNO_BLOCK_NEW_SLUGS = ['retorno'] as const

/** Agrupación histórica acumulada de Fase 2: 83 elementos. */
export const HISTORICAL_PHASE_2_CLOSURE_SLUGS = [
  ...HISTORIA_CLOSURE_SLUGS,
  ...RETORNO_BLOCK_NEW_SLUGS,
] as const

export const PHASE_3_AGE_NEW_SLUGS = ['edad'] as const
export const PHASE_3_AGE_CLOSURE_SLUGS = [
  ...HISTORICAL_PHASE_2_CLOSURE_SLUGS,
  ...PHASE_3_AGE_NEW_SLUGS,
] as const

export const PHASE_3_STRENGTH_NEW_SLUGS = [
  'extasis',
  'fuerza',
  'guerrero',
  'hielo',
  'hielo-eterno',
  'robot',
  'ruptura',
] as const
export const PHASE_3_STRENGTH_CLOSURE_SLUGS = [
  ...PHASE_3_AGE_CLOSURE_SLUGS,
  ...PHASE_3_STRENGTH_NEW_SLUGS,
] as const

export const PHASE_3_EXPERIENCE_NEW_SLUGS = [
  'caballero',
  'control-corporal',
  'experiencia-2',
  'memoria',
  'sailor',
] as const
export const PHASE_3_EXPERIENCE_CLOSURE_SLUGS = [
  ...PHASE_3_STRENGTH_CLOSURE_SLUGS,
  ...PHASE_3_EXPERIENCE_NEW_SLUGS,
] as const

export const PHASE_3_MORTALITY_NEW_SLUGS = [
  'alma',
  'cadaver',
  'carne',
  'carne-y-sangre',
  'cementerio',
  'clown',
  'corpse-collector',
  'corrupcion',
  'criatura',
  'criatura-beyonder',
  'criatura-beyonder-acuatica',
  'criatura-espiritual',
  'danger-intuition',
  'desastre',
  'descripcion-espiritual',
  'dolor',
  'espiritu',
  'existencia-oculta',
  'folk-of-rage',
  'furia',
  'gravedigger',
  'herida',
  'ira',
  'locura',
  'mago',
  'muerte',
  'muerto-viviente',
  'peligro',
  'perdida-de-control',
  'requiem',
  'revelacion-prohibida',
  'sangre',
  'seafarer',
  'sirena',
  'tumba',
] as const
export const PHASE_3_MORTALITY_CLOSURE_SLUGS = [
  ...PHASE_3_EXPERIENCE_CLOSURE_SLUGS,
  ...PHASE_3_MORTALITY_NEW_SLUGS,
] as const

export const PHASE_3_KNOWLEDGE_NEW_SLUGS = [
  'autocontrol',
  'bard',
  'claridad',
  'conocimiento',
  'discernimiento',
  'fuego',
  'luz',
  'prudencia',
  'resistencia',
  'spectator',
  'valor',
] as const
export const PHASE_3_KNOWLEDGE_CLOSURE_SLUGS = [
  ...PHASE_3_MORTALITY_CLOSURE_SLUGS,
  ...PHASE_3_KNOWLEDGE_NEW_SLUGS,
] as const

/** Cierre del catálogo si se ignoran las asignaciones autoritativas de fase. */
export const UNRESTRICTED_CATALOG_CLOSURE_SLUGS = PHASE_3_KNOWLEDGE_CLOSURE_SLUGS

/**
 * Cierre puramente basado en ingredientes si se omite artificialmente la
 * apertura automática de Agua, Misticismo y Beyonder a los 42 hallazgos.
 * No representa una fase publicada; se conserva como referencia del grafo
 * sin restricciones editoriales.
 */
export const UNRESTRICTED_PRE_MYSTIC_CLOSURE_SLUGS = [
  'acumulacion',
  'adivinacion',
  'alegria',
  'alma',
  'apertura',
  'aprendiz',
  'apuesta',
  'astrologo',
  'ausencia',
  'autocontrol',
  'caballero',
  'cadaver',
  'campo',
  'canto',
  'carne',
  'carne-y-sangre',
  'cementerio',
  'ciclo',
  'ciudad',
  'claridad',
  'comunidad',
  'conocimiento',
  'continente',
  'continuidad',
  'control-corporal',
  'corpse-collector',
  'criatura',
  'cuerpo-celeste',
  'dato',
  'desastre',
  'deseo',
  'desgaste',
  'destino',
  'diferenciacion',
  'discernimiento',
  'dolor',
  'edad',
  'era',
  'escucha',
  'esfuerzo',
  'espacio',
  'espacio-exterior',
  'espiritu',
  'experiencia-2',
  'extasis',
  'familia',
  'fortuna',
  'fuerza',
  'furia',
  'guerrero',
  'herida',
  'historia',
  'humano',
  'identidad',
  'ilusion',
  'ira',
  'linaje',
  'magia',
  'marauder',
  'memoria',
  'moneda',
  'muerte',
  'muerto-viviente',
  'multitud',
  'mundo',
  'nacion',
  'observacion',
  'ojo',
  'peligro',
  'percepcion',
  'profecia',
  'prudencia',
  'puerta',
  'registro',
  'requiem',
  'resistencia',
  'retorno',
  'revelacion',
  'ritmo',
  'robo',
  'robo-de-identidad',
  'ruptura',
  'sangre',
  'secuencia-media',
  'seer',
  'separacion',
  'spectator',
  'swindler',
  'tierra',
  'trabajo',
  'trickmaster',
  'truco',
  'tumba',
  'vacio',
  'valor',
  'vinculo',
  'vision',
] as const

/** Secuencias (elemento de secuencia) alcanzables ya dentro de la Fase 1. */
export const PHASE1_SEQUENCE_SLUGS = ['seer', 'marauder', 'swindler', 'aprendiz'] as const

/** Secuencias nuevas que aporta la apertura mística. */
export const MYSTIC_OPENING_SEQUENCE_SLUGS = [...PHASE1_SEQUENCE_SLUGS, 'monster'] as const

/** Secuencias nuevas que aporta el bloque de Registro. */
export const PHASE_2_SEQUENCE_SLUGS = [
  ...MYSTIC_OPENING_SEQUENCE_SLUGS,
  'trickmaster',
  'astrologo',
  'escriba',
  'cryptologist',
  'prometheus',
] as const

export const PHASE_3_NEW_SEQUENCE_SLUGS = [
  'bard',
  'clown',
  'corpse-collector',
  'folk-of-rage',
  'gravedigger',
  'mago',
  'robot',
  'sailor',
  'seafarer',
  'spectator',
] as const

export const FINAL_SEQUENCE_SLUGS = [
  ...PHASE_2_SEQUENCE_SLUGS,
  ...PHASE_3_NEW_SEQUENCE_SLUGS,
] as const

// ---------------------------------------------------------------------------
// Constructores de las reglas de desbloqueo espontáneo, en el mismo formato
// que espera el simulador puro (progression-simulator.ts) y que seed-data.ts
// aplica sobre la base de datos.
// ---------------------------------------------------------------------------

/**
 * Requisitos AND declarativos por elemento concreto. En esta entrega no hay
 * ninguno activo: la antigua transición conjunta Espacio/Misticismo/
 * Beyonder/Humano y el antiguo requisito compuesto de Tiempo (Monster +
 * Secuencia 6) quedan retirados. Se conserva la función para que el seed y
 * el simulador tengan un único punto de extensión declarativo si una fase
 * futura necesita requisitos AND de nuevo.
 */
export function buildDefaultAndRequirements(): Record<string, string[]> {
  return {}
}

/** Desencadenantes directos que el seed configura fuera de las recetas. */
export function buildDefaultTriggers(): Record<string, string[]> {
  return {
    'mundo-espiritual': ['proyeccion-astral'],
    magia: ['trickmaster'],
    sailor: ['iglesia-del-senor-de-las-tormentas'],
    sleepless: ['iglesia-de-la-noche-eterna'],
    'corpse-collector': ['iglesia-de-la-noche-eterna'],
    savant: ['iglesia-del-dios-del-vapor-y-la-maquinaria'],
    'mystery-pryer': ['iglesia-del-dios-del-vapor-y-la-maquinaria'],
    ave: ['unshadowed'],
    pluma: ['undying'],
    pilar: ['imperative-mage'],
    lobo: ['nightwatcher'],
  }
}
