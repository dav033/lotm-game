'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '../db'
import { exigirAdminAccion, NoAutorizadoError } from '../adminAuth'
import { avanceSchema } from '../schemas'
import { derivarInputKey, RecetaError } from '../services/recetas'
import type { EstadoAccion } from './tipos'

function ingredientesDe(a: string, b: string) {
  return a === b
    ? [{ elementId: a, quantity: 2 }]
    : [
        { elementId: a, quantity: 1 },
        { elementId: b, quantity: 1 },
      ]
}

export async function guardarAvance(
  id: string | null,
  _prev: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirAdminAccion()
    const parsed = avanceSchema.safeParse({
      internalName: formData.get('internalName') ?? '',
      ingredientAId: formData.get('ingredientAId') ?? '',
      ingredientBId: formData.get('ingredientBId') ?? '',
      sourceSequenceId: formData.get('sourceSequenceId') ?? '',
      targetSequenceId: formData.get('targetSequenceId') ?? '',
      isActive: formData.get('isActive') === 'on',
    })
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }

    const data = parsed.data
    const ingredientes = ingredientesDe(data.ingredientAId, data.ingredientBId)
    const [inputKey, sequences] = await Promise.all([
      derivarInputKey(prisma, ingredientes),
      prisma.sequence.findMany({
        where: { id: { in: [data.sourceSequenceId, data.targetSequenceId] } },
      }),
    ])
    if (sequences.length !== 2) {
      return { ok: false, error: 'Alguna de las secuencias seleccionadas no existe.' }
    }
    if (new Set(sequences.map((sequence) => sequence.pathwayId)).size !== 1) {
      return { ok: false, error: 'Ambas secuencias deben pertenecer al mismo camino.' }
    }
    const targetSequence = sequences.find((sequence) => sequence.id === data.targetSequenceId)
    if (!targetSequence) {
      return { ok: false, error: 'La secuencia de destino no existe.' }
    }
    const directRecipe = await prisma.recipeOutput.findFirst({
      where: { elementId: targetSequence.elementId, recipe: { isActive: true } },
      include: { recipe: { select: { inputKey: true } } },
    })
    if (directRecipe) {
      return {
        ok: false,
        error:
          'La secuencia de destino aún tiene una receta normal activa. Desactiva o elimina esa receta para que solo pueda descubrirse mediante el avance.',
      }
    }

    const [recipe, equivalent] = await Promise.all([
      prisma.recipe.findUnique({ where: { inputKey }, select: { id: true } }),
      prisma.advance.findUnique({ where: { inputKey }, select: { id: true } }),
    ])
    if (recipe) {
      return { ok: false, error: 'Esa combinación ya pertenece a una receta normal.' }
    }
    if (equivalent && equivalent.id !== id) {
      return { ok: false, error: 'Ya existe otro avance con esa combinación.' }
    }

    await prisma.$transaction(async (tx) => {
      if (id) {
        const current = await tx.advance.findUnique({ where: { id }, select: { id: true } })
        if (!current) throw new Error('El avance no existe.')
        await tx.advanceIngredient.deleteMany({ where: { advanceId: id } })
        await tx.advance.update({
          where: { id },
          data: {
            internalName: data.internalName,
            inputKey,
            sourceSequenceId: data.sourceSequenceId,
            targetSequenceId: data.targetSequenceId,
            isActive: data.isActive,
            ingredients: { create: ingredientes },
          },
        })
      } else {
        await tx.advance.create({
          data: {
            internalName: data.internalName,
            inputKey,
            sourceSequenceId: data.sourceSequenceId,
            targetSequenceId: data.targetSequenceId,
            isActive: data.isActive,
            ingredients: { create: ingredientes },
          },
        })
      }
    })

    revalidatePath('/admin')
    revalidatePath('/admin/avances')
    return { ok: true, error: null }
  } catch (error) {
    if (error instanceof NoAutorizadoError) return { ok: false, error: 'No autorizado.' }
    if (error instanceof RecetaError) return { ok: false, error: error.message }
    console.error('[guardarAvance]', error)
    return { ok: false, error: 'No se pudo guardar el avance.' }
  }
}

export async function alternarAvanceActivo(id: string): Promise<void> {
  await exigirAdminAccion()
  const advance = await prisma.advance.findUnique({
    where: { id },
    include: { targetSequence: { select: { elementId: true } } },
  })
  if (!advance) return
  if (!advance.isActive) {
    const directRecipe = await prisma.recipeOutput.findFirst({
      where: { elementId: advance.targetSequence.elementId, recipe: { isActive: true } },
      select: { id: true },
    })
    if (directRecipe) return
  }
  await prisma.advance.update({ where: { id }, data: { isActive: !advance.isActive } })
  revalidatePath('/admin/avances')
}

export async function eliminarAvance(id: string): Promise<void> {
  await exigirAdminAccion()
  await prisma.advance.delete({ where: { id } })
  revalidatePath('/admin')
  revalidatePath('/admin/avances')
}
