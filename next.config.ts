import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Permite validar producción mientras `next dev` usa su propia carpeta.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // better-sqlite3 es un módulo nativo: no debe empaquetarse en el bundle.
  serverExternalPackages: ['better-sqlite3'],
}

export default nextConfig
