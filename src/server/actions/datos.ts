'use server'

import { revalidatePath } from 'next/cache'
import { exigirAdminAccion, NoAutorizadoError } from '../adminAuth'
import { prisma } from '../db'
import {
  importarContenido,
  ImportError,
  validarDocumento,
  type ResumenImportacion,
} from '../services/datos'
import { sincronizarUmbralesFases } from '../services/fasesProgresion'

const MAX_JSON = 5 * 1024 * 1024 // 5 MB

function parsear(jsonTexto: string): unknown {
  if (jsonTexto.length > MAX_JSON) throw new ImportError('El archivo supera los 5 MB.')
  try {
    return JSON.parse(jsonTexto)
  } catch {
    throw new ImportError('El archivo no es JSON válido.')
  }
}

// Paso 1: validar y devolver un resumen SIN escribir nada.
export async function validarImportacion(
  jsonTexto: string,
): Promise<{ ok: boolean; resumen: ResumenImportacion | null; error: string | null }> {
  try {
    await exigirAdminAccion()
    const { resumen } = validarDocumento(parsear(jsonTexto))
    return { ok: true, resumen, error: null }
  } catch (err) {
    if (err instanceof NoAutorizadoError) return { ok: false, resumen: null, error: 'No autorizado.' }
    if (err instanceof ImportError) return { ok: false, resumen: null, error: err.message }
    console.error('[validarImportacion]', err)
    return { ok: false, resumen: null, error: 'No se pudo validar el archivo.' }
  }
}

// Paso 2: importar en una transacción; si algo falla no queda nada a medias.
export async function ejecutarImportacion(
  jsonTexto: string,
  modo: 'reemplazar' | 'fusionar',
): Promise<{ ok: boolean; resumen: ResumenImportacion | null; error: string | null }> {
  try {
    await exigirAdminAccion()
    if (modo !== 'reemplazar' && modo !== 'fusionar') {
      return { ok: false, resumen: null, error: 'Modo de importación desconocido.' }
    }
    const resumen = await importarContenido(prisma, parsear(jsonTexto), modo)
    await sincronizarUmbralesFases(prisma)
    revalidatePath('/admin')
    revalidatePath('/coleccion')
    return { ok: true, resumen, error: null }
  } catch (err) {
    if (err instanceof NoAutorizadoError) return { ok: false, resumen: null, error: 'No autorizado.' }
    if (err instanceof ImportError) return { ok: false, resumen: null, error: err.message }
    console.error('[ejecutarImportacion]', err)
    return { ok: false, resumen: null, error: 'La importación falló; no se guardó ningún dato.' }
  }
}
