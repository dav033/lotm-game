import type { AchievementPublicData, ElementPublicData, RitualPublicData } from '@/server/domain/tipos'

export type { RecetaPendiente, RecetaPendienteElemento } from '@/server/domain/tipos'

export type ElementoDescubierto = ElementPublicData & {
  firstDiscoveredAt: string
  timesCreated: number
  quantity?: number
}

export type EstadoJuego = {
  elementos: ElementoDescubierto[]
  totalElementos: number
  descubiertos: number
  porcentaje: number
  pendingAchievements: AchievementPublicData[]
  rituals: RitualPublicData[]
}
