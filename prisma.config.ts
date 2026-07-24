import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    // El historial SQLite se conserva en prisma/migrations como referencia.
    // PostgreSQL parte de una línea base propia porque ambos dialectos SQL no
    // comparten archivos de migración.
    path: 'prisma/migrations-postgresql',
  },
  datasource: {
    // Prisma CLI usa conexión directa para migraciones y Prisma Studio. El
    // runtime utiliza DATABASE_URL (pooled) desde src/server/db.ts.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
})
