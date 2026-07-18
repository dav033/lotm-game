// Predicado puro y compartido para el desbloqueo espontáneo de elementos.
//
// Un elemento se desbloquea cuando SE CUMPLE cualquiera de estas dos rutas:
//
//   1. Ruta directa (OR): el jugador descubrió cualquiera de sus
//      desencadenantes configurados (ElementUnlockTrigger).
//   2. Ruta de restricciones declarativas (AND entre los campos configurados):
//      - si `unlockedByType` está configurado, el jugador descubrió algún
//        elemento activo de ese tipo;
//      - si `unlockedBySequenceNumber` está configurado, el jugador descubrió
//        alguna Secuencia con ese número;
//      - si hay requisitos AND (`requiredElementIds`), el jugador descubrió
//        TODOS esos elementos.
//      Solo cuentan los campos realmente configurados; si ninguno lo está,
//      esta ruta no aplica. Cuando varios están configurados a la vez, TODOS
//      deben cumplirse (no basta con uno).
//
// Esta es la única fuente de verdad de la regla: el resolvedor en tiempo real
// (descubrimientos.ts), el analizador de potencial (diagnostico.ts) y el
// simulador de progresión (prisma/seed-content/progression-simulator.ts) la
// reutilizan para no divergir.

export type EspontaneoConfig = {
  unlockedByType: string | null
  unlockedBySequenceNumber: number | null
  requiredElementIds: readonly string[]
  triggerIds: readonly string[]
}

export type EspontaneoContexto = {
  discoveredIds: ReadonlySet<string>
  discoveredTypes: ReadonlySet<string>
  discoveredSequenceNumbers: ReadonlySet<number>
}

export function desbloqueoEspontaneoSatisfecho(
  el: EspontaneoConfig,
  ctx: EspontaneoContexto,
): boolean {
  const triggerSatisfecho = el.triggerIds.some((id) => ctx.discoveredIds.has(id))
  if (triggerSatisfecho) return true

  const grupoConfigurado =
    el.unlockedByType != null ||
    el.unlockedBySequenceNumber != null ||
    el.requiredElementIds.length > 0
  if (!grupoConfigurado) return false

  if (el.unlockedByType != null && !ctx.discoveredTypes.has(el.unlockedByType)) return false
  if (
    el.unlockedBySequenceNumber != null &&
    !ctx.discoveredSequenceNumbers.has(el.unlockedBySequenceNumber)
  ) {
    return false
  }
  if (
    el.requiredElementIds.length > 0 &&
    !el.requiredElementIds.every((id) => ctx.discoveredIds.has(id))
  ) {
    return false
  }

  return true
}
