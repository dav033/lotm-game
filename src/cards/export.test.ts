import assert from 'node:assert/strict'
import test from 'node:test'
import JSZip from 'jszip'
import { createCardsZip } from './export'
import type { StoredCard } from './repository'
import { titleForCard } from './schema'

test('el ZIP contiene todas las cartas organizadas y un manifiesto textual', async () => {
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
  const archive = await createCardsZip(cards, async () => Buffer.from('png'), '2026-07-20T00:00:00.000Z')
  const zip = await JSZip.loadAsync(archive)
  const files = Object.keys(zip.files).filter((name) => !zip.files[name].dir)

  assert.deepEqual(files.sort(), [
    'bleach/01-soul-society/001_ichigo-kurosaki_seq-4.png',
    'bleach/01-soul-society/002_tier-s_fool_seq-9.png',
    'bleach/01-soul-society/003_pathway_moon.png',
    'bleach/01-soul-society/004_tier-explanation-a.png',
    'bleach/01-soul-society/005_general-explanation_los-caminos_door.png',
    'bleach/01-soul-society/006_full-cover_soul-society.png',
    'manifest.json',
  ])
  const manifest = JSON.parse(await zip.file('manifest.json')!.async('text'))
  assert.equal(manifest.cards.length, 6)
  assert.equal(manifest.version, 3)
  assert.equal(manifest.cards[0].content.name, 'Ichigo Kurosaki')
})

function storedCard(
  id: string,
  position: number,
  content: StoredCard['content'],
): StoredCard {
  return {
    id,
    position,
    type: content.type,
    title: titleForCard(content),
    content,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    universe: { id: 'u', slug: 'bleach', name: 'Bleach', description: '' },
    part: { id: 'p', slug: 'soul-society', name: 'Soul Society', number: 1, description: '' },
  }
}
