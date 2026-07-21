import type { SimInput } from '../../../prisma/seed-content/progression-simulator'
import type { Db } from '../db'
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
export async function cargarAnalisisProgresion(db: Db) {
  const [elementos, recetas, secuencias, desencadenantes, avances, rituales, fases, featureGates] =
    await Promise.all([
      db.element.findMany({
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          iconKey: true,
          type: true,
          tier: true,
          isStarter: true,
          isActive: true,
          unlockedByType: true,
          unlockedBySequenceNumber: true,
          unlockedAtDiscoveryCount: true,
          availableFromPhaseId: true,
          availableFromPhase: { select: { sortOrder: true, isActive: true } },
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
          pathway: { select: { slug: true, isActive: true } },
          element: { select: { id: true, slug: true, isActive: true } },
        },
      }),
      db.elementUnlockTrigger.findMany({ select: { elementId: true, triggerId: true } }),
      db.advance.findMany({
        include: {
          ingredients: { include: { element: { select: { id: true, slug: true, isActive: true } } } },
          sourceSequence: {
            include: {
              element: { select: { id: true, slug: true, isActive: true } },
              pathway: { select: { slug: true, isActive: true } },
            },
          },
          targetSequence: {
            include: {
              element: { select: { id: true, slug: true, isActive: true } },
              pathway: { select: { slug: true, isActive: true } },
            },
          },
        },
      }),
      db.ritual.findMany({
        include: {
          advance: { select: { id: true, internalName: true } },
          ingredients: { include: { element: { select: { id: true, slug: true } } } },
          failureOutputs: { include: { element: { select: { id: true, slug: true } } } },
        },
        orderBy: { id: 'asc' },
      }),
      db.progressionPhase.findMany({
        orderBy: { sortOrder: 'asc' },
        select: { sortOrder: true, unlockAtDiscoveryCount: true, isActive: true },
      }),
      db.featureGate.findMany({
        select: { key: true, minimumPhaseSortOrder: true },
      }),
    ])

  const elementosDiag: DiagElement[] = elementos.map((e) => ({
    id: e.id,
    slug: e.slug,
    name: e.name,
    type: e.type,
    // El diagnóstico global analiza todas las fases activas; sus concesiones
    // son fuentes del grafo igual que los starters de la primera fase.
    isStarter: e.isStarter || e.availableFromPhase?.isActive === true,
    isActive:
      e.isActive &&
      (e.availableFromPhaseId === null || e.availableFromPhase?.isActive === true),
    unlockedByType: e.unlockedByType,
    unlockedBySequenceNumber: e.unlockedBySequenceNumber,
    unlockedAtDiscoveryCount: e.unlockedAtDiscoveryCount,
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
    isActive: s.pathway.isActive && s.element.isActive,
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

  const slugByElementId = new Map(elementos.map((element) => [element.id, element.slug]))
  const triggersBySlug: Record<string, string[]> = {}
  for (const trigger of desencadenantes) {
    const targetSlug = slugByElementId.get(trigger.elementId)
    const triggerSlug = slugByElementId.get(trigger.triggerId)
    if (targetSlug && triggerSlug) (triggersBySlug[targetSlug] ??= []).push(triggerSlug)
  }
  const simInput: SimInput = {
    elements: elementos.map((element) => ({
      slug: element.slug,
      type: element.type,
      isStarter: element.isStarter,
      isActive: element.isActive,
      unlockedByType: element.unlockedByType,
      unlockedBySequenceNumber: element.unlockedBySequenceNumber,
      unlockedAtDiscoveryCount: element.unlockedAtDiscoveryCount,
      availableFromPhaseOrder: element.availableFromPhase?.sortOrder ?? null,
      availableFromPhaseIsActive: element.availableFromPhase?.isActive,
    })),
    recipes: recetas.map((recipe) => ({
      ings: recipe.ingredients.map((ingredient) => [
        slugByElementId.get(ingredient.elementId)!,
        ingredient.quantity,
      ] as [string, number]),
      outputs: recipe.outputs.map((output) => slugByElementId.get(output.elementId)!),
      isActive: recipe.isActive,
    })),
    advances: avances.map((advance) => ({
      internalName: advance.internalName,
      ingredients: advance.ingredients.map((ingredient) => [
        ingredient.element.slug,
        ingredient.quantity,
      ] as [string, number]),
      source: advance.sourceSequence.element.slug,
      target: advance.targetSequence.element.slug,
      isActive: advance.isActive,
    })),
    sequences: secuencias.map((sequence) => ({
      slug: sequence.element.slug,
      number: sequence.number,
      pathwaySlug: sequence.pathway.slug,
      pathwayIsActive: sequence.pathway.isActive,
    })),
    rituals: rituales.map((ritual) => ({
      id: ritual.id,
      name: ritual.name,
      advanceName: ritual.advance.internalName,
      ingredients: ritual.ingredients.map((ingredient) => ingredient.element.slug),
      requiredSequenceNumber: ritual.requiredSequenceNumber,
      isActive: ritual.isActive,
      failureOutputs: ritual.failureOutputs.map((output) => output.element.slug),
    })),
    triggers: triggersBySlug,
    andRequirements: Object.fromEntries(
      elementos.map((element) => [
        element.slug,
        element.unlockRequirements.flatMap((requirement) => {
          const slug = slugByElementId.get(requirement.requiredElementId)
          return slug ? [slug] : []
        }),
      ]),
    ),
    phases: fases,
    featureGates: {
      ADVANCEMENT_RITUALS: featureGates.find(
        (gate) => gate.key === 'ADVANCEMENT_RITUALS',
      )?.minimumPhaseSortOrder,
    },
  }

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
    simInput,
  }
}

export type AnalisisProgresionCargado = Awaited<ReturnType<typeof cargarAnalisisProgresion>>
