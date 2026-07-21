import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { faseSchema, importAvanceSchema, importRecetaSchema, importRitualSchema } from './schemas'

describe('faseSchema', () => {
  it('coacciona los números del formulario y rechaza valores fuera de rango', () => {
    const parsed = faseSchema.safeParse({ slug: 'fase-3', name: 'Fase 3', sortOrder: '3' })
    assert.equal(parsed.success, true)
    assert.equal(parsed.success && parsed.data.sortOrder, 3)
    assert.equal(faseSchema.safeParse({ slug: 'x', name: 'X', sortOrder: 0 }).success, false)
    assert.equal(faseSchema.safeParse({ slug: 'Fase Mal', name: 'X', sortOrder: 1 }).success, false)
  })

  it('acepta grupos anidados de avance', () => {
    const parsed = faseSchema.safeParse({
      slug: 'fase-2',
      name: 'Fase 2',
      sortOrder: 2,
      advancementRule: {
        type: 'AND',
        conditions: [
          { type: 'DISCOVERY_COUNT', minimum: 10 },
          { type: 'ELEMENT_DISCOVERED', elementSlug: 'seer' },
        ],
      },
    })
    assert.equal(parsed.success, true)
  })

  it('valida el mensaje editable de celebración', () => {
    const base = { slug: 'fase-2', name: 'Fase 2', sortOrder: 2 }
    assert.equal(faseSchema.safeParse({ ...base, celebrationMessage: '' }).success, true)
    assert.equal(faseSchema.safeParse({ ...base, celebrationMessage: 'x'.repeat(500) }).success, true)
    assert.equal(faseSchema.safeParse({ ...base, celebrationMessage: 'x'.repeat(501) }).success, false)
    assert.equal(faseSchema.safeParse({ ...base, celebrationMessage: '<b>texto</b>' }).success, false)
  })
})

const pair = [
  { elementSlug: 'ojo', quantity: 1 },
  { elementSlug: 'moneda', quantity: 1 },
]

describe('validación de fórmulas importadas', () => {
  it('acepta exactamente dos unidades distintas o una autocombinación', () => {
    const recipe = {
      outputs: [{ elementSlug: 'vision', quantity: 1, chance: 1, sortOrder: 0 }],
      ingredientes: pair,
    }
    assert.equal(importRecetaSchema.safeParse(recipe).success, true)
    assert.equal(
      importRecetaSchema.safeParse({
        ...recipe,
        ingredientes: [{ elementSlug: 'ojo', quantity: 2 }],
      }).success,
      true,
    )
  })

  it('rechaza tres unidades, ingredientes repetidos y salidas repetidas', () => {
    const base = {
      outputs: [{ elementSlug: 'vision', quantity: 1, chance: 1, sortOrder: 0 }],
      ingredientes: pair,
    }
    assert.equal(
      importRecetaSchema.safeParse({
        ...base,
        ingredientes: [...pair, { elementSlug: 'tierra', quantity: 1 }],
      }).success,
      false,
    )
    assert.equal(
      importRecetaSchema.safeParse({
        ...base,
        ingredientes: [
          { elementSlug: 'ojo', quantity: 1 },
          { elementSlug: 'ojo', quantity: 1 },
        ],
      }).success,
      false,
    )
    assert.equal(
      importRecetaSchema.safeParse({ ...base, outputs: [base.outputs[0], base.outputs[0]] }).success,
      false,
    )
  })

  it('aplica la misma regla de dos unidades a avances y rituales', () => {
    assert.equal(
      importAvanceSchema.safeParse({
        internalName: 'Avance',
        pathwaySlug: 'camino',
        sourceSequenceNumber: 9,
        targetSequenceNumber: 8,
        ingredientes: pair,
      }).success,
      true,
    )
    assert.equal(
      importRitualSchema.safeParse({
        name: 'Ritual',
        advanceIngredients: pair,
        ingredientes: [{ elementSlug: 'ojo', quantity: 3 }],
      }).success,
      false,
    )
  })
})
