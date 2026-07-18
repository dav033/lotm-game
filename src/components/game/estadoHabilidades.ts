import { facultadesBloqueadas, type PlayerAbilities, type PotentialTier } from '@/server/domain/habilidades'
import { advanceIdFromToken } from '@/server/domain/publicos'
import type { ApprenticeMemoryDelta } from '@/server/domain/tipos'
import { buildPairInputKey } from '@/shared/inputKey'

export type ModoInteraccion = 'normal' | 'vidente-objetivo'

export type ResultadoVidente = {
  elementId: string
  nombre: string
  availableCombinationCount: number
}

export type EstadoInteraccionHabilidades = {
  abilities: PlayerAbilities
  modoInteraccion: ModoInteraccion
  seerCargando: boolean
  seerResultado: ResultadoVidente | null
  mysteryActivo: boolean
  mysteryCargando: boolean
  potencialPorElemento: Record<string, PotentialTier>
  memoriaAprendiz: EstadoMemoriaAprendiz
}

export function crearEstadoInteraccionHabilidades(): EstadoInteraccionHabilidades {
  return {
    abilities: facultadesBloqueadas(),
    modoInteraccion: 'normal',
    seerCargando: false,
    seerResultado: null,
    mysteryActivo: false,
    mysteryCargando: false,
    potencialPorElemento: {},
    memoriaAprendiz: crearMemoriaAprendizVacia(),
  }
}

export function hayFacultadesDesbloqueadas(abilities: PlayerAbilities): boolean {
  return (
    abilities.seer.unlocked ||
    abilities.savant.unlocked ||
    abilities.mysteryPryer.unlocked ||
    abilities.apprenticeMemory.unlocked
  )
}

export function permiteArrastre(modo: ModoInteraccion): boolean {
  return modo === 'normal'
}

// ---------------------------------------------------------------------------
// Memoria del Aprendiz
// ---------------------------------------------------------------------------

export type EstadoMemoriaAprendiz = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  revision: string | null
  failedInputKeys: ReadonlySet<string>
}

export function crearMemoriaAprendizVacia(): EstadoMemoriaAprendiz {
  return { status: 'idle', revision: null, failedInputKeys: new Set() }
}

/**
 * ¿El par (slugA, slugB) figura en el historial de intentos sin resultado?
 * Único punto de cálculo reutilizado por la tarjeta objetivo, el receptáculo
 * y la ficha fantasma: nunca se compara `Set.has` a mano en un componente.
 * Devuelve false mientras la facultad no está desbloqueada, mientras el
 * historial no ha terminado de cargar, o si cualquiera de los dos valores es
 * un avance enmascarado (esto no aplica a esos tokens).
 */
export function parPreviamenteFallido(
  memoria: EstadoMemoriaAprendiz,
  unlocked: boolean,
  slugA: string | null | undefined,
  slugB: string | null | undefined,
): boolean {
  if (!unlocked || memoria.status !== 'ready') return false
  if (!slugA || !slugB) return false
  if (advanceIdFromToken(slugA) || advanceIdFromToken(slugB)) return false
  return memoria.failedInputKeys.has(buildPairInputKey(slugA, slugB))
}

/**
 * Reductor puro: aplica un delta incremental sobre el estado de memoria sin
 * mutar el Set anterior (siempre se crea una instancia nueva). FAILED añade
 * la clave; RESOLVED la retira. Repetir el mismo FAILED es idempotente.
 */
export function aplicarDeltaAMemoria(
  memoria: EstadoMemoriaAprendiz,
  delta: ApprenticeMemoryDelta,
): EstadoMemoriaAprendiz {
  const failedInputKeys = new Set(memoria.failedInputKeys)
  if (delta.status === 'FAILED') {
    failedInputKeys.add(delta.inputKey)
  } else {
    failedInputKeys.delete(delta.inputKey)
  }
  return { ...memoria, failedInputKeys }
}
