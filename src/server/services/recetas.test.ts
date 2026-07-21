import assert from 'node:assert/strict'
import test from 'node:test'
import type { PrismaClient } from '@/generated/prisma/client'
import { actualizarReceta } from './recetas'

test('desvincula estadísticas históricas cuando cambia la fórmula de una receta', async () => {
  const statUpdates: unknown[] = []
  const elements = new Map([
    ['ingredient-a', { id: 'ingredient-a', slug: 'agua' }],
    ['ingredient-b', { id: 'ingredient-b', slug: 'tierra' }],
    ['output', { id: 'output', slug: 'barro' }],
  ])
  const actual = { id: 'recipe', inputKey: 'fuego*1|tierra*1' }
  const tx = {
    playerCombinationStat: {
      updateMany: async (args: unknown) => {
        statUpdates.push(args)
        return { count: 1 }
      },
    },
    recipeIngredient: { deleteMany: async () => ({ count: 2 }) },
    recipeOutput: { deleteMany: async () => ({ count: 1 }) },
    recipe: {
      update: async () => ({ ...actual, inputKey: 'agua*1|tierra*1' }),
    },
  }
  const db = {
    element: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.flatMap((id) => {
          const element = elements.get(id)
          return element ? [element] : []
        }),
    },
    advance: {
      findFirst: async () => null,
      findUnique: async () => null,
    },
    recipe: {
      findUnique: async ({ where }: { where: { id?: string; inputKey?: string } }) =>
        where.id ? actual : null,
    },
    $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx),
  } as unknown as PrismaClient

  await actualizarReceta(db, actual.id, {
    ingredientes: [
      { elementId: 'ingredient-a', quantity: 1 },
      { elementId: 'ingredient-b', quantity: 1 },
    ],
    outputs: [{ elementId: 'output', quantity: 1, chance: 1, sortOrder: 0 }],
  })

  assert.deepEqual(statUpdates, [{
    where: {
      recipeId: 'recipe',
      inputKey: { not: 'agua*1|tierra*1' },
    },
    data: { recipeId: null },
  }])
})
