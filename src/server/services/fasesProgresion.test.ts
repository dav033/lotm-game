import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SimInput } from '../../../prisma/seed-content/progression-simulator'
import type { Db } from '../db'
import {
  analizarFaseDesdeSim,
  calcularPertenenciaFasesPorAlcance,
  calcularUmbralesDesdeSim,
  sincronizarStartersConPrimeraFase,
} from './fasesProgresion'

// Grafo mínimo: a y b son iniciales de la fase 1; a+b → c (fase 1);
// c+a → d, donde d pertenece a la fase 2. Cierre de fase 1 = {a, b, c} = 3,
// así que la fase 2 debe abrir exactamente en 3, sin importar el umbral
// almacenado (aquí uno obsoleto: 99).
function elemento(slug: string, fase: number | null, isStarter = false): SimInput['elements'][number] {
  return {
    slug,
    type: 'MUNDANO',
    isStarter,
    isActive: true,
    unlockedByType: null,
    unlockedBySequenceNumber: null,
    unlockedAtDiscoveryCount: null,
    availableFromPhaseOrder: fase,
  }
}

const simInput: SimInput = {
  elements: [
    elemento('a', 1, true),
    elemento('b', 1, true),
    elemento('c', null),
    elemento('d', 2),
  ],
  recipes: [
    { ings: [['a', 1], ['b', 1]], outputs: ['c'], isActive: true },
    { ings: [['c', 1], ['a', 1]], outputs: ['d'], isActive: true },
  ],
  advances: [],
  sequences: [],
  rituals: [],
  triggers: {},
  andRequirements: {},
  phases: [
    { sortOrder: 1, unlockAtDiscoveryCount: 0, isActive: true },
    { sortOrder: 2, unlockAtDiscoveryCount: 99, isActive: true },
  ],
}

describe('calcularUmbralesDesdeSim', () => {
  it('deriva el umbral de cada fase del cierre real de la anterior', () => {
    const umbrales = calcularUmbralesDesdeSim(simInput)
    assert.equal(umbrales.get(1), 0)
    assert.equal(umbrales.get(2), 3)
  })

  it('ignora fases inactivas y no propone umbral para ellas', () => {
    const umbrales = calcularUmbralesDesdeSim({
      ...simInput,
      phases: [
        { sortOrder: 1, unlockAtDiscoveryCount: 0, isActive: true },
        { sortOrder: 2, unlockAtDiscoveryCount: 99, isActive: false },
      ],
    })
    assert.equal(umbrales.get(1), 0)
    assert.equal(umbrales.has(2), false)
  })

  it('recalcula la fase que habilita rituales sin crear un bloqueo circular', () => {
    const gated: SimInput = {
      elements: [
        elemento('a', 1, true),
        elemento('ritual', 1, true),
        elemento('source', 1, true),
        elemento('target', null),
      ],
      recipes: [],
      advances: [{
        internalName: 'ritualized',
        ingredients: [['a', 2]],
        source: 'source',
        target: 'target',
        isActive: true,
      }],
      sequences: [
        { slug: 'source', number: 9, pathwaySlug: 'path', pathwayIsActive: true },
        { slug: 'target', number: 8, pathwaySlug: 'path', pathwayIsActive: true },
      ],
      rituals: [{
        id: 'ritual-1',
        name: 'Ritual',
        advanceName: 'ritualized',
        ingredients: ['a'],
        requiredSequenceNumber: 9,
        isActive: true,
        failureOutputs: [],
      }],
      triggers: {},
      andRequirements: {},
      phases: [
        { sortOrder: 1, unlockAtDiscoveryCount: 0, isActive: true },
        { sortOrder: 6, unlockAtDiscoveryCount: 99, isActive: true },
      ],
      featureGates: { ADVANCEMENT_RITUALS: 6 },
    }

    const umbrales = calcularUmbralesDesdeSim(gated)
    assert.equal(umbrales.get(6), 3)
    const fase6 = analizarFaseDesdeSim({
      ...gated,
      phases: gated.phases?.map((phase) => ({
        ...phase,
        unlockAtDiscoveryCount: umbrales.get(phase.sortOrder) ?? phase.unlockAtDiscoveryCount,
      })),
    }, 6)
    assert.deepEqual(fase6.reachableRitualIds, ['ritual-1'])
    assert.equal(fase6.reachableSlugs.includes('target'), true)
  })
})

describe('calcularPertenenciaFasesPorAlcance', () => {
  it('asigna cualquier alcanzable solo a la primera fase donde aparece', () => {
    const membership = calcularPertenenciaFasesPorAlcance([
      {
        id: 'phase-2',
        sortOrder: 3,
        isActive: true,
        initialElementIds: ['phase-2-opening'],
        reachableElementIds: [
          'opening',
          'recipe-result',
          'spontaneous-result',
          'advance-result',
          'ritual-result',
          'phase-2-opening',
          'phase-2-result',
        ],
        reachableRitualIds: ['ritual-1', 'ritual-2'],
      },
      {
        id: 'phase-1',
        sortOrder: 1,
        isActive: true,
        initialElementIds: ['opening'],
        reachableElementIds: [
          'opening',
          'recipe-result',
          'spontaneous-result',
          'advance-result',
          'ritual-result',
        ],
        reachableRitualIds: ['ritual-1'],
      },
      {
        id: 'phase-inactive',
        sortOrder: 2,
        isActive: false,
        initialElementIds: ['inactive-opening'],
        reachableElementIds: [
          'opening',
          'recipe-result',
          'spontaneous-result',
          'advance-result',
          'ritual-result',
        ],
        reachableRitualIds: ['ritual-1'],
      },
    ])

    assert.deepEqual(membership.get('phase-1'), {
      initialElementIds: ['opening'],
      newReachableElementIds: [
        'recipe-result',
        'spontaneous-result',
        'advance-result',
        'ritual-result',
      ],
      ownElementIds: [
        'opening',
        'recipe-result',
        'spontaneous-result',
        'advance-result',
        'ritual-result',
      ],
      newReachableRitualIds: ['ritual-1'],
      ownRitualIds: ['ritual-1'],
    })
    assert.deepEqual(membership.get('phase-inactive'), {
      initialElementIds: ['inactive-opening'],
      newReachableElementIds: [],
      ownElementIds: ['inactive-opening'],
      newReachableRitualIds: [],
      ownRitualIds: [],
    })
    assert.deepEqual(membership.get('phase-2'), {
      initialElementIds: ['phase-2-opening'],
      newReachableElementIds: ['phase-2-result'],
      ownElementIds: ['phase-2-opening', 'phase-2-result'],
      newReachableRitualIds: ['ritual-2'],
      ownRitualIds: ['ritual-2'],
    })

    const ownedIds = [...membership.values()].flatMap((phase) => phase.ownElementIds)
    assert.equal(new Set(ownedIds).size, ownedIds.length)
    const ownedRitualIds = [...membership.values()].flatMap((phase) => phase.ownRitualIds)
    assert.deepEqual(ownedRitualIds.sort(), ['ritual-1', 'ritual-2'])
    const finalReachable = [
      'opening',
      'recipe-result',
      'spontaneous-result',
      'advance-result',
      'ritual-result',
      'phase-2-opening',
      'phase-2-result',
    ]
    assert.equal(finalReachable.every((id) => ownedIds.includes(id)), true)
  })
})

function elementoAnalisis(
  slug: string,
  fase: number | null,
  extra: Partial<SimInput['elements'][number]> = {},
): SimInput['elements'][number] {
  return {
    slug,
    type: 'MUNDANO',
    isStarter: false,
    isActive: true,
    unlockedByType: null,
    unlockedBySequenceNumber: null,
    unlockedAtDiscoveryCount: null,
    availableFromPhaseOrder: fase,
    ...extra,
  }
}

const fasesAnalisis = [
  { sortOrder: 1, unlockAtDiscoveryCount: 0, isActive: true },
  { sortOrder: 2, unlockAtDiscoveryCount: 99, isActive: true },
]

describe('analizarFaseDesdeSim', () => {
  it('sella fases posteriores sin congelar desbloqueos espontáneos por cantidad', () => {
    const analysis = analizarFaseDesdeSim({
      elements: [
        elementoAnalisis('a', 1, { isStarter: true }),
        elementoAnalisis('b', null),
        elementoAnalisis('c', null, { unlockedAtDiscoveryCount: 2 }),
        elementoAnalisis('future', 2),
      ],
      recipes: [
        { ings: [['a', 2]], outputs: ['b'], isActive: true },
        { ings: [['a', 1], ['b', 1]], outputs: ['future'], isActive: true },
      ],
      advances: [],
      sequences: [],
      rituals: [],
      triggers: {},
      andRequirements: {},
      phases: fasesAnalisis,
    }, 1)

    assert.deepEqual(analysis.reachableSlugs, ['a', 'b', 'c'])
    assert.equal(analysis.reachableSlugs.includes('future'), false)
  })

  it('distingue el pool sin ruta de las aperturas de fases futuras', () => {
    const analysis = analizarFaseDesdeSim({
      elements: [
        elementoAnalisis('a', 1, { isStarter: true }),
        elementoAnalisis('b', 1, { isStarter: true }),
        elementoAnalisis('source', 1, { isStarter: true }),
        elementoAnalisis('ritual', 1, { isStarter: true }),
        elementoAnalisis('orphan', null),
        elementoAnalisis('recipe-target', 2),
        elementoAnalisis('spontaneous-target', 2, { unlockedAtDiscoveryCount: 4 }),
        elementoAnalisis('advance-target', 2),
        elementoAnalisis('ritual-target', 2),
        elementoAnalisis('deep-target', 2),
      ],
      recipes: [
        { ings: [['a', 1], ['b', 1]], outputs: ['recipe-target'], isActive: true },
        { ings: [['a', 1], ['recipe-target', 1]], outputs: ['deep-target'], isActive: true },
      ],
      advances: [
        {
          internalName: 'advance',
          ingredients: [['a', 1], ['b', 1]],
          source: 'source',
          target: 'advance-target',
          isActive: true,
        },
        {
          internalName: 'ritual-advance',
          ingredients: [['a', 1], ['b', 1]],
          source: 'source',
          target: 'ritual-target',
          isActive: true,
        },
      ],
      sequences: [
        { slug: 'source', number: 6, pathwaySlug: 'path', pathwayIsActive: true },
        { slug: 'advance-target', number: 5, pathwaySlug: 'path', pathwayIsActive: true },
        { slug: 'ritual-target', number: 4, pathwaySlug: 'path', pathwayIsActive: true },
      ],
      rituals: [
        {
          name: 'Ritual de prueba',
          advanceName: 'ritual-advance',
          ingredients: ['a', 'b'],
          requiredSequenceNumber: 6,
          isActive: true,
          failureOutputs: [],
        },
      ],
      triggers: {},
      andRequirements: {},
      phases: fasesAnalisis,
    }, 1)

    assert.deepEqual(analysis.unreachableAvailableSlugs, ['orphan'])
    assert.deepEqual(analysis.frontierSlugs, [
      'advance-target',
      'deep-target',
      'recipe-target',
      'ritual-target',
      'spontaneous-target',
    ])
  })

  it('calcula impacto real sin contar resultados que conservan una ruta alternativa', () => {
    const analysis = analizarFaseDesdeSim({
      elements: [
        elementoAnalisis('a', 1, { isStarter: true }),
        elementoAnalisis('b', 1, { isStarter: true }),
        elementoAnalisis('source', 1, { isStarter: true }),
        elementoAnalisis('ritual', 1, { isStarter: true }),
        elementoAnalisis('recipe-target', null),
        elementoAnalisis('spontaneous-target', null),
        elementoAnalisis('advance-target', null),
        elementoAnalisis('ritual-target', null),
        elementoAnalisis('alternative-target', null),
      ],
      recipes: [
        { ings: [['a', 1], ['b', 1]], outputs: ['recipe-target'], isActive: true },
        { ings: [['a', 1], ['b', 1]], outputs: ['alternative-target'], isActive: true },
        { ings: [['b', 2]], outputs: ['alternative-target'], isActive: true },
      ],
      advances: [
        {
          internalName: 'advance',
          ingredients: [['a', 1], ['b', 1]],
          source: 'source',
          target: 'advance-target',
          isActive: true,
        },
        {
          internalName: 'ritual-advance',
          ingredients: [['a', 1], ['b', 1]],
          source: 'source',
          target: 'ritual-target',
          isActive: true,
        },
      ],
      sequences: [
        { slug: 'source', number: 6, pathwaySlug: 'path', pathwayIsActive: true },
        { slug: 'advance-target', number: 5, pathwaySlug: 'path', pathwayIsActive: true },
        { slug: 'ritual-target', number: 4, pathwaySlug: 'path', pathwayIsActive: true },
      ],
      rituals: [
        {
          name: 'Ritual de prueba',
          advanceName: 'ritual-advance',
          ingredients: ['a', 'b'],
          requiredSequenceNumber: 6,
          isActive: true,
          failureOutputs: [],
        },
      ],
      triggers: { 'spontaneous-target': ['a'] },
      andRequirements: {},
      phases: [fasesAnalisis[0]],
    }, 1)

    assert.deepEqual(analysis.impactSlugsBySourceSlug.a, [
      'advance-target',
      'recipe-target',
      'ritual-target',
      'spontaneous-target',
    ])
    assert.equal(analysis.impactSlugsBySourceSlug.a.includes('alternative-target'), false)
  })
})

describe('sincronizarStartersConPrimeraFase', () => {
  it('deriva los starters de las aperturas de la primera fase activa', async () => {
    const updates: unknown[] = []
    const db = {
      progressionPhase: {
        findFirst: async () => ({ id: 'phase-1' }),
      },
      element: {
        updateMany: async (args: unknown) => {
          updates.push(args)
          return { count: 1 }
        },
      },
    } as unknown as Db

    assert.equal(await sincronizarStartersConPrimeraFase(db), 2)
    assert.deepEqual(updates, [
      {
        where: {
          isStarter: true,
          OR: [
            { availableFromPhaseId: null },
            { availableFromPhaseId: { not: 'phase-1' } },
          ],
        },
        data: { isStarter: false },
      },
      {
        where: {
          isStarter: false,
          availableFromPhaseId: 'phase-1',
        },
        data: { isStarter: true },
      },
    ])
  })

  it('limpia los starters cuando no queda ninguna fase activa', async () => {
    let update: unknown
    const db = {
      progressionPhase: { findFirst: async () => null },
      element: {
        updateMany: async (args: unknown) => {
          update = args
          return { count: 3 }
        },
      },
    } as unknown as Db

    assert.equal(await sincronizarStartersConPrimeraFase(db), 3)
    assert.deepEqual(update, {
      where: { isStarter: true },
      data: { isStarter: false },
    })
  })
})
