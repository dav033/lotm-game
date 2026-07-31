import assert from 'node:assert/strict'
import test from 'node:test'
import JSZip from 'jszip'
import { createCardsZip } from './export'
import type { StoredCard } from './repository'
import { titleForCard } from './schema'

test('un unico universo y una unica parte van planos, sin subcarpetas', async () => {
  const cards: StoredCard[] = [
    storedCard('a', 1, {
      type: 'Character',
      name: 'Ichigo Kurosaki',
      pathway: 'Red Priest',
      sequence: 4,
      power: 'Saint',
    }),
    storedCard('b', 2, {
      type: 'Tier',
      pathway: 'Fool',
      sequence: 9,
      rank: 'S',
      points: ['Control espiritual'],
    }),
    storedCard('c', 3, {
      type: 'Pathway',
      pathway: 'Moon',
      points: ['Magia vivificante'],
    }),
    storedCard('d', 4, {
      type: 'Tier Explanation',
      rank: 'A',
      description: 'Gran utilidad general.',
    }),
    storedCard('e', 5, {
      type: 'General Explanation',
      title: 'Los caminos',
      description: 'Una introducción general.',
      pathway: 'Door',
    }),
    storedCard('f', 6, {
      type: 'Full Image Cover',
      title: 'Soul Society',
      imageUrl: '/cover-default.jpg',
    }),
  ]
  const archive = await createCardsZip(cards, async () => Buffer.from('png'))
  const zip = await JSZip.loadAsync(archive)
  const files = Object.keys(zip.files).filter((name) => !zip.files[name].dir)

  assert.deepEqual(files.sort(), [
    '001_ichigo-kurosaki_seq-4.png',
    '002_tier-s_fool_seq-9.png',
    '003_pathway_moon.png',
    '004_tier-explanation-a.png',
    '005_general-explanation_los-caminos_door.png',
    '006_full-cover_soul-society.png',
  ])
  assert.ok(files.every((name) => name.endsWith('.png')), 'el zip no debe contener nada mas que imagenes')
})

test('varias partes del mismo universo si se anidan, para no chocar nombres', async () => {
  const cards: StoredCard[] = [
    storedCard('a', 1, { type: 'Pathway', pathway: 'Moon', points: ['Uno'] }, { partSlug: 'arc-1', partNumber: 1 }),
    storedCard('b', 1, { type: 'Pathway', pathway: 'Sun', points: ['Dos'] }, { partSlug: 'arc-2', partNumber: 2 }),
  ]
  const archive = await createCardsZip(cards, async () => Buffer.from('png'))
  const zip = await JSZip.loadAsync(archive)
  const files = Object.keys(zip.files).filter((name) => !zip.files[name].dir)

  assert.deepEqual(files.sort(), [
    '01-arc-1/001_pathway_moon.png',
    '02-arc-2/001_pathway_sun.png',
  ])
})

function storedCard(
  id: string,
  position: number,
  content: StoredCard['content'],
  overrides: { partSlug?: string; partNumber?: number } = {},
): StoredCard {
  return {
    id,
    position,
    type: content.type,
    title: titleForCard(content),
    content,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    durationSeconds: null,
    universe: { id: 'u', slug: 'bleach', name: 'Bleach', description: '' },
    part: {
      id: overrides.partSlug ?? 'p',
      slug: overrides.partSlug ?? 'soul-society',
      name: 'Soul Society',
      number: overrides.partNumber ?? 1,
      description: '',
    },
  }
}
