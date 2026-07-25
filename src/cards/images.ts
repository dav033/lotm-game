import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

// Las imagenes que sube el editor se guardan como archivos junto a la base y
// solo su ruta viaja al SQLite, igual que las que referencia el MCP. Asi el
// servidor sigue siendo la fuente de verdad sin meter binarios en la base.
const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}
const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

export const CARD_IMAGE_URL_PREFIX = '/api/cards/images/'

export function resolveCardImageDir(): string {
  return path.resolve(process.env.CARDS_IMAGE_DIR || path.join('data', 'card-images'))
}

export function isStoredCardImage(source: string): boolean {
  return source.startsWith(CARD_IMAGE_URL_PREFIX)
}

// Resuelve un nombre de archivo dentro del directorio de imagenes rechazando
// cualquier intento de salir de el.
export function resolveCardImageFile(name: string): string {
  const decoded = decodeURIComponent(name)
  if (!/^[A-Za-z0-9._-]+$/.test(decoded) || decoded.startsWith('.')) {
    throw new Error('Nombre de imagen invalido.')
  }
  const directory = resolveCardImageDir()
  const file = path.resolve(directory, decoded)
  if (!file.startsWith(`${directory}${path.sep}`)) throw new Error('Nombre de imagen invalido.')
  return file
}

export function cardImageMime(file: string): string {
  return MIME_BY_EXTENSION[path.extname(file).slice(1).toLowerCase()] ?? 'application/octet-stream'
}

export async function storeCardImage(bytes: Uint8Array, mime: string): Promise<string> {
  const extension = EXTENSION_BY_MIME[mime]
  if (!extension) throw new Error(`Tipo de imagen no admitido: ${mime}`)
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('La imagen supera 15 MB.')

  const directory = resolveCardImageDir()
  await fs.mkdir(directory, { recursive: true })
  const filename = `${randomUUID()}.${extension}`
  await fs.writeFile(path.join(directory, filename), bytes)
  return `${CARD_IMAGE_URL_PREFIX}${filename}`
}
