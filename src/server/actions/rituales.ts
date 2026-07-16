'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '../db'
import { exigirAdminAccion, NoAutorizadoError } from '../adminAuth'
import { ritualSchema } from '../schemas'
import { derivarInputKey, RecetaError } from '../services/recetas'
import type { EstadoAccion } from './tipos'

function ingredientesDe(a: string, b: string) {
  return a === b
    ? [{ elementId: a, quantity: 2 }]
    : [{ elementId: a, quantity: 1 }, { elementId: b, quantity: 1 }]
}

export async function guardarRitual(
  id: string | null,
  _prev: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirAdminAccion()
    const parsed = ritualSchema.safeParse({
      name: formData.get('name') ?? '',
      ingredientAId: formData.get('ingredientAId') ?? '',
      ingredientBId: formData.get('ingredientBId') ?? '',
      advanceId: formData.get('advanceId') ?? '',
      requiredSequenceNumber: formData.get('requiredSequenceNumber') ?? 6,
      failureOutputIds: formData.getAll('failureOutputIds').map(String),
      isActive: formData.get('isActive') === 'on',
    })
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    const data = parsed.data
    const ingredients = ingredientesDe(data.ingredientAId, data.ingredientBId)
    const inputKey = await derivarInputKey(prisma, ingredients)
    const [recipe, advance, equivalent] = await Promise.all([
      prisma.recipe.findUnique({ where: { inputKey }, select: { id: true } }),
      prisma.advance.findUnique({ where: { inputKey }, select: { id: true } }),
      prisma.ritual.findUnique({ where: { inputKey }, select: { id: true } }),
    ])
    if (recipe || advance) return { ok: false, error: 'La fórmula ya pertenece a una receta o avance.' }
    if (equivalent && equivalent.id !== id) return { ok: false, error: 'Ya existe un ritual con esa fórmula.' }

    await prisma.$transaction(async (tx) => {
      const values = {
        name: data.name,
        inputKey,
        advanceId: data.advanceId,
        requiredSequenceNumber: data.requiredSequenceNumber,
        isActive: data.isActive,
      }
      const ritual = id
        ? await tx.ritual.update({ where: { id }, data: values })
        : await tx.ritual.create({ data: values })
      await tx.ritualIngredient.deleteMany({ where: { ritualId: ritual.id } })
      await tx.ritualFailureOutput.deleteMany({ where: { ritualId: ritual.id } })
      await tx.ritualIngredient.createMany({
        data: ingredients.map((ingredient) => ({ ritualId: ritual.id, ...ingredient })),
      })
      if (data.failureOutputIds.length > 0) {
        await tx.ritualFailureOutput.createMany({
          data: [...new Set(data.failureOutputIds)].map((elementId) => ({ ritualId: ritual.id, elementId })),
        })
      }
    })
    revalidatePath('/admin/rituales')
    return { ok: true, error: null }
  } catch (error) {
    if (error instanceof NoAutorizadoError) return { ok: false, error: 'No autorizado.' }
    if (error instanceof RecetaError) return { ok: false, error: error.message }
    console.error('[guardarRitual]', error)
    return { ok: false, error: 'No se pudo guardar el ritual.' }
  }
}

export async function eliminarRitual(id: string): Promise<void> {
  await exigirAdminAccion()
  await prisma.ritual.delete({ where: { id } })
  revalidatePath('/admin/rituales')
}
