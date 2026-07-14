import fs from 'node:fs'
import path from 'node:path'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '@/generated/prisma/client'

// Una única instancia de PrismaClient reutilizada entre recargas de dev
// (el hot-reload de Next crearía una conexión nueva por cada cambio).
const globalForPrisma = globalThis as unknown as { prismaGame?: PrismaClient }

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? 'file:./data/game.db'
  if (url.startsWith('file:') && !url.includes(':memory:')) {
    // Garantiza que la carpeta persistente exista antes de abrir el archivo.
    const file = url.slice('file:'.length)
    fs.mkdirSync(path.dirname(path.resolve(process.cwd(), file)), { recursive: true })
  }
  const adapter = new PrismaBetterSqlite3({ url })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prismaGame ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaGame = prisma

// Tipo del cliente transaccional: los servicios de dominio lo aceptan para
// poder ejecutarse dentro o fuera de una transacción (y contra otra BD en tests).
export type DbClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]
export type Db = PrismaClient | DbClient
