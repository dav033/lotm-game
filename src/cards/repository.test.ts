import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
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

test('migra cards.db v4 a v5 sin perder cartas y acepta Pathway Explanation y Breakdown', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-cards-v4-'))
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
        'Character', 'Artifact', 'Cover', 'Full Image Cover', 'Tier', 'Pathway',
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
    PRAGMA user_version = 4;
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
    cards: [
      { type: 'Pathway Explanation', pathway: 'Door', title: "Door isn't a *teleport* pathway.", description: "It's access and exclusion." },
      { type: 'Breakdown', title: 'Replication', does: 'Recreates powers.', doesNot: 'Copy the person.', edgeLabel: 'Edge', edgeText: 'Needs understanding.' },
      { type: 'Map', title: 'Where the powers come from', entries: [{ tags: 'Door · Change', value: 'Replication' }] },
    ],
  })
  assert.equal(saved[0].content.type, 'Pathway Explanation')
  assert.equal(saved[1].content.type, 'Breakdown')
  assert.equal(saved[2].content.type, 'Map')
  assert.equal(repository.listCards().length, 4)
})

test('migra cards.db v7 a v8 y permite Tarot Member sin perder duracion', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-cards-'))
  const dbPath = path.join(directory, 'cards.db')
  const legacy = new Database(dbPath)
  legacy.exec(`
    PRAGMA foreign_keys = ON;
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
        'Character', 'Artifact', 'Cover', 'Full Image Cover', 'Tier', 'Pathway',
        'Tier Explanation', 'General Explanation', 'Pathway Explanation', 'Breakdown', 'Map'
      )),
      title TEXT NOT NULL, data_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      duration_seconds REAL, UNIQUE (part_id, position)
    );
    CREATE INDEX cards_part_id_idx ON cards(part_id);
    CREATE INDEX parts_universe_id_idx ON parts(universe_id);
    CREATE TABLE imported_images (
      id TEXT PRIMARY KEY, universe_id TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
      position INTEGER NOT NULL, title TEXT NOT NULL, file_path TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, duration_seconds REAL,
      UNIQUE (universe_id, position)
    );
    INSERT INTO universes VALUES ('u', 'lotm', 'LOTM', '', 'now', 'now');
    INSERT INTO parts VALUES ('p', 'u', 'club', 'Club', 1, '', 'now', 'now');
    INSERT INTO cards VALUES (
      'c', 'p', 1, 'General Explanation', 'Old card',
      '{"type":"General Explanation","title":"Old card","description":"Still here."}',
      'now', 'now', 4.5
    );
    PRAGMA user_version = 7;
  `)
  legacy.close()

  const repository = new CardRepository(dbPath)
  t.after(async () => {
    repository.close()
    await fs.rm(directory, { recursive: true, force: true })
  })
  assert.equal(repository.listCards()[0].durationSeconds, 4.5)
  const [saved] = repository.saveBatch({
    universe: { name: 'LOTM' },
    part: { name: 'Club', number: 1 },
    cards: [{
      type: 'Tarot Member', variant: 'Contrast', name: 'Klein Moretti', tarotTitle: 'The Fool',
      description: 'Ancient deity.', detailLabel: 'Reality', detailText: 'Improvising human.',
      pathway: 'Fool', backgroundOpacity: 48,
    }],
  })
  assert.equal(saved.content.type, 'Tarot Member')
  const migrated = new Database(dbPath, { readonly: true })
  assert.equal(migrated.pragma('user_version', { simple: true }), 8)
  migrated.close()
})

test('divide una seccion en varias conservando las cartas', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-cards-'))
  const repository = new CardRepository(path.join(directory, 'cards.db'))
  t.after(async () => {
    repository.close()
    await fs.rm(directory, { recursive: true, force: true })
  })

  const saved = repository.saveBatch({
    universe: { name: 'LOTM' },
    part: { name: 'Todo junto', number: 1 },
    cards: (['Fool', 'Moon', 'Sun', 'Door'] as const).map((pathway) => ({
      type: 'Pathway' as const,
      pathway,
      points: [pathway],
    })),
  })
  const [fool, moon, sun, door] = saved

  const moved = repository.moveCards([sun.id, door.id], { part: { name: 'Segunda mitad', number: 2 } })

  assert.deepEqual(moved.map(({ position }) => position), [1, 2])
  assert.equal(moved[0].id, sun.id, 'conserva el id, no recrea la carta')
  assert.equal(moved[0].createdAt, sun.createdAt, 'conserva la fecha de creacion')
  assert.deepEqual(moved[0].content, sun.content, 'conserva el contenido')
  assert.equal(moved[0].universe.slug, 'lotm', 'sin universo explicito se queda en el suyo')

  const library = repository.listLibrary()[0]
  assert.deepEqual(
    library.parts.map(({ name, cards }) => [name, cards.length]),
    [['Todo junto', 2], ['Segunda mitad', 2]],
  )
  assert.equal(repository.listCards().length, 4, 'no se pierde ni se duplica ninguna carta')

  // Mover dentro de la misma seccion reordena sin chocar con UNIQUE.
  const reordered = repository.moveCards([moon.id, fool.id], { part: { name: 'Todo junto' } })
  assert.deepEqual(reordered.map(({ id }) => id), [moon.id, fool.id])
  assert.deepEqual(reordered.map(({ position }) => position), [1, 2])

  assert.throws(
    () => repository.moveCards([randomUUID()], { part: { name: 'Otra' } }),
    /No existe ninguna de las cartas/,
  )
})

// De esto vive el arrastre entre secciones del filmstrip: manda la seccion de
// destino entera, con la carta forastera ya intercalada, y espera ese orden. Si
// moveCards volviera a pegarla al final, la carta saltaria al ultimo sitio.
test('mover con la seccion de destino entera coloca la carta intercalada', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-cards-'))
  const repository = new CardRepository(path.join(directory, 'cards.db'))
  t.after(async () => {
    repository.close()
    await fs.rm(directory, { recursive: true, force: true })
  })

  const [forastera] = repository.saveBatch({
    universe: { name: 'LOTM' },
    part: { name: 'Origen', number: 1 },
    cards: [{ type: 'Pathway' as const, pathway: 'Fool' as const, points: ['Fool'] }],
  })
  const [primera, segunda] = repository.saveBatch({
    universe: { name: 'LOTM' },
    part: { name: 'Destino', number: 2 },
    cards: (['Moon', 'Sun'] as const).map((pathway) => ({
      type: 'Pathway' as const,
      pathway,
      points: [pathway],
    })),
  })

  const moved = repository.moveCards(
    [primera.id, forastera.id, segunda.id],
    { part: { name: 'Destino' } },
  )

  assert.deepEqual(moved.map(({ id }) => id), [primera.id, forastera.id, segunda.id])
  assert.deepEqual(moved.map(({ position }) => position), [1, 2, 3])
  // La seccion de origen se queda sin cartas y desaparece de la biblioteca.
  assert.deepEqual(repository.listLibrary()[0].parts.map(({ name }) => name), ['Destino'])
  // Omitir el numero no renumera la seccion de destino.
  assert.equal(repository.listLibrary()[0].parts[0].number, 2)
})

test('renombra una seccion y rechaza colisiones dentro del universo', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-cards-'))
  const repository = new CardRepository(path.join(directory, 'cards.db'))
  t.after(async () => {
    repository.close()
    await fs.rm(directory, { recursive: true, force: true })
  })

  const card = { type: 'Pathway' as const, pathway: 'Fool' as const, points: ['x'] }
  const [primera] = repository.saveBatch({
    universe: { name: 'LOTM' }, part: { name: 'Primera', number: 1 }, cards: [card],
  })
  repository.saveBatch({ universe: { name: 'LOTM' }, part: { name: 'Segunda', number: 2 }, cards: [card] })

  const renamed = repository.renamePart(primera.part.id, { name: 'Rituales de apertura' })
  assert.equal(renamed.name, 'Rituales de apertura')
  assert.equal(renamed.slug, 'rituales-de-apertura', 'el slug sigue al nombre')
  assert.equal(repository.getCard(primera.id)?.part.name, 'Rituales de apertura')

  // Con el slug actualizado, el MCP la reutiliza por el nombre nuevo.
  repository.saveBatch({
    universe: { name: 'LOTM' }, part: { name: 'Rituales de apertura' }, cards: [card],
  })
  assert.equal(repository.listLibrary()[0].parts.length, 2, 'no se creo una seccion duplicada')

  assert.throws(
    () => repository.renamePart(primera.part.id, { name: 'Segunda' }),
    /Ya existe otra seccion/,
  )
  assert.throws(() => repository.renamePart(randomUUID(), { name: 'X' }), /No existe la seccion/)
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

test('los proyectos incluyen los vacios y no admiten nombres repetidos', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-projects-'))
  const repository = new CardRepository(path.join(directory, 'cards.db'))
  t.after(async () => {
    repository.close()
    await fs.rm(directory, { recursive: true, force: true })
  })

  const created = repository.createProject('Door explicado')
  assert.equal(created.cardCount, 0)
  assert.equal(created.imageCount, 0)
  // Un proyecto recien creado no tiene cartas, pero el editor tiene que poder
  // abrirlo igualmente.
  assert.deepEqual(repository.listProjects().map(({ name }) => name), ['Door explicado'])

  assert.throws(() => repository.createProject('door-explicado'), /Ya existe un proyecto/)
  assert.throws(() => repository.createProject('   '), /necesita un nombre/)
})

test('las imagenes importadas se ordenan, se reordenan y se borran', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-images-'))
  const repository = new CardRepository(path.join(directory, 'cards.db'))
  t.after(async () => {
    repository.close()
    await fs.rm(directory, { recursive: true, force: true })
  })

  const project = repository.createProject('Recortes')
  const added = repository.addImages(project.id, [
    { url: '/api/cards/images/a.png', name: 'a.png' },
    { url: '/api/cards/images/b.png', name: 'b.png' },
    { url: '/api/cards/images/c.png', name: 'c.png' },
  ])
  assert.deepEqual(added.map(({ position }) => position), [1, 2, 3])

  // Importar de nuevo continua la numeracion en vez de reiniciarla.
  const more = repository.addImages(project.id, [{ url: '/api/cards/images/d.png', name: 'd.png' }])
  assert.deepEqual(more.map(({ name }) => name), ['a.png', 'b.png', 'c.png', 'd.png'])

  // La tabla exige position > 0, asi que el reordenado no puede apartar las
  // posiciones negandolas: esto falla si alguien lo reescribe asi.
  const rotated = repository.reorderImages(project.id, [added[2].id, added[0].id, added[1].id])
  assert.deepEqual(rotated.map(({ name }) => name), ['c.png', 'a.png', 'b.png', 'd.png'])
  assert.deepEqual(rotated.map(({ position }) => position), [1, 2, 3, 4])

  assert.equal(repository.deleteImage(added[0].id), true)
  assert.equal(repository.deleteImage(added[0].id), false)
  assert.deepEqual(repository.listImages(project.id).map(({ name }) => name), ['c.png', 'b.png', 'd.png'])

  assert.throws(() => repository.addImages(randomUUID(), [{ url: '/x.png', name: 'x' }]), /no existe/)
  assert.equal(repository.listProjects().find(({ id }) => id === project.id)?.imageCount, 3)
})

test('borrar un proyecto arrastra sus imagenes importadas', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-cascade-'))
  const file = path.join(directory, 'cards.db')
  const repository = new CardRepository(file)
  t.after(async () => {
    repository.close()
    await fs.rm(directory, { recursive: true, force: true })
  })

  const project = repository.createProject('Temporal')
  repository.addImages(project.id, [{ url: '/api/cards/images/a.png', name: 'a.png' }])

  const raw = new Database(file)
  raw.pragma('foreign_keys = ON')
  raw.prepare('DELETE FROM universes WHERE id = ?').run(project.id)
  raw.close()

  assert.deepEqual(repository.listImages(), [])
})

test('la duracion propia se guarda, se acota y se puede quitar', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-duration-'))
  const repository = new CardRepository(path.join(directory, 'cards.db'))
  t.after(async () => {
    repository.close()
    await fs.rm(directory, { recursive: true, force: true })
  })

  const [card] = repository.saveBatch({
    universe: { name: 'LOTM' },
    part: { name: 'Door', number: 1 },
    cards: [{ type: 'Pathway', pathway: 'Door', points: ['Sellos'] }],
  })
  // Sin tocar nada, una carta hereda la duracion global.
  assert.equal(card.durationSeconds, null)

  assert.equal(repository.setCardDuration(card.id, 7.5)?.durationSeconds, 7.5)
  assert.equal(repository.getCard(card.id)?.durationSeconds, 7.5)
  // Los limites se aplican en el repositorio, no solo en la ruta HTTP.
  assert.equal(repository.setCardDuration(card.id, 900)?.durationSeconds, 60)
  assert.equal(repository.setCardDuration(card.id, 0)?.durationSeconds, 0.5)
  // null la devuelve a la global.
  assert.equal(repository.setCardDuration(card.id, null)?.durationSeconds, null)
  assert.equal(repository.setCardDuration(randomUUID(), 3), null)

  const project = repository.createProject('Recortes')
  const [image] = repository.addImages(project.id, [{ url: '/a.png', name: 'a.png' }])
  assert.equal(image.durationSeconds, null)
  assert.equal(repository.setImageDuration(image.id, 2.5)?.durationSeconds, 2.5)
  assert.equal(repository.listImages(project.id)[0].durationSeconds, 2.5)
  assert.equal(repository.setImageDuration(image.id, null)?.durationSeconds, null)
  assert.equal(repository.setImageDuration(randomUUID(), 3), null)
})
