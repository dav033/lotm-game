import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
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

  it('mantiene recetas sin entradas duplicadas y con referencias existentes', () => {
    const recipes = getRecipeDefinitions()
    const keys = recipes.map((recipe) => inputKey(recipe.ings))

    assert.equal(new Set(keys).size, recipes.length)
    for (const recipe of recipes) {
      for (const [slug] of recipe.ings) assert.ok(elementSlugs.has(slug), `Ingrediente inexistente: ${slug}`)
      for (const slug of recipe.outputs) assert.ok(elementSlugs.has(slug), `Salida inexistente: ${slug}`)
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

  it('permite los solapamientos existentes entre entradas de recetas y avances', () => {
    const recipeKeys = new Set(getRecipeDefinitions().map((recipe) => inputKey(recipe.ings)))
    const advanceKeys = new Set(
      getAdvanceDefinitions().map((advance) =>
        inputKey(advance.ingredients.map((slug) => [slug, 1])),
      ),
    )
    const overlaps = [...recipeKeys].filter((key) => advanceKeys.has(key))

    assert.ok(overlaps.length > 0)
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

describe('integridad del catálogo — rediseño de progresión (fases 1-3)', () => {
  const recipes = getRecipeDefinitions()
  const advances = getAdvanceDefinitions()

  it('no existe el elemento Apuesta', () => {
    assert.equal(elements.some((e) => e.slug === 'apuesta'), false)
  })

  it('ningún ingrediente ni salida referencia a Apuesta', () => {
    for (const r of recipes) {
      assert.ok(r.ings.every(([slug]) => slug !== 'apuesta'))
      assert.ok(r.outputs.every((slug) => slug !== 'apuesta'))
    }
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
  })

  it('edad existe exactamente una vez', () => {
    assert.equal(elements.filter((e) => e.slug === 'edad').length, 1)
  })

  it('el slug estable experiencia-2 se conserva', () => {
    assert.equal(elements.filter((e) => e.slug === 'experiencia-2').length, 1)
    assert.equal(elements.some((e) => e.slug === 'experiencia'), false)
  })

  it('registro es un elemento inicial visible desde el principio', () => {
    const registro = elements.find((e) => e.slug === 'registro')
    assert.equal(registro?.isStarter, true)
    assert.equal(registro?.isHiddenUntilDiscovered, false)
  })

  it('tiempo ya no es un elemento inicial y permanece oculto hasta descubrirse', () => {
    const tiempo = elements.find((e) => e.slug === 'tiempo')
    assert.equal(tiempo?.isStarter, false)
    assert.equal(tiempo?.isHiddenUntilDiscovered, true)
    assert.equal(tiempo?.unlockedBySequenceNumber, 6)
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

  it('las cuatro recetas reservadas de Conocimiento para la Fase 4 están inactivas', () => {
    const reserved: [string, string][] = [
      ['conocimiento', 'dato'],
      ['conocimiento', 'percepcion'],
      ['conocimiento', 'experiencia-2'],
      ['conocimiento', 'misticismo'],
    ]
    for (const [a, b] of reserved) {
      const recipe = recipes.find(
        (r) => new Set(r.ings.map(([slug]) => slug)).size === 2 &&
          r.ings.some(([slug]) => slug === a) &&
          r.ings.some(([slug]) => slug === b),
      )
      assert.ok(recipe, `Falta la receta reservada ${a} + ${b}`)
      assert.equal(recipe?.isActive, false, `${a} + ${b} debería estar inactiva`)
    }
  })
})
