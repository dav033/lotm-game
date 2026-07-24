import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

// Una única instancia de PrismaClient reutilizada entre recargas de dev
// (el hot-reload de Next crearía una conexión nueva por cada cambio).
const globalForPrisma = globalThis as unknown as { prismaGame?: PrismaClient }

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'Falta DATABASE_URL. Usa la conexión PostgreSQL pooled de Supabase para el runtime.',
    )
  }

  const configuredMax = Number(process.env.DATABASE_POOL_MAX ?? 10)
  const max = Number.isInteger(configuredMax) && configuredMax > 0 ? configuredMax : 10
  const adapter = new PrismaPg({
    connectionString,
    max,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prismaGame ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaGame = prisma

// Tipo del cliente transaccional: los servicios de dominio lo aceptan para
// poder ejecutarse dentro o fuera de una transacción (y contra otra BD en tests).
export type DbClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]
export type Db = PrismaClient | DbClient
