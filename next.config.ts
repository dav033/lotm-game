import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // better-sqlite3 es un módulo nativo: no debe empaquetarse en el bundle.
  serverExternalPackages: ['better-sqlite3'],
}

export default nextConfig
