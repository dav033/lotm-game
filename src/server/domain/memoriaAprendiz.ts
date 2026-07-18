// Memoria del Aprendiz: filtra el historial persistente de intentos sin
// resultado (PlayerCombinationStat) hasta quedarse solo con pares de
// exactamente dos Elementos normales, activos y actualmente descubiertos por
// el perfil. Módulo puro: la consulta Prisma vive en
// server/services/memoriaAprendiz.ts.

import { parseInputKey, totalUnits } from './inputKey'

export type CombinationStatRow = {
  inputKey: string
  lastAttemptAt: Date
}

/**
 * Reduce filas ya prefiltradas por la consulta (attempts>0, successes=0,
 * recipeId null, advanceId null) al subconjunto de claves genuinamente
 * válidas para la Memoria del Aprendiz:
 *  - exactamente dos unidades de ingredientes (autocombinación incluida);
 *  - cada slug referenciado corresponde a un Elemento activo que el perfil
 *    tiene descubierto ahora mismo.
 * Una fila heredada corrupta (inputKey imposible de parsear) se ignora sin
 * interrumpir el resto de la respuesta.
 */
export function filtrarClavesValidas(
  rows: CombinationStatRow[],
  esElementoActivoDescubierto: (slug: string) => boolean,
): string[] {
  const validas: string[] = []
  for (const row of rows) {
    let ingredientes
    try {
      ingredientes = parseInputKey(row.inputKey)
    } catch {
      continue
    }
    if (totalUnits(ingredientes) !== 2) continue
    if (!ingredientes.every((i) => esElementoActivoDescubierto(i.slug))) continue
    validas.push(row.inputKey)
  }
  return validas.sort()
}

/**
 * Revisión estable derivada de metadatos del snapshot (recuento y fecha del
 * intento más reciente): cambia cuando el historial cambia, sin exponer
 * ningún identificador de perfil.
 */
export function calcularRevisionMemoria(count: number, latest: Date | null): string {
  return `${count}:${latest ? latest.getTime() : 0}`
}
