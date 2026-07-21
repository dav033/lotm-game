import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { INTENTIONAL_RECIPE_ADVANCE_DUAL_OUTCOMES } from '../../src/shared/formulaOverlapPolicy'
import { buildRecipeInputKey } from '../../src/server/domain/inputKey'
import { getAdvanceDefinitions } from './advances'
import { getElementDefinitions } from './elements'
import { getRecipeDefinitions } from './recipes'
import { getRitualDefinitions } from './rituals'
import { getSequenceDefinitions, type SequencePathways } from './sequences'

const elements = getElementDefinitions({
  mundano: 'mundano',
  conceptos: 'conceptos',
  misticismo: 'misticismo',
  beyonder: 'beyonder',
})
const elementSlugs = new Set(elements.map((element) => element.slug))

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
const sequenceSlugs = new Set(sequences.map((sequence) => sequence.slug))

function inputKey(ingredients: [string, number][]) {
  return ingredients
    .map(([slug, quantity]) => `${slug}:${quantity}`)
    .sort()
    .join('|')
}

describe('catálogos del seed', () => {
  it('mantiene únicos los slugs de elementos', () => {
    assert.equal(elementSlugs.size, elements.length)
  })

  it('mantiene únicos los nombres normalizados de elementos', () => {
    const normalize = (value: string) =>
      value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
    const names = elements.map((element) => normalize(element.name))
    assert.equal(new Set(names).size, names.length)
  })

  it('mantiene recetas sin entradas duplicadas y con referencias existentes', () => {
    const recipes = getRecipeDefinitions()
    const keys = recipes.map((recipe) => inputKey(recipe.ings))

    assert.equal(new Set(keys).size, recipes.length)
    for (const recipe of recipes) {
      for (const [slug] of recipe.ings) assert.ok(elementSlugs.has(slug), `Ingrediente inexistente: ${slug}`)
      for (const slug of recipe.outputs) assert.ok(elementSlugs.has(slug), `Salida inexistente: ${slug}`)
      assert.equal(
        new Set(recipe.outputs).size,
        recipe.outputs.length,
        `Salida duplicada en ${JSON.stringify(recipe.ings)}`,
      )
    }
  })

  it('elimina Susurro y obtiene Secreto mediante Información + Ocultamiento', () => {
    const recipes = getRecipeDefinitions()
    const secretRecipe = recipes.find(
      (recipe) => inputKey(recipe.ings) === inputKey([['informacion', 1], ['ocultamiento', 1]]),
    )

    assert.equal(elementSlugs.has('susurro'), false)
    assert.ok(secretRecipe?.outputs.includes('secreto'))
    assert.ok(
      recipes.every(
        (recipe) =>
          recipe.ings.every(([slug]) => slug !== 'susurro') &&
          recipe.outputs.every((slug) => slug !== 'susurro'),
      ),
    )
  })

  it('mantiene secuencias únicas con elementos y caminos existentes', () => {
    const pathwayIds = new Set(Object.values(pathways).map((pathway) => pathway.id))

    assert.equal(sequenceSlugs.size, sequences.length)
    for (const sequence of sequences) {
      assert.ok(elementSlugs.has(sequence.slug), `Elemento de secuencia inexistente: ${sequence.slug}`)
      assert.ok(pathwayIds.has(sequence.camino.id), `Camino de secuencia inexistente: ${sequence.camino.id}`)
    }
  })

  it('mantiene avances únicos y con referencias válidas', () => {
    const advances = getAdvanceDefinitions()
    const names = advances.map((advance) => advance.internalName)
    const targets = advances.map((advance) => advance.target)

    assert.equal(new Set(names).size, advances.length)
    assert.equal(new Set(targets).size, advances.length)
    for (const advance of advances) {
      assert.ok(sequenceSlugs.has(advance.source), `Secuencia de origen inexistente: ${advance.source}`)
      assert.ok(sequenceSlugs.has(advance.target), `Secuencia de destino inexistente: ${advance.target}`)
      for (const slug of advance.ingredients) {
        assert.ok(elementSlugs.has(slug), `Ingrediente de avance inexistente: ${slug}`)
      }
    }
  })

  it('mantiene rituales vinculados a avances y elementos existentes', () => {
    const advanceNames = new Set(getAdvanceDefinitions().map((advance) => advance.internalName))

    for (const ritual of getRitualDefinitions()) {
      assert.ok(advanceNames.has(ritual.advanceName), `Avance de ritual inexistente: ${ritual.advanceName}`)
      for (const slug of ritual.ingredients) {
        assert.ok(elementSlugs.has(slug), `Ingrediente de ritual inexistente: ${slug}`)
      }
    }
  })

  it('hace coincidir el número ritual con la secuencia origen del avance', () => {
    const advances = getAdvanceDefinitions()
    const sequenceNumberBySlug = new Map(sequences.map((sequence) => [sequence.slug, sequence.number]))

    for (const ritual of getRitualDefinitions()) {
      const advance = advances.find((item) => item.internalName === ritual.advanceName)
      assert.ok(advance, `Avance de ritual inexistente: ${ritual.advanceName}`)
      assert.equal(
        ritual.requiredSequenceNumber,
        sequenceNumberBySlug.get(advance.source),
        `Número de secuencia incoherente en ${ritual.name}`,
      )
    }
  })

  it('permite únicamente los tres dobles resultados explícitos de receta y avance', () => {
    const recipesByKey = new Map(
      getRecipeDefinitions().map((recipe) => [
        buildRecipeInputKey(recipe.ings.map(([slug, quantity]) => ({ slug, quantity }))),
        recipe,
      ]),
    )
    const overlaps = getAdvanceDefinitions().flatMap((advance) => {
      const inputKey = buildRecipeInputKey(
        advance.ingredients.map((slug) => ({ slug, quantity: 1 })),
      )
      const recipe = recipesByKey.get(inputKey)
      return recipe
        ? [{ inputKey, recipeOutputSlugs: [...recipe.outputs], advanceTargetSlug: advance.target }]
        : []
    })

    assert.deepEqual(
      overlaps.sort((a, b) => a.inputKey.localeCompare(b.inputKey)),
      [...INTENTIONAL_RECIPE_ADVANCE_DUAL_OUTCOMES]
        .map((entry) => ({ ...entry, recipeOutputSlugs: [...entry.recipeOutputSlugs] }))
        .sort((a, b) => a.inputKey.localeCompare(b.inputKey)),
    )
  })

  it('ningún ritual comparte clave con una receta o un avance', () => {
    const recipeKeys = new Set(
      getRecipeDefinitions().map((recipe) =>
        buildRecipeInputKey(recipe.ings.map(([slug, quantity]) => ({ slug, quantity }))),
      ),
    )
    const advanceKeys = new Set(
      getAdvanceDefinitions().map((advance) =>
        buildRecipeInputKey(advance.ingredients.map((slug) => ({ slug, quantity: 1 }))),
      ),
    )
    for (const ritual of getRitualDefinitions()) {
      const key = buildRecipeInputKey(
        ritual.ingredients.map((slug) => ({ slug, quantity: 1 })),
      )
      assert.equal(recipeKeys.has(key), false, `Ritual/receta en conflicto: ${key}`)
      assert.equal(advanceKeys.has(key), false, `Ritual/avance en conflicto: ${key}`)
    }
  })

  it('completa las secuencias 3 y 2 del Camino del Sleepless', () => {
    const recipes = getRecipeDefinitions()
    const advances = getAdvanceDefinitions()
    const rituals = getRitualDefinitions()

    assert.deepEqual(
      sequences
        .filter((sequence) => sequence.camino.id === pathways.sleepless.id && sequence.number <= 4)
        .map(({ number, slug }) => [number, slug]),
      [
        [4, 'nightwatcher'],
        [3, 'horror-bishop'],
        [2, 'servant-of-concealment'],
      ],
    )
    assert.deepEqual(
      recipes.find((recipe) => inputKey(recipe.ings) === inputKey([['pesadilla', 1], ['psique', 1]]))?.outputs,
      ['horror'],
    )
    assert.deepEqual(
      recipes.find((recipe) => inputKey(recipe.ings) === inputKey([['autocontrol', 1], ['peligro', 1]]))?.outputs,
      ['valor'],
    )
    assert.deepEqual(
      advances.find((advance) => advance.target === 'horror-bishop'),
      {
        internalName: 'Avance a Horror Bishop',
        ingredients: ['horror', 'dominio'],
        source: 'nightwatcher',
        target: 'horror-bishop',
      },
    )
    assert.deepEqual(
      advances.find((advance) => advance.target === 'servant-of-concealment'),
      {
        internalName: 'Avance a Servant of Concealment',
        ingredients: ['ocultamiento', 'secreto'],
        source: 'horror-bishop',
        target: 'servant-of-concealment',
      },
    )
    assert.deepEqual(
      rituals.find((ritual) => ritual.advanceName === 'Avance a Horror Bishop'),
      {
        name: 'Ritual de avance a Horror Bishop',
        advanceName: 'Avance a Horror Bishop',
        ingredients: ['muerte', 'valor'],
        requiredSequenceNumber: 4,
      },
    )
    assert.deepEqual(
      rituals.find((ritual) => ritual.advanceName === 'Avance a Servant of Concealment'),
      {
        name: 'Ritual de avance a Servant of Concealment',
        advanceName: 'Avance a Servant of Concealment',
        ingredients: ['tiempo', 'autocontrol'],
        requiredSequenceNumber: 3,
      },
    )
  })
})

describe('integridad del catálogo — rediseño de progresión temprana (fase 1 y apertura mística)', () => {
  const recipes = getRecipeDefinitions()
  const advances = getAdvanceDefinitions()

  it('existe el elemento Apuesta, restaurado en fase 1', () => {
    const apuesta = elements.find((e) => e.slug === 'apuesta')
    assert.ok(apuesta)
    assert.equal(apuesta?.name, 'Apuesta')
    assert.equal(apuesta?.type, 'CONCEPTO')
  })

  it('Humano + Moneda produce Apuesta (y Trabajo)', () => {
    const r = recipes.find(
      (recipe) =>
        recipe.ings.some(([slug]) => slug === 'humano') &&
        recipe.ings.some(([slug]) => slug === 'moneda'),
    )
    assert.ok(r?.outputs.includes('apuesta'))
  })

  it('no existe ningún elemento con el nombre con errata "Persepcion espiritual"', () => {
    assert.equal(elements.some((e) => e.name === 'Persepcion espiritual'), false)
  })

  it('ninguna receta referencia el slug con errata', () => {
    for (const r of recipes) {
      assert.ok(r.ings.every(([slug]) => slug !== 'persepcion-espiritual'))
      assert.ok(r.outputs.every((slug) => slug !== 'persepcion-espiritual'))
    }
  })

  it('percepcion-espiritual existe exactamente una vez', () => {
    assert.equal(elements.filter((e) => e.slug === 'percepcion-espiritual').length, 1)
  })

  it('vision-espiritual existe exactamente una vez', () => {
    assert.equal(elements.filter((e) => e.slug === 'vision-espiritual').length, 1)
  })

  it('vejez existe exactamente una vez', () => {
    assert.equal(elements.filter((e) => e.slug === 'vejez').length, 1)
    assert.equal(elements.find((e) => e.slug === 'vejez')?.isActive, false)
  })

  it('edad existe exactamente una vez', () => {
    assert.equal(elements.filter((e) => e.slug === 'edad').length, 1)
  })

  it('el slug estable experiencia-2 se conserva', () => {
    assert.equal(elements.filter((e) => e.slug === 'experiencia-2').length, 1)
    assert.equal(elements.some((e) => e.slug === 'experiencia'), false)
  })

  it('registro ya no es un elemento inicial: se fabrica en fase 2 (observación + diferenciación)', () => {
    const registro = elements.find((e) => e.slug === 'registro')
    assert.equal(registro?.isStarter ?? false, false)
    assert.equal(registro?.isHiddenUntilDiscovered ?? true, true)
    assert.equal(registro?.unlockedAtDiscoveryCount ?? null, null)
    const recipe = recipes.find(
      (r) =>
        r.ings.some(([slug]) => slug === 'observacion') &&
        r.ings.some(([slug]) => slug === 'diferenciacion'),
    )
    assert.deepEqual(recipe?.outputs, ['registro'])
  })

  it('tiempo está prohibido y no tiene fuente inicial, de secuencia o de cantidad', () => {
    const tiempo = elements.find((e) => e.slug === 'tiempo')
    assert.equal(tiempo?.isActive, false)
    assert.equal(tiempo?.isStarter ?? false, false)
    assert.equal(tiempo?.isHiddenUntilDiscovered ?? true, true)
    assert.equal(tiempo?.unlockedBySequenceNumber ?? null, null)
    assert.equal(tiempo?.unlockedByType ?? null, null)
    assert.equal(tiempo?.unlockedAtDiscoveryCount ?? null, null)
  })

  it('humano y tierra son iniciales visibles desde el principio; ojo y moneda también', () => {
    for (const slug of ['ojo', 'moneda', 'tierra', 'humano']) {
      const e = elements.find((el) => el.slug === slug)
      assert.equal(e?.isStarter, true, `${slug} debería ser inicial`)
      assert.equal(e?.isHiddenUntilDiscovered, false, `${slug} debería ser visible desde el principio`)
    }
  })

  it('misticismo, beyonder y agua no duplican el umbral de su fase', () => {
    for (const slug of ['misticismo', 'beyonder', 'agua']) {
      const e = elements.find((el) => el.slug === slug)
      assert.equal(e?.unlockedAtDiscoveryCount ?? null, null)
    }
  })

  it('Ritual conserva su slug y se revela como descubrimiento importante', () => {
    const ritual = elements.find((element) => element.slug === 'ritual')
    assert.equal(ritual?.isMajorDiscovery, true)
    assert.equal(ritual?.revealTitle, 'Nueva disciplina: Ritual')
    assert.match(ritual?.revealText ?? '', /prepara al Beyonder/)
  })

  it('no hay claves de ingredientes duplicadas entre recetas activas, usando el constructor canónico', () => {
    const activeKeys = recipes
      .filter((r) => r.isActive !== false)
      .map((r) => buildRecipeInputKey(r.ings.map(([slug, quantity]) => ({ slug, quantity }))))
    assert.equal(new Set(activeKeys).size, activeKeys.length)
  })

  it('toda receta totaliza exactamente dos unidades de ingredientes', () => {
    for (const r of recipes) {
      const total = r.ings.reduce((sum, [, quantity]) => sum + quantity, 0)
      assert.equal(total, 2, `Receta ${JSON.stringify(r.ings)} no totaliza 2 unidades`)
    }
  })

  it('toda receta activa tiene al menos una salida', () => {
    for (const r of recipes.filter((x) => x.isActive !== false)) {
      assert.ok(r.outputs.length > 0, `Receta ${JSON.stringify(r.ings)} sin salidas`)
    }
  })

  it('las transiciones de la Puerta y el Error alcanzan la Secuencia 6', () => {
    const escriba = sequences.find((s) => s.slug === 'escriba')
    const prometheus = sequences.find((s) => s.slug === 'prometheus')
    assert.equal(escriba?.number, 6)
    assert.equal(prometheus?.number, 6)
    assert.ok(advances.some((a) => a.target === 'escriba' && a.source === 'astrologo'))
    assert.ok(advances.some((a) => a.target === 'prometheus' && a.source === 'cryptologist'))
  })

  it('mantiene activas solo las ramas de Conocimiento propias de Fase 3', () => {
    const phase3KnowledgeRecipes: [string, string][] = [
      ['conocimiento', 'percepcion'],
      ['conocimiento', 'experiencia-2'],
      ['conocimiento', 'misticismo'],
    ]
    for (const [a, b] of phase3KnowledgeRecipes) {
      const recipe = recipes.find(
        (r) => new Set(r.ings.map(([slug]) => slug)).size === 2 &&
          r.ings.some(([slug]) => slug === a) &&
          r.ings.some(([slug]) => slug === b),
      )
      assert.notEqual(recipe?.isActive, false, `${a} + ${b} debe estar activa`)
    }
    const informacion = recipes.find(
      (r) => r.ings.some(([slug]) => slug === 'conocimiento') && r.ings.some(([slug]) => slug === 'dato'),
    )
    assert.equal(informacion?.isActive, false)
  })
})
