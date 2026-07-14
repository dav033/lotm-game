import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../src/generated/prisma/client'
import { seedGameData } from './seed-data'

async function main() {
  const url = process.env.DATABASE_URL ?? 'file:./data/game.db'
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) })
  try {
    await seedGameData(prisma)
    console.log('Seed completado: categorías, elementos, camino, secuencia y recetas listos.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('El seed falló:', err)
  process.exit(1)
})
