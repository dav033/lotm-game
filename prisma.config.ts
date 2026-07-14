import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Ruta del archivo SQLite (relativa a la raíz del proyecto).
    url: process.env.DATABASE_URL ?? 'file:./data/game.db',
  },
})
