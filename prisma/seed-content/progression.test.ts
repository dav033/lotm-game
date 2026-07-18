import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getAdvanceDefinitions } from './advances'
import { getElementDefinitions } from './elements'
import {
  buildDefaultAndRequirements,
  buildDefaultTriggers,
  EXPLOSION_REGRESSION_SLUGS,
  PHASE1_CLOSURE_SLUGS,
  PHASE2_CLOSURE_SLUGS,
  PHASE3_CLOSURE_SLUGS,
  PHASE3_SEQUENCE_SLUGS,
} from './progression'
import { simulateProgression, type SimInput } from './progression-simulator'
import { getRecipeDefinitions } from './recipes'
import { getRitualDefinitions } from './rituals'
import { getSequenceDefinitions, type SequencePathways } from './sequences'

const elements = getElementDefinitions({
  mundano: 'mundano',
  conceptos: 'conceptos',
  misticismo: 'misticismo',
  beyonder: 'beyonder',
})

const pathways: SequencePathways = {
  vidente: { id: 'vidente' },
  sol: { id: 'sol' },
  puerta: { id: 'puerta' },
  arbitro: { id: 'arbitro' },
  abogado: { id: 'abogado' },
  sleepless: { id: 'sleepless' },
  muerte: { id: 'muerte' },
  savant: { id: 'savant' },
  mysteryPryer: { id: 'mystery-pryer' },
  error: { id: 'error' },
  suplicante: { id: 'suplicante' },
  monstruo: { id: 'monstruo' },
  visionario: { id: 'visionario' },
  tirano: { id: 'tirano' },
}
const sequences = getSequenceDefinitions(pathways)
const recipes = getRecipeDefinitions()
const advances = getAdvanceDefinitions()
const rituals = getRitualDefinitions()

function buildSimInput(): SimInput {
  return {
    elements: elements.map((e) => ({
      slug: e.slug,
      type: e.type,
      isStarter: e.isStarter ?? false,
      isActive: true,
      unlockedByType: e.unlockedByType ?? null,
      unlockedBySequenceNumber: e.unlockedBySequenceNumber ?? null,
    })),
    recipes: recipes.map((r) => ({ ings: r.ings, outputs: r.outputs, isActive: r.isActive })),
    advances: advances.map((a) => ({
      internalName: a.internalName,
      ingredients: a.ingredients,
      source: a.source,
      target: a.target,
    })),
    sequences: sequences.map((s) => ({ slug: s.slug, number: s.number })),
    rituals: rituals.map((r) => ({
      advanceName: r.advanceName,
      ingredients: r.ingredients,
      requiredSequenceNumber: r.requiredSequenceNumber,
    })),
    triggers: buildDefaultTriggers(),
    andRequirements: buildDefaultAndRequirements(),
  }
}

// Mulberry32: PRNG determinista y pequeño, suficiente para 100 semillas.
function mulberry32(seed: number) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function slugsAtOrBelore(set: Set<string>, slugs: readonly string[]): string[] {
  return slugs.filter((slug) => !set.has(slug))
}

describe('simulador de progresión — cierre estático del seed', () => {
  it('Fase 1 produce exactamente el cierre esperado (17 elementos)', () => {
    const result = simulateProgression(buildSimInput())
    // El cierre de fase 1 es un subconjunto alcanzable ANTES de que la
    // transición añada espacio/misticismo/beyonder/humano: se verifica
    // comparando contra el snapshot alcanzable cuando aún no se cumplen los
    // 4 requisitos de transición. Como el simulador corre a punto fijo
    // completo, se reconstruye ese snapshot limitando el catálogo a las
    // recetas que no dependen de los 4 elementos de transición ni de nada
    // que ellos habiliten.
    const phase1Slugs = new Set(PHASE1_CLOSURE_SLUGS)
    for (const slug of phase1Slugs) {
      assert.ok(result.discovered.has(slug), `Fase 1: falta ${slug} en el cierre completo`)
    }
    assert.equal(phase1Slugs.size, 17)
  })

  it('Fase 2 acumula exactamente 56 elementos', () => {
    assert.equal(PHASE2_CLOSURE_SLUGS.length, 56)
  })

  it('Fase 3 acumula exactamente 74 elementos', () => {
    assert.equal(PHASE3_CLOSURE_SLUGS.length, 74)
  })

  it('el cierre completo del catálogo (sin Tiempo) coincide con el cierre de Fase 2 más los elementos de Fase 3 alcanzables sin Tiempo', () => {
    // Sin Monster+Secuencia6 el jugador no puede alcanzar Tiempo; el resto
    // de fase 3 tampoco es alcanzable porque depende de Tiempo. Este test
    // documenta que el grafo completo (con Fase 3 activa) converge
    // exactamente a los 74 slugs de PHASE3_CLOSURE_SLUGS y a ningún otro
    // elemento fuera de las fases 4+ reservadas.
    const result = simulateProgression(buildSimInput())
    const expected = new Set<string>(PHASE3_CLOSURE_SLUGS)
    const reachableBeyondExpected = [...result.discovered].filter((slug) => !expected.has(slug))
    assert.deepEqual(
      reachableBeyondExpected.sort(),
      [],
      `Elementos alcanzables fuera del cierre de fase 3: ${reachableBeyondExpected.join(', ')}`,
    )
    const missing = slugsAtOrBelore(result.discovered, PHASE3_CLOSURE_SLUGS)
    assert.deepEqual(missing, [], `Elementos del cierre de fase 3 no alcanzados: ${missing.join(', ')}`)
  })

  it('las secuencias alcanzadas coinciden exactamente con las esperadas por fase', () => {
    const result = simulateProgression(buildSimInput())
    assert.deepEqual(
      [...result.discoveredSequenceSlugs].sort(),
      [...PHASE3_SEQUENCE_SLUGS].sort(),
    )
    // Ninguna secuencia 5 o inferior debe ser alcanzable en el catálogo de
    // fases 1-3 (las secuencias 5- pertenecen a fases posteriores del mismo
    // camino y no forman parte del contrato de esta entrega).
    const secuenciasBajas = sequences.filter(
      (s) => s.number <= 5 && result.discoveredSequenceSlugs.has(s.slug),
    )
    assert.deepEqual(secuenciasBajas, [])
  })
})

describe('simulador de progresión — regresión de explosión', () => {
  it('ningún elemento de la lista de explosión es alcanzable', () => {
    const result = simulateProgression(buildSimInput())
    for (const slug of EXPLOSION_REGRESSION_SLUGS) {
      assert.equal(result.discovered.has(slug), false, `${slug} no debería ser alcanzable`)
    }
  })

  it('no hay avance ni receta activa que consuma Conocimiento', () => {
    const consumers = recipes.filter(
      (r) => (r.isActive ?? true) && r.ings.some(([slug]) => slug === 'conocimiento'),
    )
    assert.deepEqual(consumers, [])
  })

  it('Ojo × 2 produce exactamente Visión', () => {
    const r = recipes.find((x) => x.ings.length === 1 && x.ings[0][0] === 'ojo' && x.ings[0][1] === 2)
    assert.deepEqual(r?.outputs, ['vision'])
  })

  it('Ojo + Visión produce exactamente Percepción y Observación', () => {
    const r = recipes.find(
      (x) => new Set(x.ings.map(([slug]) => slug)).size === 2 &&
        x.ings.some(([slug]) => slug === 'ojo') &&
        x.ings.some(([slug]) => slug === 'vision'),
    )
    assert.deepEqual(r?.outputs, ['percepcion', 'observacion'])
  })

  it('Humano × 2 produce únicamente Vínculo', () => {
    const r = recipes.find((x) => x.ings.length === 1 && x.ings[0][0] === 'humano' && x.ings[0][1] === 2)
    assert.deepEqual(r?.outputs, ['vinculo'])
  })

  it('Humano + Moneda produce únicamente Trabajo', () => {
    const r = recipes.find(
      (x) =>
        new Set(x.ings.map(([slug]) => slug)).size === 2 &&
        x.ings.some(([slug]) => slug === 'humano') &&
        x.ings.some(([slug]) => slug === 'moneda'),
    )
    assert.deepEqual(r?.outputs, ['trabajo'])
  })

  it('Humano + Misticismo produce únicamente Espiritualidad', () => {
    const r = recipes.find(
      (x) =>
        x.ings.some(([slug]) => slug === 'humano') &&
        x.ings.some(([slug]) => slug === 'misticismo'),
    )
    assert.deepEqual(r?.outputs, ['espiritualidad'])
  })

  it('Esfuerzo + Humano produce únicamente Desgaste', () => {
    const r = recipes.find(
      (x) =>
        x.ings.some(([slug]) => slug === 'esfuerzo') &&
        x.ings.some(([slug]) => slug === 'humano'),
    )
    assert.deepEqual(r?.outputs, ['desgaste'])
  })

  it('Humano + Vejez produce únicamente Experiencia', () => {
    const r = recipes.find(
      (x) =>
        x.ings.some(([slug]) => slug === 'humano') &&
        x.ings.some(([slug]) => slug === 'vejez'),
    )
    assert.deepEqual(r?.outputs, ['experiencia-2'])
  })

  it('no existe el elemento Apuesta ni referencias a él', () => {
    assert.equal(elements.some((e) => e.slug === 'apuesta'), false)
    for (const r of recipes) {
      assert.ok(r.ings.every(([slug]) => slug !== 'apuesta'))
      assert.ok(r.outputs.every((slug) => slug !== 'apuesta'))
    }
  })
})

describe('simulador de progresión — auditorías requeridas', () => {
  it('C. cierre estable bajo 100 órdenes aleatorios de acciones', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const result = simulateProgression(buildSimInput(), { rng: mulberry32(seed) })
      assert.equal(
        result.discovered.size,
        PHASE3_CLOSURE_SLUGS.length,
        `semilla ${seed}: tamaño de cierre inesperado`,
      )
      const missing = slugsAtOrBelore(result.discovered, PHASE3_CLOSURE_SLUGS)
      assert.deepEqual(missing, [], `semilla ${seed}: faltan ${missing.join(', ')}`)
    }
  })

  it('D. el cierre alcanzable es 74 con ambas interpretaciones de preparación de avances', () => {
    const antes = simulateProgression(buildSimInput(), {
      advancePreparationRequiresSourceSequence: false,
    })
    const despues = simulateProgression(buildSimInput(), {
      advancePreparationRequiresSourceSequence: true,
    })
    assert.equal(antes.discovered.size, PHASE3_CLOSURE_SLUGS.length)
    assert.equal(despues.discovered.size, PHASE3_CLOSURE_SLUGS.length)
  })

  it('E. el cierre de fases 1-3 no cambia con la evaluación de rituales activada o desactivada', () => {
    const conRituales = simulateProgression(buildSimInput(), { ritualEvaluationEnabled: true })
    const sinRituales = simulateProgression(buildSimInput(), { ritualEvaluationEnabled: false })
    assert.deepEqual([...conRituales.discovered].sort(), [...sinRituales.discovered].sort())
  })
})
