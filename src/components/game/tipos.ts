import type { AchievementPublicData, ElementPublicData } from '@/server/domain/tipos'
import type { PlayerAbilities } from '@/server/domain/habilidades'
import type { PublicRitualState } from '@/server/domain/ritualKnowledge'

export type { RecetaPendiente, RecetaPendienteElemento } from '@/server/domain/tipos'
export type { PlayerAbilities } from '@/server/domain/habilidades'

export type ElementoDescubierto = ElementPublicData & {
  firstDiscoveredAt: string
  timesCreated: number
  quantity?: number
}

export type InstanciaBandeja = {
  instanceId: string
  elemento: ElementoDescubierto
  /** Posición normalizada para conservar la distribución al redimensionar. */
  x: number
  y: number
}

export type EstadoJuego = {
  elementos: ElementoDescubierto[]
  totalElementos: number
  descubiertos: number
  porcentaje: number
  pendingAchievements: AchievementPublicData[]
  ritualState: PublicRitualState
  abilities: PlayerAbilities
}

// ===== Arrastre (drag & drop por Pointer Events) =====
export type OrigenArrastre =
  | { tipo: 'panel' }
  | { tipo: 'slot'; index: number }
  | { tipo: 'bandeja'; instanceId: string }

export type PayloadArrastre = {
  slug: string
  name: string
  iconKey: string
  origen: OrigenArrastre
}

export type DestinoArrastre =
  | {
      tipo: 'elemento'
      slug: string
      bandejaInstanceId?: string
      bandejaX?: number
      bandejaY?: number
    }
  | { tipo: 'slot'; index: number }
  | { tipo: 'bandeja'; x: number; y: number }
  | null
