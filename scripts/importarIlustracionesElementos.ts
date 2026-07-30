// Importación masiva de ilustraciones de elementos.
//
// Uso:
//   node --import tsx scripts/importarIlustracionesElementos.ts [carpeta]
//
// Toma una carpeta local con imágenes nombradas por slug (ej. "ojo.png",
// "misticismo.webp") y actualiza el campo imageUrl del Elemento
// correspondiente. Los archivos se copian al almacén gestionado de imágenes
// (el mismo que usa el editor de cartas) para que queden servidos por
// /api/cards/images/<archivo>, igual que una imagen subida a mano.
//
// Un elemento sin archivo coincidente se deja como está (sigue mostrando su
// icono genérico); no hace falta tener las 343 ilustraciones listas para
// correr esto.

import fs from 'node:fs/promises'
import path from 'node:path'

try {
  process.loadEnvFile()
} catch {
  /* .env es opcional */
}

const EXTENSIONES_VALIDAS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
}

async function main() {
  const carpeta = path.resolve(process.argv[2] ?? 'data/ilustraciones-elementos')

  let entradas: string[]
  try {
    entradas = await fs.readdir(carpeta)
  } catch {
    console.error(`No se pudo leer la carpeta: ${carpeta}`)
    console.error('Pásala como argumento: node --import tsx scripts/importarIlustracionesElementos.ts <carpeta>')
    process.exitCode = 1
    return
  }

  // Imports diferidos: si DATABASE_URL falta, el error se ve después de
  // validar la carpeta, que es el fallo más común al ejecutar esto a mano.
  const { prisma } = await import('../src/server/db')
  const { storeCardImage } = await import('../src/cards/images')

  const archivos = entradas.filter((nombre) => EXTENSIONES_VALIDAS[path.extname(nombre).toLowerCase()])

  if (archivos.length === 0) {
    console.log(`No se encontraron imágenes reconocidas en ${carpeta}.`)
    return
  }

  console.log(`Encontradas ${archivos.length} imágenes en ${carpeta}. Importando…\n`)

  let actualizados = 0
  let sinElemento = 0
  let errores = 0

  for (const nombreArchivo of archivos) {
    const slug = path.basename(nombreArchivo, path.extname(nombreArchivo))
    const mime = EXTENSIONES_VALIDAS[path.extname(nombreArchivo).toLowerCase()]

    try {
      const elemento = await prisma.element.findUnique({ where: { slug } })
      if (!elemento) {
        console.log(`  ⚠ sin elemento con slug "${slug}" — se omite.`)
        sinElemento += 1
        continue
      }

      const bytes = await fs.readFile(path.join(carpeta, nombreArchivo))
      const url = await storeCardImage(new Uint8Array(bytes), mime)
      await prisma.element.update({ where: { id: elemento.id }, data: { imageUrl: url } })

      console.log(`  ✓ ${slug} → ${url}`)
      actualizados += 1
    } catch (error) {
      console.error(`  ✗ ${slug}: ${error instanceof Error ? error.message : error}`)
      errores += 1
    }
  }

  console.log(
    `\nListo: ${actualizados} actualizados, ${sinElemento} sin elemento coincidente, ${errores} con error.`,
  )
  await prisma.$disconnect()
}

main()
