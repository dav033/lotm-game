import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'
import { CardRepository, type StoredCard } from './repository'

test('guarda y consulta cartas agrupadas en un SQLite separado', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-cards-'))
  const repository = new CardRepository(path.join(directory, 'cards.db'))
  t.after(async () => {
    repository.close()
    await fs.rm(directory, { recursive: true, force: true })
  })

  const saved = repository.saveBatch({
    universe: { name: 'Bleach', description: 'Shinigamis y hollows.' },
    part: { name: 'Soul Society', number: 1 },
    cards: [
      {
        type: 'Character',
        name: 'Ichigo Kurosaki',
        pathway: 'Red Priest',
        sequence: 4,
        power: 'Saint',
      },
      {
        type: 'Tier',
        pathway: 'Fool',
        sequence: 9,
        rank: 'S',
        points: ['Control espiritual'],
      },
      {
        type: 'Pathway',
        pathway: 'Moon',
        points: ['Magia vivificante'],
      },
      {
        type: 'Tier Explanation',
        rank: 'S',
        description: 'El rango más completo.',
      },
      {
        type: 'General Explanation',
        title: 'El mundo espiritual',
        description: 'Una capa invisible que conecta numerosos lugares.',
        pathway: 'Door',
      },
      {
        type: 'Full Image Cover',
        title: 'Soul Society',
        imageUrl: '/covers/soul-society.jpg',
      },
    ],
  })

  assert.equal(saved.length, 6)
  assert.deepEqual(saved.map(({ position }) => position), [1, 2, 3, 4, 5, 6])
  assert.equal(repository.listLibrary()[0].parts[0].cards.length, 6)
  assert.equal(repository.listCards({ universe: 'bleach', part: 'soul-society' }).length, 6)

  const updated = repository.updateCard(saved[0].id, {
    type: 'Artifact',
    name: 'Zangetsu',
    pathway: 'Twilight Giant',
    sequence: 3,
    grade: '1',
  })
  assert.equal(updated?.title, 'Zangetsu')
  assert.equal(repository.deleteCards([saved[1].id]), 1)
  assert.equal(repository.listCards().length, 5)
})

test('migra cards.db v1 a v3 sin perder cartas', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-cards-v1-'))
  const dbPath = path.join(directory, 'cards.db')
  const legacy = new Database(dbPath)
  legacy.exec(`
    CREATE TABLE universes (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE parts (
      id TEXT PRIMARY KEY, universe_id TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
      slug TEXT NOT NULL COLLATE NOCASE, name TEXT NOT NULL, number INTEGER,
      description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE (universe_id, slug)
    );
    CREATE TABLE cards (
      id TEXT PRIMARY KEY, part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
      position INTEGER NOT NULL CHECK (position > 0),
      type TEXT NOT NULL CHECK (type IN ('Character', 'Artifact', 'Cover', 'Tier')),
      title TEXT NOT NULL, data_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE (part_id, position)
    );
    CREATE INDEX cards_part_id_idx ON cards(part_id);
    CREATE INDEX parts_universe_id_idx ON parts(universe_id);
    INSERT INTO universes VALUES ('u', 'lotm', 'LOTM', '', 'now', 'now');
    INSERT INTO parts VALUES ('p', 'u', 'tiers', 'Tiers', 1, '', 'now', 'now');
    INSERT INTO cards VALUES (
      'c', 'p', 1, 'Tier', 'Fool - Tier S',
      '{"type":"Tier","pathway":"Fool","rank":"S","points":["Versátil"]}',
      'now', 'now'
    );
    PRAGMA user_version = 1;
  `)
  legacy.close()

  const repository = new CardRepository(dbPath)
  t.after(async () => {
    repository.close()
    await fs.rm(directory, { recursive: true, force: true })
  })
  assert.equal(repository.listCards()[0].content.type, 'Tier')
  repository.saveBatch({
    universe: { name: 'LOTM' },
    part: { name: 'Tiers', number: 1 },
    cards: [{ type: 'Tier Explanation', rank: 'A', description: 'Una explicación.' }],
  })
  repository.saveBatch({
    universe: { name: 'LOTM' },
    part: { name: 'Tiers', number: 1 },
    cards: [{ type: 'Full Image Cover', title: 'Portada final' }],
  })
  assert.equal(repository.listCards().length, 3)
})

test('migra cards.db v3 a v4 sin perder cartas y acepta cartas Pathway', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-cards-v3-'))
  const dbPath = path.join(directory, 'cards.db')
  const legacy = new Database(dbPath)
  legacy.exec(`
    CREATE TABLE universes (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE parts (
      id TEXT PRIMARY KEY, universe_id TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
      slug TEXT NOT NULL COLLATE NOCASE, name TEXT NOT NULL, number INTEGER,
      description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE (universe_id, slug)
    );
    CREATE TABLE cards (
      id TEXT PRIMARY KEY, part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
      position INTEGER NOT NULL CHECK (position > 0),
      type TEXT NOT NULL CHECK (type IN (
        'Character', 'Artifact', 'Cover', 'Full Image Cover', 'Tier',
        'Tier Explanation', 'General Explanation'
      )),
      title TEXT NOT NULL, data_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE (part_id, position)
    );
    CREATE INDEX cards_part_id_idx ON cards(part_id);
    CREATE INDEX parts_universe_id_idx ON parts(universe_id);
    INSERT INTO universes VALUES ('u', 'lotm', 'LOTM', '', 'now', 'now');
    INSERT INTO parts VALUES ('p', 'u', 'tiers', 'Tiers', 1, '', 'now', 'now');
    INSERT INTO cards VALUES (
      'c', 'p', 1, 'Tier', 'Fool - Tier S',
      '{"type":"Tier","pathway":"Fool","rank":"S","points":["Versátil"]}',
      'now', 'now'
    );
    PRAGMA user_version = 3;
  `)
  legacy.close()

  const repository = new CardRepository(dbPath)
  t.after(async () => {
    repository.close()
    await fs.rm(directory, { recursive: true, force: true })
  })
  assert.equal(repository.listCards()[0].content.type, 'Tier')
  const saved = repository.saveBatch({
    universe: { name: 'LOTM' },
    part: { name: 'Tiers', number: 1 },
    cards: [{ type: 'Pathway', pathway: 'Moon', points: ['Magia vivificante'] }],
  })
  assert.equal(saved[0].content.type, 'Pathway')
  assert.equal(repository.listCards().length, 2)
})

test('reordena una parte sin romper la unicidad de posiciones', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-cards-'))
  const repository = new CardRepository(path.join(directory, 'cards.db'))
  t.after(async () => {
    repository.close()
    await fs.rm(directory, { recursive: true, force: true })
  })

  const saved = repository.saveBatch({
    universe: { name: 'LOTM' },
    part: { name: 'Tiers', number: 1 },
    cards: (['Fool', 'Moon', 'Sun', 'Door'] as const).map((pathway) => ({
      type: 'Pathway' as const,
      pathway,
      points: [pathway],
    })),
  })
  const partId = saved[0].part.id
  const nameOf = ({ content }: StoredCard) =>
    'pathway' in content ? content.pathway : content.type

  // Invierte el orden: cada carta pasa por una posicion que otra ocupaba.
  const reversed = [...saved].reverse().map(({ id }) => id)
  const result = repository.reorderPart(partId, reversed)

  assert.deepEqual(result.map(nameOf), ['Door', 'Sun', 'Moon', 'Fool'])
  assert.deepEqual(result.map(({ position }) => position), [1, 2, 3, 4])
  assert.deepEqual(repository.listCards().map(nameOf), ['Door', 'Sun', 'Moon', 'Fool'])

  // Una lista parcial deja el resto al final, conservando su orden relativo.
  const partial = repository.reorderPart(partId, [saved[1].id])
  assert.deepEqual(partial.map(nameOf), ['Moon', 'Door', 'Sun', 'Fool'])
  assert.deepEqual(partial.map(({ position }) => position), [1, 2, 3, 4])
})

test('la revision cambia con las escrituras propias y con las de otra conexion', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-cards-'))
  const dbPath = path.join(directory, 'cards.db')
  const reader = new CardRepository(dbPath)
  const writer = new CardRepository(dbPath)
  t.after(async () => {
    reader.close()
    writer.close()
    await fs.rm(directory, { recursive: true, force: true })
  })

  const batch = {
    universe: { name: 'LOTM' },
    part: { name: 'Tiers', number: 1 },
    cards: [{ type: 'Pathway' as const, pathway: 'Moon' as const, points: ['Magia vivificante'] }],
  }

  const initial = reader.revision()
  assert.equal(reader.revision(), initial, 'sin escrituras la revision es estable')

  // Escritura propia: solo la detecta el contador local.
  reader.saveBatch(batch)
  const afterOwnWrite = reader.revision()
  assert.notEqual(afterOwnWrite, initial)

  // Escritura de otro proceso (otra conexion sobre el mismo archivo): la
  // detecta data_version, que es lo que sostiene la vista en vivo.
  const [card] = writer.listCards()
  writer.updateCard(card.id, { type: 'Pathway', pathway: 'Sun', points: ['Luz'] })
  assert.notEqual(reader.revision(), afterOwnWrite)
})
