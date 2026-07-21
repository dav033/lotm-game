import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SimInput } from '../../../prisma/seed-content/progression-simulator'
import {
  calcularBloqueadoresMinimos,
  calcularBloqueadoresRituales,
} from './bloqueadoresProgresion'

const element = (slug: string, extra: Partial<SimInput['elements'][number]> = {}) => ({
  slug,
  type: 'CONCEPTO',
  isStarter: false,
  isActive: true,
  unlockedByType: null,
  unlockedBySequenceNumber: null,
  unlockedAtDiscoveryCount: null,
  availableFromPhaseOrder: null,
  ...extra,
})

const input = (
  elements: SimInput['elements'],
  recipes: SimInput['recipes'] = [],
  extra: Partial<SimInput> = {},
): SimInput => ({
  elements,
  recipes,
  advances: [],
  sequences: [],
  rituals: [],
  triggers: {},
  andRequirements: {},
  ...extra,
})

describe('calcularBloqueadoresMinimos', () => {
  it('colapsa intermediarios y devuelve solo las hojas realmente faltantes', () => {
    const analysis = calcularBloqueadoresMinimos(
      input(
        ['x', 'y', 'a', 'b', 'c', 'd'].map((slug) => element(slug)),
        [
          { ings: [['y', 2]], outputs: ['x'] },
          { ings: [['a', 1], ['b', 1]], outputs: ['y'] },
          { ings: [['c', 1], ['d', 1]], outputs: ['a'] },
        ],
      ),
      new Set(['b']),
      1,
    )

    assert.deepEqual(analysis.x, { elementSlugs: ['c', 'd'], conditions: [], steps: 3 })
  })

  it('elige la ruta alternativa con menos bloqueadores y menor profundidad', () => {
    const analysis = calcularBloqueadoresMinimos(
      input(
        ['x', 'long', 'leaf', 'near'].map((slug) => element(slug)),
        [
          { ings: [['long', 2]], outputs: ['x'] },
          { ings: [['leaf', 2]], outputs: ['long'] },
          { ings: [['near', 2]], outputs: ['x'] },
        ],
      ),
      new Set(),
      1,
    )

    assert.deepEqual(analysis.x, { elementSlugs: ['near'], conditions: [], steps: 1 })
  })

  it('incluye ingredientes rituales en la frontera de un avance', () => {
    const analysis = calcularBloqueadoresMinimos(
      input(
        ['source', 'target', 'advance-a', 'advance-b', 'ritual', 'known', 'missing'].map(
          (slug) => element(slug),
        ),
        [],
        {
          advances: [{
            internalName: 'advance',
            ingredients: [['advance-a', 1], ['advance-b', 1]],
            source: 'source',
            target: 'target',
            isActive: true,
          }],
          sequences: [
            { slug: 'source', number: 8, pathwaySlug: 'path', pathwayIsActive: true },
            { slug: 'target', number: 7, pathwaySlug: 'path', pathwayIsActive: true },
          ],
          rituals: [{
            name: 'ritual test',
            advanceName: 'advance',
            ingredients: ['known', 'missing'],
            requiredSequenceNumber: 8,
            isActive: true,
            failureOutputs: [],
          }],
        },
      ),
      new Set(['source', 'advance-a', 'advance-b', 'ritual', 'known']),
      1,
    )

    assert.deepEqual(analysis.target, { elementSlugs: ['missing'], conditions: [], steps: 1 })
  })
})

describe('calcularBloqueadoresRituales', () => {
  it('expone solo las hojas faltantes para preparar un ritual disponible', () => {
    const graph = input(
      ['ritual', 'source', 'target', 'advance-a', 'advance-b', 'known', 'ingredient', 'leaf']
        .map((slug) => element(slug)),
      [{ ings: [['leaf', 2]], outputs: ['ingredient'], isActive: true }],
      {
        advances: [{
          internalName: 'advance',
          ingredients: [['advance-a', 1], ['advance-b', 1]],
          source: 'source',
          target: 'target',
          isActive: true,
        }],
        sequences: [
          { slug: 'source', number: 8, pathwaySlug: 'path', pathwayIsActive: true },
          { slug: 'target', number: 7, pathwaySlug: 'path', pathwayIsActive: true },
        ],
        rituals: [{
          id: 'ritual-1',
          name: 'ritual test',
          advanceName: 'advance',
          ingredients: ['known', 'ingredient'],
          requiredSequenceNumber: 8,
          isActive: true,
          failureOutputs: [],
        }],
      },
    )

    const analysis = calcularBloqueadoresRituales(
      graph,
      {
        discovered: new Set(['ritual', 'source', 'known']),
        availableRituals: new Set(['ritual-1']),
        preparedRituals: new Set(),
      },
      1,
    )

    assert.deepEqual(analysis['ritual-1'], {
      elementSlugs: ['leaf'],
      conditions: [],
      steps: 2,
    })
  })

  it('explica un avance inactivo sin inventar bloqueadores de elementos', () => {
    const graph = input(
      ['ritual', 'source', 'target', 'a', 'b'].map((slug) => element(slug)),
      [],
      {
        advances: [{
          internalName: 'inactive advance',
          ingredients: [['a', 1], ['b', 1]],
          source: 'source',
          target: 'target',
          isActive: false,
        }],
        sequences: [
          { slug: 'source', number: 8, pathwaySlug: 'path', pathwayIsActive: true },
          { slug: 'target', number: 7, pathwaySlug: 'path', pathwayIsActive: true },
        ],
        rituals: [{
          id: 'ritual-2',
          name: 'inactive ritual route',
          advanceName: 'inactive advance',
          ingredients: ['a', 'b'],
          requiredSequenceNumber: 8,
          isActive: true,
          failureOutputs: [],
        }],
      },
    )

    const analysis = calcularBloqueadoresRituales(
      graph,
      {
        discovered: new Set(),
        availableRituals: new Set(),
        preparedRituals: new Set(),
      },
      1,
    )

    assert.deepEqual(analysis['ritual-2'], {
      elementSlugs: [],
      conditions: ['El avance «inactive advance» está inactivo.'],
      steps: null,
    })
  })
})
