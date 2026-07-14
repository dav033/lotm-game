import type { PrismaClient } from '@/generated/prisma/client'
import { buildRecipeInputKey } from '../domain/inputKey'

// Error de negocio: su mensaje puede mostrarse al administrador tal cual.
export class RecetaError extends Error {}

export type RecetaOutputInput = {
  elementId: string
  quantity: number
  chance: number
  sortOrder: number
}

export type RecetaInput = {
  name?: string | null
  outputs: RecetaOutputInput[]
  successText?: string | null
  hintText?: string | null
  isActive?: boolean
  ingredientes: { elementId: string; quantity: number }[]
}

// Deriva la inputKey a partir de los ids de elementos (nunca del cliente).
export async function derivarInputKey(
  db: PrismaClient,
  ingredientes: { elementId: string; quantity: number }[],
): Promise<string> {
  const ids = [...new Set(ingredientes.map((i) => i.elementId))]
  const elements = await db.element.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true },
  })
  if (elements.length !== ids.length) {
    throw new RecetaError('Alguno de los ingredientes seleccionados no existe.')
  }
  const slugOf = new Map(elements.map((e) => [e.id, e.slug]))
  return buildRecipeInputKey(
    ingredientes.map((i) => {
      const slug = slugOf.get(i.elementId)
      if (!slug) throw new RecetaError('Ingrediente desconocido.')
      return { slug, quantity: i.quantity }
    }),
  )
}

// Busca una receta equivalente (mismos ingredientes sin importar el orden).
export async function buscarRecetaEquivalente(
  db: PrismaClient,
  ingredientes: { elementId: string; quantity: number }[],
  excluirId?: string,
) {
  const inputKey = await derivarInputKey(db, ingredientes)
  const existente = await db.recipe.findUnique({
    where: { inputKey },
    include: { outputs: { include: { element: { select: { name: true } } } } },
  })
  if (existente && existente.id !== excluirId) return { inputKey, existente }
  return { inputKey, existente: null }
}

export async function crearReceta(db: PrismaClient, input: RecetaInput) {
  if (input.outputs.length === 0) {
    throw new RecetaError('La receta debe tener al menos un resultado.')
  }

  // Validar que todos los elementos de salida existen
  const outputElementIds = input.outputs.map((o) => o.elementId)
  const outputElements = await db.element.findMany({
    where: { id: { in: outputElementIds } },
  })
  if (outputElements.length !== outputElementIds.length) {
    throw new RecetaError('Alguno de los elementos resultantes no existe.')
  }
  const protectedSequence =
    (input.isActive ?? true)
      ? await db.advance.findFirst({
          where: {
            isActive: true,
            targetSequence: { elementId: { in: outputElementIds } },
          },
          select: { internalName: true },
        })
      : null
  if (protectedSequence) {
    throw new RecetaError(
      `Uno de los resultados está protegido por el avance «${protectedSequence.internalName}» y no puede tener una receta normal activa.`,
    )
  }

  const { inputKey, existente } = await buscarRecetaEquivalente(db, input.ingredientes)
  const advance = await db.advance.findUnique({ where: { inputKey }, select: { internalName: true } })
  if (advance) {
    throw new RecetaError(
      `Esta combinación ya está reservada por el avance interno «${advance.internalName}».`,
    )
  }
  if (existente) {
    const outputNames = existente.outputs.map((o) => o.element.name).join(', ')
    throw new RecetaError(
      `Ya existe una receta equivalente (produce ${outputNames}). El orden de los ingredientes no la hace distinta.`,
    )
  }

  return db.recipe.create({
    data: {
      name: input.name || null,
      inputKey,
      successText: input.successText || null,
      hintText: input.hintText || null,
      isActive: input.isActive ?? true,
      ingredients: {
        create: input.ingredientes.map((i) => ({
          elementId: i.elementId,
          quantity: i.quantity,
        })),
      },
      outputs: {
        create: input.outputs.map((o) => ({
          elementId: o.elementId,
          quantity: o.quantity,
          chance: o.chance,
          sortOrder: o.sortOrder,
        })),
      },
    },
    include: { ingredients: true, outputs: { include: { element: true } } },
  })
}

export async function actualizarReceta(db: PrismaClient, id: string, input: RecetaInput) {
  const actual = await db.recipe.findUnique({ where: { id } })
  if (!actual) throw new RecetaError('La receta no existe.')

  if (input.outputs.length === 0) {
    throw new RecetaError('La receta debe tener al menos un resultado.')
  }

  // Validar que todos los elementos de salida existen
  const outputElementIds = input.outputs.map((o) => o.elementId)
  const outputElements = await db.element.findMany({
    where: { id: { in: outputElementIds } },
  })
  if (outputElements.length !== outputElementIds.length) {
    throw new RecetaError('Alguno de los elementos resultantes no existe.')
  }
  const protectedSequence =
    (input.isActive ?? true)
      ? await db.advance.findFirst({
          where: {
            isActive: true,
            targetSequence: { elementId: { in: outputElementIds } },
          },
          select: { internalName: true },
        })
      : null
  if (protectedSequence) {
    throw new RecetaError(
      `Uno de los resultados está protegido por el avance «${protectedSequence.internalName}» y no puede tener una receta normal activa.`,
    )
  }

  const { inputKey, existente } = await buscarRecetaEquivalente(db, input.ingredientes, id)
  const advance = await db.advance.findUnique({ where: { inputKey }, select: { internalName: true } })
  if (advance) {
    throw new RecetaError(
      `Esta combinación ya está reservada por el avance interno «${advance.internalName}».`,
    )
  }
  if (existente) {
    const outputNames = existente.outputs.map((o) => o.element.name).join(', ')
    throw new RecetaError(
      `Ya existe otra receta equivalente (produce ${outputNames}).`,
    )
  }

  return db.$transaction(async (tx) => {
    await tx.recipeIngredient.deleteMany({ where: { recipeId: id } })
    await tx.recipeOutput.deleteMany({ where: { recipeId: id } })
    return tx.recipe.update({
      where: { id },
      data: {
        name: input.name || null,
        inputKey,
        successText: input.successText || null,
        hintText: input.hintText || null,
        isActive: input.isActive ?? true,
        ingredients: {
          create: input.ingredientes.map((i) => ({
            elementId: i.elementId,
            quantity: i.quantity,
          })),
        },
        outputs: {
          create: input.outputs.map((o) => ({
            elementId: o.elementId,
            quantity: o.quantity,
            chance: o.chance,
            sortOrder: o.sortOrder,
          })),
        },
      },
      include: { ingredients: true, outputs: { include: { element: true } } },
    })
  })
}
