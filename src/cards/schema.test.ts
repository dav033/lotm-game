import assert from 'node:assert/strict'
import test from 'node:test'
import { CardContentSchema, filenameForCard, toBuilderCardState } from './schema'

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
