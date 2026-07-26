import assert from 'node:assert/strict'
import test from 'node:test'
import { CardContentSchema, filenameForCard, fromBuilderCardState, toBuilderCardState } from './schema'

test('convierte una carta Tier al estado que consume el renderer actual', () => {
  const content = CardContentSchema.parse({
    type: 'Tier',
    pathway: 'Fool',
    sequence: 9,
    rank: 'S',
    points: ['Versatilidad excepcional', 'Gran capacidad de preparacion'],
    footerText: 'Excellent information gathering.',
    backgroundImageUrl: '/cover-default.jpg',
  })

  assert.equal(toBuilderCardState(content).tierText, 'Versatilidad excepcional\nGran capacidad de preparacion')
  assert.equal(toBuilderCardState(content).tierSeq, 9)
  assert.equal(toBuilderCardState(content).tierFooterText, 'Excellent information gathering.')
  assert.equal(toBuilderCardState(content).tierBackgroundImage, '/cover-default.jpg')
  assert.equal(filenameForCard(content), 'tier-s_fool_seq-9')
})

test('convierte una carta Pathway (sin rank) al estado que consume el renderer actual', () => {
  const wholePathway = CardContentSchema.parse({
    type: 'Pathway',
    pathway: 'Moon',
    points: ['Magia vivificante', 'Domesticación de bestias'],
    footerText: 'Un camino de crianza y poder.',
  })
  const specificSequence = CardContentSchema.parse({
    type: 'Pathway',
    pathway: 'Moon',
    sequence: 9,
    points: ['Magia vivificante'],
    backgroundImageUrl: '/cover-default.jpg',
  })

  assert.equal(toBuilderCardState(wholePathway).pathwayCardPath, 'Moon')
  assert.equal(toBuilderCardState(wholePathway).pathwayCardSeq, null)
  assert.equal(toBuilderCardState(wholePathway).pathwayCardText, 'Magia vivificante\nDomesticación de bestias')
  assert.equal(toBuilderCardState(wholePathway).pathwayCardFooterText, 'Un camino de crianza y poder.')
  assert.equal(toBuilderCardState(specificSequence).pathwayCardSeq, 9)
  assert.equal(toBuilderCardState(specificSequence).pathwayCardBackgroundImage, '/cover-default.jpg')
  assert.equal(filenameForCard(wholePathway), 'pathway_moon')
  assert.equal(filenameForCard(specificSequence), 'pathway_moon_seq-9')
})

test('rechaza que una carta Pathway incluya un rank de tier', () => {
  assert.throws(() => CardContentSchema.parse({
    type: 'Pathway',
    pathway: 'Moon',
    rank: 'S',
    points: ['Magia vivificante'],
  }))
})

test('rechaza guardar binarios de imagen dentro del contenido textual', () => {
  assert.throws(() => CardContentSchema.parse({
    type: 'Character',
    name: 'Klein Moretti',
    pathway: 'Fool',
    sequence: 0,
    power: 'True God',
    imageUrl: 'data:image/png;base64,AAAA',
  }))
})

test('valida Tier Explanation general y General Explanation con pathway opcional', () => {
  const tierGeneral = CardContentSchema.parse({
    type: 'Tier Explanation',
    rank: 'A',
    description: 'Muy potente, aunque exige preparación.',
    backgroundImageUrl: '/cover-default.jpg',
  })
  const general = CardContentSchema.parse({
    type: 'General Explanation',
    title: 'Los caminos Beyonder',
    description: 'Cada camino representa una ruta distinta hacia la divinidad.',
    pathway: 'Door',
  })

  assert.equal(toBuilderCardState(tierGeneral).explanationPath, null)
  assert.equal(toBuilderCardState(tierGeneral).tierExplanationBackgroundImage, '/cover-default.jpg')
  assert.equal(toBuilderCardState(general).generalExplanationTitle, 'Los caminos Beyonder')
  assert.equal(filenameForCard(tierGeneral), 'tier-explanation-a')
  assert.equal(filenameForCard(general), 'general-explanation_los-caminos-beyonder_door')
})

test('valida una Pathway Explanation con titulo resaltado entre asteriscos', () => {
  const explanation = CardContentSchema.parse({
    type: 'Pathway Explanation',
    pathway: 'Door',
    title: "Door isn't a *teleport* pathway.",
    description: "It's access and exclusion.",
  })

  assert.equal(toBuilderCardState(explanation).pathwayExplanationPath, 'Door')
  assert.equal(toBuilderCardState(explanation).pathwayExplanationTitle, "Door isn't a *teleport* pathway.")
  assert.equal(toBuilderCardState(explanation).pathwayExplanationText, "It's access and exclusion.")
  assert.equal(filenameForCard(explanation), 'pathway-explanation_door')
})

test('valida una Breakdown con kicker opcional y etiqueta libre de la tercera seccion', () => {
  const withKicker = CardContentSchema.parse({
    type: 'Breakdown',
    kicker: 'Authority',
    title: 'Replication',
    does: 'Recreates powers, scenes and instances it has understood.',
    doesNot: 'Copy the person. Only the power.',
    edgeLabel: 'Edge',
    edgeText: 'Needs understanding, not storage.',
  })
  const withoutKickerOrLabel = CardContentSchema.parse({
    type: 'Breakdown',
    title: 'Door',
    does: 'Opens or closes access.',
    doesNot: 'Move you. It grants the passage.',
    edgeText: 'Sequence 0. Space, Seals and Alternate Worlds sit under it.',
  })

  assert.equal(toBuilderCardState(withKicker).breakdownKicker, 'Authority')
  assert.equal(toBuilderCardState(withKicker).breakdownEdgeLabel, 'Edge')
  assert.equal(toBuilderCardState(withoutKickerOrLabel).breakdownKicker, '')
  assert.equal(toBuilderCardState(withoutKickerOrLabel).breakdownEdgeLabel, 'Edge')
  assert.equal(filenameForCard(withKicker), 'breakdown_replication')
})

test('valida una Map con filas "tags -> value" y footer opcional', () => {
  const map = CardContentSchema.parse({
    type: 'Map',
    title: 'Where the powers come from',
    entries: [
      { tags: 'Door · Change · King of Space-Time', value: 'Door, Space, Seals, Alternate Worlds' },
      { tags: 'Bizarreness · Spirit World', value: 'Replication' },
    ],
    footerText: 'Three roots. Seven powers.',
  })
  const mapSinFooter = CardContentSchema.parse({
    type: 'Map',
    title: 'Sin footer',
    entries: [{ tags: '', value: 'Solo un valor' }],
  })

  assert.equal(
    toBuilderCardState(map).mapEntriesText,
    'Door · Change · King of Space-Time -> Door, Space, Seals, Alternate Worlds\nBizarreness · Spirit World -> Replication',
  )
  assert.equal(toBuilderCardState(map).mapFooterText, 'Three roots. Seven powers.')
  assert.equal(toBuilderCardState(mapSinFooter).mapEntriesText, 'Solo un valor')
  assert.equal(toBuilderCardState(mapSinFooter).mapFooterText, '')
  assert.equal(toBuilderCardState(map).mapPathway, null, 'sin pathway el tema es neutro')
  const roundTripped = fromBuilderCardState(toBuilderCardState(map))
  assert.equal(roundTripped.type === 'Map' && roundTripped.entries.length, 2)
  assert.equal(filenameForCard(map), 'map_where-the-powers-come-from')
})

test('una Map con pathway conserva el tema al ida y vuelta', () => {
  const tematica = CardContentSchema.parse({
    type: 'Map',
    title: 'Where the powers come from',
    entries: [{ tags: 'Door', value: 'Replication' }],
    pathway: 'Door',
    backgroundOpacity: 45,
  })

  assert.equal(toBuilderCardState(tematica).mapPathway, 'Door')
  assert.equal(toBuilderCardState(tematica).backgroundOpacity, 45)
  const roundTripped = fromBuilderCardState(toBuilderCardState(tematica))
  assert.equal(roundTripped.type === 'Map' && roundTripped.pathway, 'Door')
  assert.equal(roundTripped.type === 'Map' && roundTripped.backgroundOpacity, 45)
  assert.throws(() => CardContentSchema.parse({ ...tematica, backgroundOpacity: 101 }))
})

test('todas las cartas con fondo heredan 65 y conservan una opacidad propia', () => {
  const cards = [
    { type: 'Tier', pathway: 'Fool', rank: 'S', points: [] },
    { type: 'Pathway', pathway: 'Door', points: [] },
    { type: 'Tier Explanation', rank: 'A', description: 'Text' },
    { type: 'General Explanation', title: 'Title', description: 'Text', pathway: 'Door' },
    { type: 'Pathway Explanation', pathway: 'Door', title: 'Title', description: 'Text' },
    { type: 'Breakdown', title: 'Door', does: 'a', doesNot: 'b', edgeText: 'c' },
    { type: 'Map', title: 'Map', entries: [{ tags: 'Door', value: 'Space' }], pathway: 'Door' },
  ]

  for (const raw of cards) {
    const legacy = CardContentSchema.parse(raw)
    assert.equal(toBuilderCardState(legacy).backgroundOpacity, 65)
    const custom = CardContentSchema.parse({ ...raw, backgroundOpacity: 25 })
    const roundTripped = fromBuilderCardState(toBuilderCardState(custom))
    assert.equal('backgroundOpacity' in roundTripped && roundTripped.backgroundOpacity, 25)
  }
})

test('las tres cartas nuevas aceptan una imagen de fondo propia', () => {
  const explicacion = CardContentSchema.parse({
    type: 'Pathway Explanation', pathway: 'Door', title: 'Un *gancho*.', description: 'Texto.',
    backgroundImageUrl: '/covers/door.jpg',
  })
  const breakdown = CardContentSchema.parse({
    type: 'Breakdown', title: 'Seals', does: 'a', doesNot: 'b', edgeLabel: 'Edge', edgeText: 'c',
    backgroundImageUrl: '/covers/seals.jpg',
  })
  const mapa = CardContentSchema.parse({
    type: 'Map', title: 'The chain', entries: [{ tags: 'Means', value: 'Door' }],
    pathway: 'Door', backgroundImageUrl: '/covers/custom.jpg',
  })

  assert.equal(toBuilderCardState(explicacion).pathwayExplanationBackgroundImage, '/covers/door.jpg')
  assert.equal(toBuilderCardState(breakdown).breakdownBackgroundImage, '/covers/seals.jpg')
  assert.equal(toBuilderCardState(mapa).mapBackgroundImage, '/covers/custom.jpg')
  // Ida y vuelta: la ruta sobrevive al paso por el estado del editor.
  const ida = fromBuilderCardState(toBuilderCardState(breakdown))
  assert.equal(ida.type === 'Breakdown' && ida.backgroundImageUrl, '/covers/seals.jpg')
  // Sin imagen el campo no se inventa.
  const sinFondo = fromBuilderCardState(toBuilderCardState(
    CardContentSchema.parse({ type: 'Breakdown', title: 'Door', does: 'a', doesNot: 'b', edgeText: 'c' }),
  ))
  assert.equal(sinFondo.type === 'Breakdown' && 'backgroundImageUrl' in sinFondo, false)
})

test('valida un cover de imagen completa con título al pie', () => {
  const cover = CardContentSchema.parse({
    type: 'Full Image Cover',
    title: 'The Fool Returns',
    imageUrl: '/covers/fool.jpg',
  })

  assert.equal(toBuilderCardState(cover).fullCoverImage, '/covers/fool.jpg')
  assert.equal(filenameForCard(cover), 'full-cover_the-fool-returns')
})

test('rechaza pathways no canónicos y explicaciones fuera de límite', () => {
  assert.throws(() => CardContentSchema.parse({
    type: 'Tier Explanation',
    rank: 'S',
    description: 'Texto',
    pathway: 'Fool',
  }))
  assert.throws(() => CardContentSchema.parse({
    type: 'Tier',
    pathway: 'Fool',
    sequence: 10,
    rank: 'S',
    points: [],
  }))
  assert.throws(() => CardContentSchema.parse({
    type: 'Tier Explanation',
    rank: 'S',
    description: 'x'.repeat(241),
  }))
})
