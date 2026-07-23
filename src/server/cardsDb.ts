import { CardRepository } from '@/cards/repository'

// Una única instancia reutilizada entre recargas de dev (mismo motivo que src/server/db.ts).
const globalForCards = globalThis as unknown as { cardsRepository?: CardRepository }

export const cardsRepository = globalForCards.cardsRepository ?? new CardRepository()

if (process.env.NODE_ENV !== 'production') globalForCards.cardsRepository = cardsRepository
