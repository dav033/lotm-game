import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { simulateProgression, type SimElement, type SimInput } from './progression-simulator'

function element(slug: string, partial: Partial<SimElement> = {}): SimElement {
  return {
    slug,
    type: 'CONCEPTO',
    isStarter: false,
    isActive: true,
    unlockedByType: null,
    unlockedBySequenceNumber: null,
    unlockedAtDiscoveryCount: null,
    ...partial,
  }
}

function input(elements: SimElement[]): SimInput {
  return {
    elements,
    recipes: [],
    advances: [],
    sequences: [],
    rituals: [],
    triggers: {},
    andRequirements: {},
  }
}

describe('paridad del simulador con reglas runtime', () => {
  it('mantiene el pool global orgánico y concede solo las aperturas de fases activas', () => {
    const graph = input([
      element('starter', { isStarter: true, availableFromPhaseOrder: 1 }),
      element('global'),
      element('opening', { availableFromPhaseOrder: 2 }),
      element('inactive-opening', {
        availableFromPhaseOrder: 3,
        availableFromPhaseIsActive: false,
      }),
    ])
    graph.phases = [
      { sortOrder: 1, unlockAtDiscoveryCount: 0, isActive: true },
      { sortOrder: 2, unlockAtDiscoveryCount: 1, isActive: true },
      { sortOrder: 3, unlockAtDiscoveryCount: 2, isActive: false },
    ]

    const result = simulateProgression(graph)
    assert.equal(result.discovered.has('starter'), true)
    assert.equal(result.discovered.has('opening'), true)
    assert.equal(result.discovered.has('global'), false)
    assert.equal(result.discovered.has('inactive-opening'), false)
  })

  it('permite producir resultados del pool sin asignarlos a una fase', () => {
    const graph = input([
      element('starter', { isStarter: true, availableFromPhaseOrder: 1 }),
      element('global-output', { availableFromPhaseOrder: null }),
    ])
    graph.phases = [{ sortOrder: 1, unlockAtDiscoveryCount: 0, isActive: true }]
    graph.recipes.push({
      ings: [['starter', 2]],
      outputs: ['global-output'],
      isActive: true,
    })

    assert.equal(simulateProgression(graph).discovered.has('global-output'), true)
  })

  it('ignora starters, ingredientes, salidas y caminos inactivos', () => {
    const graph = input([
      element('activo', { isStarter: true }),
      element('starter-inactivo', { isStarter: true, isActive: false }),
      element('salida-inactiva', { isActive: false }),
      element('secuencia-inactiva'),
    ])
    graph.recipes.push({
      ings: [['activo', 2]],
      outputs: ['salida-inactiva', 'secuencia-inactiva'],
      isActive: true,
    })
    graph.sequences.push({
      slug: 'secuencia-inactiva',
      number: 9,
      pathwaySlug: 'camino-inactivo',
      pathwayIsActive: false,
    })
    const result = simulateProgression(graph)
    assert.deepEqual([...result.discovered], ['activo'])
  })

  it('aplica juntos tipo, secuencia, cantidad y requisitos AND, con triggers como alternativa OR', () => {
    const graph = input([
      element('a', { isStarter: true, type: 'MUNDANO' }),
      element('b', { isStarter: true }),
      element('seq', { isStarter: true }),
      element('and-target', {
        unlockedByType: 'MUNDANO',
        unlockedBySequenceNumber: 9,
        unlockedAtDiscoveryCount: 3,
      }),
      element('trigger-target', { unlockedAtDiscoveryCount: 99 }),
    ])
    graph.sequences.push({
      slug: 'seq',
      number: 9,
      pathwaySlug: 'camino',
      pathwayIsActive: true,
    })
    graph.andRequirements['and-target'] = ['b']
    graph.triggers['trigger-target'] = ['a']
    const result = simulateProgression(graph)
    assert.equal(result.discovered.has('and-target'), true)
    assert.equal(result.discovered.has('trigger-target'), true)
  })

  it('permite un doble resultado intencional de receta y avance', () => {
    const graph = input([
      element('a', { isStarter: true }),
      element('b', { isStarter: true }),
      element('source', { isStarter: true }),
      element('recipe-output'),
      element('target'),
    ])
    graph.recipes.push({
      ings: [['a', 1], ['b', 1]],
      outputs: ['recipe-output'],
      isActive: true,
    })
    graph.advances.push({
      internalName: 'dual',
      ingredients: [['a', 1], ['b', 1]],
      source: 'source',
      target: 'target',
      isActive: true,
    })
    graph.sequences.push(
      { slug: 'source', number: 9, pathwaySlug: 'camino', pathwayIsActive: true },
      { slug: 'target', number: 8, pathwaySlug: 'camino', pathwayIsActive: true },
    )
    const result = simulateProgression(graph)
    assert.equal(result.discovered.has('recipe-output'), true)
    assert.equal(result.discovered.has('target'), true)
    assert.equal(result.preparedAdvances.has('dual'), true)
    assert.equal(result.appliedAdvances.has('dual'), true)
  })

  it('modela el ritual faltante como bloqueo orgánico, no como fallo automático', () => {
    const graph = input([
      element('a', { isStarter: true }),
      element('b', { isStarter: true }),
      element('ritual', { isStarter: true }),
      element('source', { isStarter: true }),
      element('target'),
      element('missing'),
      element('failure'),
      element('after-failure'),
    ])
    graph.advances.push({
      internalName: 'ritualized',
      ingredients: [['a', 1], ['b', 1]],
      source: 'source',
      target: 'target',
      isActive: true,
    })
    graph.sequences.push(
      { slug: 'source', number: 9, pathwaySlug: 'camino', pathwayIsActive: true },
      { slug: 'target', number: 8, pathwaySlug: 'camino', pathwayIsActive: true },
    )
    graph.rituals.push({
      name: 'ritual de prueba',
      advanceName: 'ritualized',
      ingredients: ['a', 'missing'],
      requiredSequenceNumber: 9,
      isActive: true,
      failureOutputs: ['failure'],
    })
    graph.triggers['after-failure'] = ['failure']
    const result = simulateProgression(graph)
    assert.equal(result.discovered.has('target'), false)
    assert.equal(result.discovered.has('failure'), false)
    assert.equal(result.discovered.has('after-failure'), false)
    assert.equal(result.failedAdvances.has('ritualized'), false)

    const unsafe = simulateProgression(graph, { includeUnsafeRitualFailures: true })
    assert.equal(unsafe.discovered.has('target'), false)
    assert.equal(unsafe.discovered.has('failure'), true)
    assert.equal(unsafe.discovered.has('after-failure'), true)
    assert.equal(unsafe.failedAdvances.has('ritualized'), true)
  })

  it('aplica un avance ritualizado solo después de registrar su preparación', () => {
    const graph = input([
      element('a', { isStarter: true }),
      element('b', { isStarter: true }),
      element('ritual', { isStarter: true }),
      element('source', { isStarter: true }),
      element('target'),
    ])
    graph.advances.push({
      internalName: 'ritualized',
      ingredients: [['a', 1], ['b', 1]],
      source: 'source',
      target: 'target',
      isActive: true,
    })
    graph.sequences.push(
      { slug: 'source', number: 9, pathwaySlug: 'camino', pathwayIsActive: true },
      { slug: 'target', number: 8, pathwaySlug: 'camino', pathwayIsActive: true },
    )
    graph.rituals.push({
      name: 'ritual de prueba',
      advanceName: 'ritualized',
      ingredients: ['a'],
      requiredSequenceNumber: 9,
      isActive: true,
      failureOutputs: [],
    })

    const result = simulateProgression(graph)
    assert.equal(result.preparedRituals.has('ritual de prueba'), true)
    assert.equal(result.appliedAdvances.has('ritualized'), true)
    assert.equal(result.discovered.has('target'), true)
  })

  it('mantiene cerrados los rituales y sus avances antes de la fase configurada', () => {
    const graph = input([
      element('a', { isStarter: true }),
      element('ritual', { isStarter: true }),
      element('source', { isStarter: true }),
      element('target'),
    ])
    graph.phases = [{ sortOrder: 1, unlockAtDiscoveryCount: 0, isActive: true }]
    graph.featureGates = { ADVANCEMENT_RITUALS: 6 }
    graph.advances.push({
      internalName: 'ritualized',
      ingredients: [['a', 2]],
      source: 'source',
      target: 'target',
      isActive: true,
    })
    graph.sequences.push(
      { slug: 'source', number: 9, pathwaySlug: 'camino', pathwayIsActive: true },
      { slug: 'target', number: 8, pathwaySlug: 'camino', pathwayIsActive: true },
    )
    graph.rituals.push({
      name: 'ritual de prueba',
      advanceName: 'ritualized',
      ingredients: ['a'],
      requiredSequenceNumber: 9,
      isActive: true,
      failureOutputs: [],
    })

    const result = simulateProgression(graph)
    assert.equal(result.preparedAdvances.has('ritualized'), true)
    assert.equal(result.availableRituals.size, 0)
    assert.equal(result.preparedRituals.size, 0)
    assert.equal(result.appliedAdvances.has('ritualized'), false)
    assert.equal(result.discovered.has('target'), false)
  })
})
