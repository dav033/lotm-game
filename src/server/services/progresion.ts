import type { PrismaClient } from '@/generated/prisma/client'
import {
  analizarProgresion,
  type DiagAdvance,
  type DiagElement,
  type DiagElementResult,
  type DiagRecipe,
  type DiagSequence,
} from '../domain/diagnostico'

// Carga coordinada del grafo de progresión (elementos, recetas, secuencias,
// avances, rituales y desencadenantes) y su análisis de alcanzabilidad. Lo
// comparten el panel de diagnóstico, la lista de elementos y la exportación
// nominal: una sola consulta, un solo mapeo, una sola fuente de verdad para
// profundidad, dificultad y rutas.
export async function cargarAnalisisProgresion(db: PrismaClient) {
  const [elementos, recetas, secuencias, desencadenantes, avances, rituales] =
    await Promise.all([
      db.element.findMany({
        select: {
          id: true,
          slug: true,
          name: true,
          type: true,
          isStarter: true,
          isActive: true,
          unlockedByType: true,
          unlockedBySequenceNumber: true,
          unlockRequirements: { select: { requiredElementId: true } },
        },
      }),
      db.recipe.findMany({
        include: {
          ingredients: { include: { element: { select: { name: true, isActive: true } } } },
          outputs: {
            include: {
              element: {
                include: {
                  sequence: { include: { pathway: true } },
                },
              },
            },
          },
        },
      }),
      db.sequence.findMany({
        include: {
          pathway: { select: { isActive: true } },
          element: { select: { id: true } },
        },
      }),
      db.elementUnlockTrigger.findMany({ select: { elementId: true, triggerId: true } }),
      db.advance.findMany({
        include: {
          ingredients: { include: { element: { select: { id: true } } } },
          sourceSequence: {
            include: {
              element: { select: { id: true } },
              pathway: { select: { isActive: true } },
            },
          },
          targetSequence: {
            include: {
              element: { select: { id: true } },
              pathway: { select: { isActive: true } },
            },
          },
        },
      }),
      db.ritual.findMany({
        include: {
          advance: { select: { id: true } },
          ingredients: { include: { element: { select: { id: true } } } },
          failureOutputs: { include: { element: { select: { id: true } } } },
        },
        orderBy: { id: 'asc' },
      }),
    ])

  const elementosDiag: DiagElement[] = elementos.map((e) => ({
    id: e.id,
    slug: e.slug,
    name: e.name,
    type: e.type,
    isStarter: e.isStarter,
    isActive: e.isActive,
    unlockedByType: e.unlockedByType,
    unlockedBySequenceNumber: e.unlockedBySequenceNumber,
    requiredElementIds: e.unlockRequirements.map((r) => r.requiredElementId),
  }))

  const recetasDiag: DiagRecipe[] = recetas.map((r) => ({
    id: r.id,
    inputKey: r.inputKey,
    isActive: r.isActive,
    outputElementIds: r.outputs.map((o) => o.elementId),
    ingredients: r.ingredients.map((i) => ({ elementId: i.elementId, quantity: i.quantity })),
  }))

  const secuenciasDiag: DiagSequence[] = secuencias.map((s) => ({
    id: s.id,
    elementId: s.elementId,
    pathwayId: s.pathwayId,
    number: s.number,
    name: s.name,
    isActive: s.pathway.isActive,
  }))

  const ritualesPorAvance = new Map<string, typeof rituales>()
  for (const r of rituales) {
    const lista = ritualesPorAvance.get(r.advance.id) ?? []
    lista.push(r)
    ritualesPorAvance.set(r.advance.id, lista)
  }

  const avancesDiag: DiagAdvance[] = avances.map((a) => ({
    id: a.id,
    internalName: a.internalName,
    inputKey: a.inputKey,
    isActive: a.isActive,
    sourceSequenceId: a.sourceSequenceId,
    targetSequenceId: a.targetSequenceId,
    ingredients: a.ingredients.map((i) => ({ elementId: i.elementId, quantity: i.quantity })),
    rituals: (ritualesPorAvance.get(a.id) ?? []).map((r) => ({
      id: r.id,
      advanceId: a.id,
      name: r.name,
      inputKey: r.inputKey,
      isActive: r.isActive,
      requiredSequenceNumber: r.requiredSequenceNumber,
      ingredients: r.ingredients.map((i) => ({ elementId: i.elementId, quantity: i.quantity })),
      failureOutputIds: r.failureOutputs.map((o) => o.elementId),
    })),
  }))

  const ritualesDiag = avancesDiag.flatMap((a) => a.rituals)

  const analisis: Map<string, DiagElementResult> = analizarProgresion(
    elementosDiag,
    recetasDiag,
    secuenciasDiag,
    avancesDiag,
    desencadenantes,
  )

  return {
    analisis,
    // Filas en crudo (con relaciones) para vistas de detalle.
    elementos,
    recetas,
    secuencias,
    avances,
    rituales,
    desencadenantes,
    // Entradas ya mapeadas del dominio, por si hace falta re-analizar.
    elementosDiag,
    recetasDiag,
    secuenciasDiag,
    avancesDiag,
    ritualesDiag,
  }
}

export type AnalisisProgresionCargado = Awaited<ReturnType<typeof cargarAnalisisProgresion>>
