import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getAdvanceDefinitions } from './advances'
import { getElementDefinitions } from './elements'
import { PHASE_2_AVAILABLE_SLUGS, PROGRESSION_PHASES } from './phases'
import {
  buildDefaultAndRequirements,
  buildDefaultTriggers,
  DISCOVERY_COUNT_TRANSITION_TARGET_SLUGS,
  PHASE1_CLOSURE_SLUGS,
  STARTER_SLUGS,
  TIME_SLUG,
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
  vidente: { id: 'camino-del-vidente' },
  sol: { id: 'camino-del-sol' },
  puerta: { id: 'camino-de-la-puerta' },
  arbitro: { id: 'camino-del-arbitro' },
  abogado: { id: 'camino-del-abogado' },
  sleepless: { id: 'camino-del-sleepless' },
  muerte: { id: 'camino-de-la-muerte' },
  savant: { id: 'camino-del-savant' },
  mysteryPryer: { id: 'camino-del-mystery-pryer' },
  error: { id: 'camino-del-error' },
  suplicante: { id: 'camino-del-suplicante-de-secretos' },
  monstruo: { id: 'camino-del-monstruo' },
  visionario: { id: 'camino-del-visionario' },
  tirano: { id: 'camino-del-tirano' },
}
const sequences = getSequenceDefinitions(pathways)
const recipes = getRecipeDefinitions()
const advances = getAdvanceDefinitions()
const rituals = getRitualDefinitions()

function buildSimInput(): SimInput {
  const phaseOrderByElement = new Map<string, number>()
  for (const phase of PROGRESSION_PHASES) {
    for (const slug of phase.openingElementSlugs) {
      if (!phaseOrderByElement.has(slug)) phaseOrderByElement.set(slug, phase.sortOrder)
    }
  }
  return {
    elements: elements.map((e) => ({
      slug: e.slug,
      type: e.type,
      isStarter: e.isStarter ?? false,
      isActive: e.isActive ?? true,
      unlockedByType: e.unlockedByType ?? null,
      unlockedBySequenceNumber: e.unlockedBySequenceNumber ?? null,
      unlockedAtDiscoveryCount: e.unlockedAtDiscoveryCount ?? null,
      availableFromPhaseOrder: phaseOrderByElement.get(e.slug) ?? null,
      availableFromPhaseIsActive: PROGRESSION_PHASES.find((phase) =>
        phase.openingElementSlugs.includes(e.slug as never),
      )?.isActive,
    })),
    recipes: recipes.map((r) => ({
      ings: r.ings,
      outputs: r.outputs,
      isActive: r.isActive,
    })),
    advances: advances.map((a) => ({
      internalName: a.internalName,
      ingredients: a.ingredients.map((slug) => [slug, 1] as [string, number]),
      source: a.source,
      target: a.target,
      isActive: a.isActive ?? true,
    })),
    sequences: sequences.map((s) => ({
      slug: s.slug,
      number: s.number,
      pathwaySlug: s.camino.id,
      pathwayIsActive: true,
    })),
    rituals: rituals.map((r) => ({
      name: r.name,
      advanceName: r.advanceName,
      ingredients: r.ingredients,
      requiredSequenceNumber: r.requiredSequenceNumber,
      isActive: r.isActive ?? true,
      failureOutputs: ['perdida-de-control', 'monstruo-descontrol', 'corrupcion-de-alborotador'],
    })),
    triggers: buildDefaultTriggers(),
    andRequirements: buildDefaultAndRequirements(),
    phases: PROGRESSION_PHASES.map((phase) => ({
      sortOrder: phase.sortOrder,
      unlockAtDiscoveryCount: phase.unlockAtDiscoveryCount,
      isActive: phase.isActive,
    })),
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

function missingSlugs(set: Set<string>, slugs: readonly string[]): string[] {
  return slugs.filter((slug) => !set.has(slug))
}

describe('simulador de progresión — elementos iniciales', () => {
  it('los únicos iniciales son exactamente Ojo, Moneda, Tierra y Humano', () => {
    assert.deepEqual([...STARTER_SLUGS].sort(), ['humano', 'moneda', 'ojo', 'tierra'])
    const starters = elements.filter((e) => e.isStarter).map((e) => e.slug)
    assert.deepEqual(starters.sort(), [...STARTER_SLUGS].sort())
  })

  it('Registro y Tiempo no son iniciales', () => {
    const registro = elements.find((e) => e.slug === 'registro')
    const tiempo = elements.find((e) => e.slug === TIME_SLUG)
    assert.equal(registro?.isStarter ?? false, false)
    assert.equal(tiempo?.isStarter ?? false, false)
    assert.equal(tiempo?.isActive, false)
  })
})

describe('simulador de progresión — disponibilidad autoritativa por fases', () => {
  it('la Fase 1 cierra exactamente en el pool orgánico anterior a Fase 2', () => {
    const input = buildSimInput()
    input.phases = input.phases?.map((phase) =>
      phase.sortOrder === 1
        ? phase
        : { ...phase, unlockAtDiscoveryCount: Number.MAX_SAFE_INTEGER },
    )
    const result = simulateProgression(input)
    const expected = new Set<string>(PHASE1_CLOSURE_SLUGS)
    assert.deepEqual(missingSlugs(result.discovered, PHASE1_CLOSURE_SLUGS), [])
    assert.deepEqual([...result.discovered].filter((slug) => !expected.has(slug)), [])
    assert.equal(result.discovered.size, PHASE1_CLOSURE_SLUGS.length)
  })

  it('la Fase 2 contiene 56 elementos y deja Edad como frontera bloqueada', () => {
    const result = simulateProgression(buildSimInput())
    assert.deepEqual([...result.discovered].sort(), [...PHASE_2_AVAILABLE_SLUGS].sort())
    assert.equal(result.discovered.size, 56)
    assert.equal(result.discovered.has('edad'), false)
    assert.equal(result.discovered.has('fuerza'), true)
  })

  it('las aperturas de fase no duplican su umbral en cada elemento', () => {
    const conUmbral = elements.filter((e) => (e.unlockedAtDiscoveryCount ?? null) !== null)
    assert.deepEqual(conUmbral.map((e) => e.slug), [])
  })

  it('la apertura automática de Fase 2 lleva al cierre actual', () => {
    const result = simulateProgression(buildSimInput())
    for (const slug of DISCOVERY_COUNT_TRANSITION_TARGET_SLUGS) {
      assert.ok(result.discovered.has(slug), `${slug} debería concederse al abrir Fase 2`)
    }
    assert.deepEqual([...result.discovered].sort(), [...PHASE_2_AVAILABLE_SLUGS].sort())
    assert.equal(result.discovered.size, 56)
  })

  it('las secuencias alcanzadas coinciden exactamente con las esperadas', () => {
    const result = simulateProgression(buildSimInput())
    assert.deepEqual([...result.discoveredSequenceSlugs].sort(), [
      'monster',
      'robot',
      'seer',
    ])
    assert.equal(result.discoveredPathwaySlugs.size, 2)
  })
})

describe('simulador de progresión — Tiempo permanece prohibido', () => {
  it('Tiempo está inactivo y no tiene fuente de desbloqueo configurada', () => {
    const tiempo = elements.find((e) => e.slug === TIME_SLUG)
    assert.ok(tiempo)
    assert.equal(tiempo.isActive, false)
    assert.equal(tiempo.isStarter ?? false, false)
    assert.equal(tiempo.unlockedByType ?? null, null)
    assert.equal(tiempo.unlockedBySequenceNumber ?? null, null)
    assert.equal(tiempo.unlockedAtDiscoveryCount ?? null, null)
    assert.equal(buildDefaultTriggers()[TIME_SLUG] ?? undefined, undefined)
    assert.equal(buildDefaultAndRequirements()[TIME_SLUG] ?? undefined, undefined)
  })

  it('Tiempo no es alcanzable con Monster forzado como descubierto', () => {
    const input = buildSimInput()
    input.elements = input.elements.map((e) =>
      e.slug === 'monster' ? { ...e, isStarter: true } : e,
    )
    const result = simulateProgression(input)
    assert.equal(result.discovered.has(TIME_SLUG), false)
  })

  it('Tiempo no es alcanzable con una Secuencia 6 forzada como descubierta', () => {
    const input = buildSimInput()
    const seq6 = sequences.find((s) => s.number === 6)
    assert.ok(seq6, 'debe existir alguna secuencia número 6 en el catálogo')
    input.elements = input.elements.map((e) =>
      e.slug === seq6!.slug ? { ...e, isStarter: true } : e,
    )
    const result = simulateProgression(input)
    assert.equal(result.discovered.has(TIME_SLUG), false)
  })

  it('Tiempo no es alcanzable con Monster Y una Secuencia 6 forzados simultáneamente', () => {
    const input = buildSimInput()
    const seq6 = sequences.find((s) => s.number === 6)
    assert.ok(seq6)
    input.elements = input.elements.map((e) =>
      e.slug === 'monster' || e.slug === seq6!.slug ? { ...e, isStarter: true } : e,
    )
    const result = simulateProgression(input)
    assert.equal(result.discovered.has(TIME_SLUG), false)
  })

  it('Tiempo no es alcanzable al completar todo el cierre', () => {
    const result = simulateProgression(buildSimInput())
    assert.equal(result.discovered.has(TIME_SLUG), false)
    assert.equal(result.discovered.size, PHASE_2_AVAILABLE_SLUGS.length)
  })

  it('Tiempo permanece fuera de cada cierre', () => {
    for (const maxOrder of [1, 2]) {
      const input = buildSimInput()
      input.phases = input.phases?.map((phase) =>
        phase.sortOrder <= maxOrder
          ? phase
          : { ...phase, unlockAtDiscoveryCount: Number.MAX_SAFE_INTEGER },
      )
      const result = simulateProgression(input)
      assert.equal(result.discovered.has(TIME_SLUG), false, `Tiempo apareció en fase ${maxOrder}`)
    }
  })

  it('ninguna receta activa produce Tiempo', () => {
    const productores = recipes.filter(
      (r) => (r.isActive ?? true) && r.outputs.includes(TIME_SLUG),
    )
    assert.deepEqual(productores, [])
  })

  it('activar y asignar Tiempo artificialmente demuestra que el cierre normal lo bloquea', () => {
    const current = simulateProgression(buildSimInput())
    const controlInput = buildSimInput()
    controlInput.elements = controlInput.elements.map((element) =>
      element.slug === TIME_SLUG
        ? { ...element, isActive: true, isStarter: true, availableFromPhaseOrder: 1 }
        : element,
    )
    const withTime = simulateProgression(controlInput)
    assert.equal(current.discovered.size, PHASE_2_AVAILABLE_SLUGS.length)
    assert.equal(current.discovered.has(TIME_SLUG), false)
    assert.equal(withTime.discovered.has(TIME_SLUG), true)
    assert.ok(withTime.discovered.size > current.discovered.size)
  })
})

describe('simulador de progresión — contención de Fase 4', () => {
  it('mantiene fuera todas las ramas reservadas', () => {
    const result = simulateProgression(buildSimInput())
    for (const slug of [
      'informacion',
      'procedimiento',
      'influencia',
      'reserva',
      'ocultamiento',
      'secreto',
      'lenguaje',
      'investigacion',
      'ley',
      'orden',
      'autoridad',
      'religion',
      'resurreccion',
      'cambio-cualitativo',
      'demigod',
      'divinidad',
      'saint',
      'angel',
    ]) {
      assert.equal(result.discovered.has(slug), false, `${slug} debe quedar reservado`)
    }
    assert.equal(result.discovered.has(TIME_SLUG), false)
  })

  it('Conocimiento conserva solo sus ramas de Fase 3', () => {
    const consumers = recipes.filter(
      (r) => (r.isActive ?? true) && r.ings.some(([slug]) => slug === 'conocimiento'),
    )
    assert.deepEqual(
      consumers.map((recipe) => recipe.outputs.join('+')).sort(),
      ['claridad', 'magia', 'prudencia'],
    )
    const informacion = recipes.find(
      (r) => r.ings.some(([slug]) => slug === 'conocimiento') && r.outputs.includes('informacion'),
    )
    assert.equal(informacion?.isActive, false)
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

  it('Humano × 2 produce conjuntamente Familia y Vínculo (no únicamente Vínculo)', () => {
    const r = recipes.find((x) => x.ings.length === 1 && x.ings[0][0] === 'humano' && x.ings[0][1] === 2)
    assert.deepEqual([...(r?.outputs ?? [])].sort(), ['familia', 'vinculo'])
  })

  it('Humano + Moneda produce conjuntamente Apuesta y Trabajo', () => {
    const r = recipes.find(
      (x) =>
        new Set(x.ings.map(([slug]) => slug)).size === 2 &&
        x.ings.some(([slug]) => slug === 'humano') &&
        x.ings.some(([slug]) => slug === 'moneda'),
    )
    assert.deepEqual([...(r?.outputs ?? [])].sort(), ['apuesta', 'trabajo'])
  })

  it('Apuesta + Moneda produce Destino, y Adivinación + Tiempo se conserva para una fase futura', () => {
    const nueva = recipes.find(
      (x) =>
        x.ings.some(([slug]) => slug === 'apuesta') &&
        x.ings.some(([slug]) => slug === 'moneda'),
    )
    assert.deepEqual(nueva?.outputs, ['destino'])
    const legacy = recipes.find(
      (x) =>
        x.ings.some(([slug]) => slug === 'adivinacion') &&
        x.ings.some(([slug]) => slug === TIME_SLUG) &&
        x.outputs.includes('destino'),
    )
    assert.ok(legacy, 'la ruta adivinacion+tiempo->destino debe conservarse')
  })

  it('Adivinación + Destino produce Revelación, y Adivinación + Dato se conserva como ruta alternativa', () => {
    const nueva = recipes.find(
      (x) =>
        x.ings.some(([slug]) => slug === 'adivinacion') &&
        x.ings.some(([slug]) => slug === 'destino'),
    )
    assert.deepEqual(nueva?.outputs, ['revelacion'])
    const legacy = recipes.find(
      (x) =>
        x.ings.some(([slug]) => slug === 'adivinacion') &&
        x.ings.some(([slug]) => slug === 'dato'),
    )
    assert.deepEqual(legacy?.outputs, ['revelacion'])
  })

  it('Espacio permanece inalcanzable sin receta, apertura ni condición', () => {
    assert.equal(buildDefaultTriggers().espacio, undefined)
    assert.equal(buildDefaultAndRequirements().espacio ?? undefined, undefined)
    assert.equal(recipes.some((recipe) => recipe.outputs.includes('espacio')), false)
    assert.equal(
      PROGRESSION_PHASES.some((phase) => phase.openingElementSlugs.includes('espacio' as never)),
      false,
    )
    assert.equal(simulateProgression(buildSimInput()).discovered.has('espacio'), false)
  })

  it('Humano + Misticismo produce conjuntamente Cuerpo Espiritual y Espiritualidad', () => {
    const r = recipes.find(
      (x) =>
        x.ings.some(([slug]) => slug === 'humano') &&
        x.ings.some(([slug]) => slug === 'misticismo'),
    )
    assert.deepEqual([...(r?.outputs ?? [])].sort(), ['cuerpo-espiritual', 'espiritualidad'])
  })

  it('Esfuerzo + Humano produce únicamente Desgaste (no Fuerza)', () => {
    const r = recipes.find(
      (x) =>
        x.ings.some(([slug]) => slug === 'esfuerzo') &&
        x.ings.some(([slug]) => slug === 'humano'),
    )
    assert.deepEqual(r?.outputs, ['desgaste'])
  })

  it('la clave obsoleta mundo+registro ya no produce Historia; Historia usa registro+era', () => {
    const legacy = recipes.find(
      (x) =>
        new Set(x.ings.map(([slug]) => slug)).size === 2 &&
        x.ings.some(([slug]) => slug === 'mundo') &&
        x.ings.some(([slug]) => slug === 'registro'),
    )
    assert.equal(legacy, undefined, 'mundo+registro ya no debe existir como receta')
    const nueva = recipes.find(
      (x) =>
        x.ings.some(([slug]) => slug === 'registro') &&
        x.ings.some(([slug]) => slug === 'era'),
    )
    assert.deepEqual(nueva?.outputs, ['historia'])
  })

  it('existe Apuesta en el catálogo con sus datos conceptuales esperados', () => {
    const apuesta = elements.find((e) => e.slug === 'apuesta')
    assert.ok(apuesta)
    assert.equal(apuesta?.name, 'Apuesta')
    assert.equal(apuesta?.type, 'CONCEPTO')
  })
})

describe('catálogo de Fase 3 — fórmulas y contención', () => {
  const recipe = (first: string, second: string) =>
    recipes.find(
      (item) =>
        item.ings.some(([slug]) => slug === first) &&
        item.ings.some(([slug]) => slug === second),
    )

  it('declara exactamente las fórmulas principales de los cinco bloques', () => {
    assert.deepEqual(recipe('humano', 'continuidad')?.outputs, ['edad'])
    assert.deepEqual(recipe('esfuerzo', 'desgaste')?.outputs, ['fuerza'])
    assert.deepEqual(recipe('humano', 'edad')?.outputs, ['experiencia-2'])
    assert.deepEqual(recipe('experiencia-2', 'registro')?.outputs, ['memoria'])
    assert.deepEqual(recipe('edad', 'desgaste')?.outputs, ['muerte'])
    assert.deepEqual(recipe('experiencia-2', 'dato')?.outputs, ['conocimiento'])
    assert.deepEqual(recipe('experiencia-2', 'conocimiento')?.outputs, ['prudencia'])
    assert.deepEqual(recipe('conocimiento', 'percepcion')?.outputs, ['claridad'])
  })

  it('Experiencia no produce Muerte y la antigua clave Humano + Vejez ya no existe', () => {
    assert.equal(recipe('humano', 'edad')?.outputs.includes('muerte'), false)
    assert.equal(recipe('humano', 'vejez'), undefined)
  })

  it('reserva las raíces de Fase 4 sin bloquear secuencias con ingredientes válidos', () => {
    const inactiveRecipeKeys = recipes
      .filter((item) => item.isActive === false)
      .map((item) => item.ings.map(([slug]) => slug).sort().join('+'))
      .sort()
    assert.deepEqual(inactiveRecipeKeys, [
      'avance+fuerza',
      'conocimiento+dato',
      'muerte+retorno',
    ])
    assert.equal(recipe('avance', 'fuerza')?.isActive, false)
    assert.equal(recipe('muerte', 'retorno')?.isActive, false)
    assert.equal(recipe('conocimiento', 'dato')?.isActive, false)
    assert.notEqual(advances.find((advance) => advance.target === 'mago')?.isActive, false)
    assert.notEqual(advances.find((advance) => advance.target === 'seafarer')?.isActive, false)
  })
})

describe('simulador de progresión — auditorías requeridas', () => {
  it('C. cierre estable bajo 100 órdenes aleatorios de acciones', () => {
    const baseline = simulateProgression(buildSimInput())
    for (let seed = 1; seed <= 100; seed++) {
      const result = simulateProgression(buildSimInput(), { rng: mulberry32(seed) })
      assert.deepEqual([...result.discovered].sort(), [...baseline.discovered].sort(), `semilla ${seed}: elementos`)
      assert.deepEqual([...result.discoveredPathwaySlugs].sort(), [...baseline.discoveredPathwaySlugs].sort(), `semilla ${seed}: caminos`)
      assert.deepEqual([...result.discoveredSequenceSlugs].sort(), [...baseline.discoveredSequenceSlugs].sort(), `semilla ${seed}: secuencias`)
      assert.deepEqual([...result.preparedAdvances].sort(), [...baseline.preparedAdvances].sort(), `semilla ${seed}: avances`)
      assert.deepEqual([...result.appliedAdvances].sort(), [...baseline.appliedAdvances].sort(), `semilla ${seed}: avances aplicados`)
      assert.deepEqual([...result.availableRituals].sort(), [...baseline.availableRituals].sort(), `semilla ${seed}: rituales disponibles`)
      assert.deepEqual([...result.preparedRituals].sort(), [...baseline.preparedRituals].sort(), `semilla ${seed}: rituales`)
      assert.deepEqual([...result.failedAdvances].sort(), [...baseline.failedAdvances].sort(), `semilla ${seed}: fallos rituales`)
      assert.equal(result.discovered.has(TIME_SLUG), false, `semilla ${seed}: Tiempo prohibido`)
    }
  })

  it('D. el cierre alcanzable es el mismo con ambas interpretaciones de preparación de avances', () => {
    const antes = simulateProgression(buildSimInput(), {
      advancePreparationRequiresSourceSequence: false,
    })
    const despues = simulateProgression(buildSimInput(), {
      advancePreparationRequiresSourceSequence: true,
    })
    assert.equal(antes.discovered.size, PHASE_2_AVAILABLE_SLUGS.length)
    assert.equal(despues.discovered.size, PHASE_2_AVAILABLE_SLUGS.length)
  })

  it('E. ningún ritual ni avance ritualizado se filtra al cierre de Fase 3', () => {
    const conRituales = simulateProgression(buildSimInput(), { ritualEvaluationEnabled: true })
    const sinRituales = simulateProgression(buildSimInput(), { ritualEvaluationEnabled: false })
    assert.deepEqual([...conRituales.discovered].sort(), [...sinRituales.discovered].sort())
    assert.deepEqual([...conRituales.preparedRituals], [])
    assert.deepEqual([...conRituales.availableRituals], [])
  })
})
