import {
  DISCOVERY_COUNT_TRANSITION_TARGET_SLUGS,
  PHASE1_CLOSURE_SLUGS,
  STARTER_SLUGS,
} from './progression'
import type { PhaseRule } from '../../src/shared/phaseRules'

export type ProgressionPhaseSeed = {
  slug: string
  name: string
  description: string
  sortOrder: number
  unlockAtDiscoveryCount: number
  advancementRule: PhaseRule
  celebrationMessage: string
  isActive: boolean
  openingElementSlugs: readonly string[]
}

// Cierre autoritativo de la Fase 2 con Edad reservada como siguiente frontera.
// La lista es acumulativa: incluye también los 42 elementos de la Fase 1.
export const PHASE_2_AVAILABLE_SLUGS = [
  'acumulacion',
  'adivinacion',
  'agua',
  'alegria',
  'apuesta',
  'avance',
  'beyonder',
  'campo',
  'canto',
  'ciclo',
  'ciudad',
  'comunidad',
  'continente',
  'continuidad',
  'cuerpo-espiritual',
  'desgaste',
  'destino',
  'era',
  'escucha',
  'esfuerzo',
  'espiritualidad',
  'extasis',
  'familia',
  'fortuna',
  'fuerza',
  'guerrero',
  'hielo',
  'hielo-eterno',
  'humano',
  'intuicion',
  'linaje',
  'mar',
  'misticismo',
  'moneda',
  'monster',
  'multitud',
  'mundo',
  'nacion',
  'observacion',
  'ojo',
  'percepcion',
  'percepcion-espiritual',
  'poder-beyonder',
  'retorno',
  'revelacion',
  'rio',
  'ritmo',
  'river-of-fate',
  'robot',
  'ruptura',
  'seer',
  'tierra',
  'trabajo',
  'vinculo',
  'vision',
  'vision-espiritual',
] as const

export const PROGRESSION_PHASES: readonly ProgressionPhaseSeed[] = [
  {
    slug: 'fase-1',
    name: 'Fase 1',
    description: 'Desde los cuatro elementos iniciales hasta la apertura mística.',
    sortOrder: 1,
    unlockAtDiscoveryCount: 0,
    advancementRule: { type: 'ALWAYS' },
    celebrationMessage: '',
    isActive: true,
    openingElementSlugs: STARTER_SLUGS,
  },
  {
    slug: 'fase-2',
    name: 'Fase 2',
    description: 'Desde la apertura mística hasta la frontera de Edad.',
    sortOrder: 2,
    unlockAtDiscoveryCount: PHASE1_CLOSURE_SLUGS.length,
    advancementRule: { type: 'DISCOVERY_COUNT', minimum: PHASE1_CLOSURE_SLUGS.length },
    celebrationMessage: 'Vas entendiendo cómo va esto.',
    isActive: true,
    openingElementSlugs: DISCOVERY_COUNT_TRANSITION_TARGET_SLUGS,
  },
  {
    slug: 'fase-3',
    name: 'Fase 3',
    description: 'Frontera futura que comienza con Edad.',
    sortOrder: 3,
    unlockAtDiscoveryCount: PHASE_2_AVAILABLE_SLUGS.length,
    advancementRule: { type: 'DISCOVERY_COUNT', minimum: PHASE_2_AVAILABLE_SLUGS.length },
    celebrationMessage: 'El tiempo pone todas las cosas en su lugar.',
    isActive: false,
    openingElementSlugs: ['edad'],
  },
] as const

export const BLOCKED_PHASE_FRONTIER_SLUGS = ['edad'] as const

export function openingPhaseSlugForElement(slug: string): string | null {
  for (const phase of PROGRESSION_PHASES) {
    if (phase.openingElementSlugs.includes(slug as never)) return phase.slug
  }
  return null
}
