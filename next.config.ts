import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Permite validar producción mientras `next dev` usa su propia carpeta.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // better-sqlite3 es un módulo nativo: no debe empaquetarse en el bundle.
  // ffmpeg-static calcula la ruta de su binario desde __dirname; empaquetado,
  // esa ruta acaba en `\ROOT\...` y el spawn falla con ENOENT.
  serverExternalPackages: ['better-sqlite3', 'ffmpeg-static'],
}

export default nextConfig
