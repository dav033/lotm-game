import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import {
  CardContentSchema,
  SaveCardBatchSchema,
  type CardContent,
  type CardFilter,
  type SaveCardBatchInput,
  slugify,
  titleForCard,
} from './schema'

type UniverseRow = {
  id: string
  slug: string
  name: string
  description: string
  created_at: string
  updated_at: string
}

type PartRow = {
  id: string
  universe_id: string
  slug: string
  name: string
  number: number | null
  description: string
  created_at: string
  updated_at: string
}

type JoinedCardRow = {
  id: string
  position: number
  type: CardContent['type']
  title: string
  data_json: string
  created_at: string
  updated_at: string
  universe_id: string
  universe_slug: string
  universe_name: string
  universe_description: string
  part_id: string
  part_slug: string
  part_name: string
  part_number: number | null
  part_description: string
}

export type StoredCard = {
  id: string
  position: number
  type: CardContent['type']
  title: string
  content: CardContent
  createdAt: string
  updatedAt: string
  universe: {
    id: string
    slug: string
    name: string
    description: string
  }
  part: {
    id: string
    slug: string
    name: string
    number: number | null
    description: string
  }
}

export type Project = {
  id: string
  slug: string
  name: string
  description: string
  cardCount: number
  imageCount: number
}

type ImportedImageRow = {
  id: string
  universe_id: string
  position: number
  url: string
  name: string
  created_at: string
}

export type ImportedImage = {
  id: string
  universeId: string
  position: number
  url: string
  name: string
  createdAt: string
}

export type MoveCardsTarget = {
  universe?: SaveCardBatchInput['universe']
  part: SaveCardBatchInput['part']
}

export type CardLibrary = Array<{
  id: string
  slug: string
  name: string
  description: string
  parts: Array<{
    id: string
    slug: string
    name: string
    number: number | null
    description: string
    cards: StoredCard[]
  }>
}>

export function resolveCardsDbPath(): string {
  return path.resolve(process.env.CARDS_DB_PATH || path.join('data', 'cards.db'))
}

export class CardRepository {
  private readonly db: Database.Database
  private localWrites = 0

  constructor(dbPath = resolveCardsDbPath()) {
    if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true })
    this.db = new Database(dbPath)
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('journal_mode = WAL')
    this.migrate()
  }

  close(): void {
    this.db.close()
  }

  // Identifica el estado actual de la biblioteca sin leerla entera. `data_version`
  // solo cambia con los commits de otras conexiones (el MCP stdio, el MCP HTTP u
  // otro contenedor sobre el mismo volumen), asi que el contador local cubre las
  // escrituras hechas por esta misma conexion.
  revision(): string {
    return `${this.db.pragma('data_version', { simple: true }) as number}.${this.localWrites}`
  }

  // Crea o reutiliza el universo y la parte indicados. Lo comparten saveBatch y
  // moveCards, que necesitan exactamente la misma resolucion por slug.
  private resolvePart(
    universe: SaveCardBatchInput['universe'],
    part: SaveCardBatchInput['part'],
    now: string,
  ): PartRow {
    const universeSlug = slugify(universe.name)
    this.db
      .prepare(`
        INSERT INTO universes (id, slug, name, description, created_at, updated_at)
        VALUES (@id, @slug, @name, @description, @now, @now)
        ON CONFLICT(slug) DO UPDATE SET
          name = excluded.name,
          description = CASE WHEN @hasDescription = 1 THEN excluded.description ELSE universes.description END,
          updated_at = excluded.updated_at
      `)
      .run({
        id: randomUUID(),
        slug: universeSlug,
        name: universe.name,
        description: universe.description ?? '',
        hasDescription: universe.description === undefined ? 0 : 1,
        now,
      })

    const universeRow = this.db
      .prepare('SELECT * FROM universes WHERE slug = ?')
      .get(universeSlug) as UniverseRow
    const partSlug = slugify(part.name)

    this.db
      .prepare(`
        INSERT INTO parts (id, universe_id, slug, name, number, description, created_at, updated_at)
        VALUES (@id, @universeId, @slug, @name, @number, @description, @now, @now)
        ON CONFLICT(universe_id, slug) DO UPDATE SET
          name = excluded.name,
          number = CASE WHEN @hasNumber = 1 THEN excluded.number ELSE parts.number END,
          description = CASE WHEN @hasDescription = 1 THEN excluded.description ELSE parts.description END,
          updated_at = excluded.updated_at
      `)
      .run({
        id: randomUUID(),
        universeId: universeRow.id,
        slug: partSlug,
        name: part.name,
        number: part.number ?? null,
        hasNumber: part.number === undefined ? 0 : 1,
        description: part.description ?? '',
        hasDescription: part.description === undefined ? 0 : 1,
        now,
      })

    return this.db
      .prepare('SELECT * FROM parts WHERE universe_id = ? AND slug = ?')
      .get(universeRow.id, partSlug) as PartRow
  }

  saveBatch(rawInput: SaveCardBatchInput): StoredCard[] {
    const input = SaveCardBatchSchema.parse(rawInput)
    const save = this.db.transaction(() => {
      const now = new Date().toISOString()
      const part = this.resolvePart(input.universe, input.part, now)
      const maxPosition = this.db
        .prepare('SELECT COALESCE(MAX(position), 0) AS value FROM cards WHERE part_id = ?')
        .get(part.id) as { value: number }
      const insert = this.db.prepare(`
        INSERT INTO cards (id, part_id, position, type, title, data_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      const ids: string[] = []

      input.cards.forEach((content, index) => {
        const id = randomUUID()
        ids.push(id)
        insert.run(
          id,
          part.id,
          maxPosition.value + index + 1,
          content.type,
          titleForCard(content),
          JSON.stringify(content),
          now,
          now,
        )
      })

      return ids
    })

    const ids = save()
    this.localWrites += 1
    return ids.map((id) => this.getCard(id) as StoredCard)
  }

  getCard(id: string): StoredCard | null {
    const row = this.db.prepare(`${CARD_SELECT} WHERE c.id = ?`).get(id) as JoinedCardRow | undefined
    return row ? mapCard(row) : null
  }

  listCards(filter: CardFilter = {}): StoredCard[] {
    const where: string[] = []
    const params: string[] = []
    if (filter.universe) {
      where.push('u.slug = ?')
      params.push(slugify(filter.universe))
    }
    if (filter.part) {
      where.push('p.slug = ?')
      params.push(slugify(filter.part))
    }
    const condition = where.length ? ` WHERE ${where.join(' AND ')}` : ''
    const rows = this.db
      .prepare(`${CARD_SELECT}${condition} ORDER BY u.name, COALESCE(p.number, 2147483647), p.name, c.position`)
      .all(...params) as JoinedCardRow[]
    return rows.map(mapCard)
  }

  listLibrary(filter: CardFilter = {}): CardLibrary {
    const universes = new Map<string, CardLibrary[number]>()
    for (const card of this.listCards(filter)) {
      let universe = universes.get(card.universe.id)
      if (!universe) {
        universe = { ...card.universe, parts: [] }
        universes.set(card.universe.id, universe)
      }
      let part = universe.parts.find(({ id }) => id === card.part.id)
      if (!part) {
        part = { ...card.part, cards: [] }
        universe.parts.push(part)
      }
      part.cards.push(card)
    }
    return [...universes.values()]
  }

  updateCard(id: string, rawContent: CardContent): StoredCard | null {
    const content = CardContentSchema.parse(rawContent)
    const result = this.db
      .prepare(`
        UPDATE cards
        SET type = ?, title = ?, data_json = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(content.type, titleForCard(content), JSON.stringify(content), new Date().toISOString(), id)
    if (!result.changes) return null
    this.localWrites += 1
    return this.getCard(id)
  }

  deleteCards(ids: string[]): number {
    const placeholders = ids.map(() => '?').join(', ')
    const deleted = this.db.prepare(`DELETE FROM cards WHERE id IN (${placeholders})`).run(...ids).changes
    if (deleted) this.localWrites += 1
    return deleted
  }

  // Reagrupa cartas ya guardadas en otra seccion, creandola si hace falta. Es lo
  // que permite dividir una parte grande en varias sin borrar y recrear: las
  // cartas conservan su id, su contenido y su fecha de creacion.
  moveCards(cardIds: string[], target: MoveCardsTarget): StoredCard[] {
    const move = this.db.transaction(() => {
      const cards = cardIds
        .map((id) => this.getCard(id))
        .filter((card): card is StoredCard => card !== null)
      if (!cards.length) throw new Error('No existe ninguna de las cartas indicadas.')

      const now = new Date().toISOString()
      // Sin universo explicito se queda donde ya estaba la primera carta.
      const universe = target.universe ?? { name: cards[0].universe.name }
      const part = this.resolvePart(universe, target.part, now)

      // Las cartas salen de en medio antes de reubicarse: si alguna ya estaba en
      // la parte destino, su posicion actual chocaria con UNIQUE al reasignarlas.
      const park = this.db.prepare('UPDATE cards SET position = position + 1000000 WHERE id = ?')
      for (const card of cards) park.run(card.id)

      const maxPosition = this.db
        .prepare('SELECT COALESCE(MAX(position), 0) AS value FROM cards WHERE part_id = ? AND position < 1000000')
        .get(part.id) as { value: number }
      const update = this.db.prepare(
        'UPDATE cards SET part_id = ?, position = ?, updated_at = ? WHERE id = ?',
      )
      cards.forEach((card, index) => update.run(part.id, maxPosition.value + index + 1, now, card.id))

      return cards.map(({ id }) => id)
    })

    const moved = move()
    this.localWrites += 1
    return moved.map((id) => this.getCard(id) as StoredCard)
  }

  // Renombra o renumera una seccion. El slug acompaña al nombre para que el MCP
  // siga encontrandola por su nombre nuevo.
  renamePart(partId: string, patch: { name?: string; number?: number | null }): PartRow {
    const part = this.db.prepare('SELECT * FROM parts WHERE id = ?').get(partId) as PartRow | undefined
    if (!part) throw new Error('No existe la seccion indicada.')

    const name = patch.name?.trim() || part.name
    const slug = slugify(name)
    const clash = this.db
      .prepare('SELECT id FROM parts WHERE universe_id = ? AND slug = ? AND id != ?')
      .get(part.universe_id, slug, partId)
    if (clash) throw new Error(`Ya existe otra seccion llamada "${name}" en este universo.`)

    this.db
      .prepare('UPDATE parts SET name = ?, slug = ?, number = ?, updated_at = ? WHERE id = ?')
      .run(name, slug, patch.number === undefined ? part.number : patch.number, new Date().toISOString(), partId)
    this.localWrites += 1
    return this.db.prepare('SELECT * FROM parts WHERE id = ?').get(partId) as PartRow
  }

  // Reordena una parte completa. Las posiciones se desplazan primero fuera de
  // rango porque UNIQUE (part_id, position) rechaza los estados intermedios de
  // una permutacion. Las cartas de la parte que no vengan en la lista se
  // conservan al final, en su orden actual.
  reorderPart(partId: string, orderedIds: string[]): StoredCard[] {
    const reorder = this.db.transaction(() => {
      const current = this.db
        .prepare('SELECT id FROM cards WHERE part_id = ? ORDER BY position')
        .all(partId) as Array<{ id: string }>
      const known = new Set(current.map(({ id }) => id))
      const requested = orderedIds.filter((id) => known.has(id))
      const final = [...requested, ...current.map(({ id }) => id).filter((id) => !requested.includes(id))]

      this.db.prepare('UPDATE cards SET position = position + 1000000 WHERE part_id = ?').run(partId)
      const update = this.db.prepare('UPDATE cards SET position = ?, updated_at = ? WHERE id = ?')
      const now = new Date().toISOString()
      final.forEach((id, index) => update.run(index + 1, now, id))
      return final.length
    })

    if (!reorder()) return []
    this.localWrites += 1
    return this.listCards().filter((card) => card.part.id === partId)
  }

  // ---- Proyectos (universos) ----

  // Todos los proyectos, incluidos los que aun no tienen ninguna carta: el
  // editor necesita poder abrir uno recien creado y vacio.
  listProjects(): Project[] {
    const rows = this.db
      .prepare(`
        SELECT u.id, u.slug, u.name, u.description,
          (SELECT COUNT(*) FROM parts p JOIN cards c ON c.part_id = p.id WHERE p.universe_id = u.id) AS card_count,
          (SELECT COUNT(*) FROM imported_images i WHERE i.universe_id = u.id) AS image_count
        FROM universes u
        ORDER BY u.name COLLATE NOCASE
      `)
      .all() as Array<UniverseRow & { card_count: number; image_count: number }>
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      cardCount: row.card_count,
      imageCount: row.image_count,
    }))
  }

  createProject(rawName: string): Project {
    // El nombre se valida antes de pasar por slugify: ese helper nunca devuelve
    // vacio (cae en 'sin-nombre'), asi que un nombre en blanco crearia un
    // proyecto sin titulo visible en vez de fallar.
    const name = rawName.trim()
    if (!name) throw new Error('El proyecto necesita un nombre.')
    const slug = slugify(name)
    const existing = this.db.prepare('SELECT id FROM universes WHERE slug = ?').get(slug)
    if (existing) throw new Error(`Ya existe un proyecto llamado "${name}".`)

    const now = new Date().toISOString()
    this.db
      .prepare(`
        INSERT INTO universes (id, slug, name, description, created_at, updated_at)
        VALUES (?, ?, ?, '', ?, ?)
      `)
      .run(randomUUID(), slug, name, now, now)
    this.localWrites += 1
    return this.listProjects().find((project) => project.slug === slug) as Project
  }

  // ---- Imagenes importadas ----

  listImages(universeId?: string): ImportedImage[] {
    const rows = universeId
      ? this.db
          .prepare('SELECT * FROM imported_images WHERE universe_id = ? ORDER BY position')
          .all(universeId)
      : this.db.prepare('SELECT * FROM imported_images ORDER BY universe_id, position').all()
    return (rows as ImportedImageRow[]).map(mapImage)
  }

  addImages(universeId: string, images: Array<{ url: string; name: string }>): ImportedImage[] {
    if (!images.length) return []
    const universe = this.db.prepare('SELECT id FROM universes WHERE id = ?').get(universeId)
    if (!universe) throw new Error('El proyecto indicado no existe.')

    const now = new Date().toISOString()
    const insert = this.db.transaction(() => {
      const max = this.db
        .prepare('SELECT COALESCE(MAX(position), 0) AS value FROM imported_images WHERE universe_id = ?')
        .get(universeId) as { value: number }
      const statement = this.db.prepare(`
        INSERT INTO imported_images (id, universe_id, position, url, name, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      images.forEach((image, index) => {
        statement.run(randomUUID(), universeId, max.value + index + 1, image.url, image.name, now)
      })
    })

    insert()
    this.localWrites += 1
    return this.listImages(universeId)
  }

  deleteImage(id: string): boolean {
    const deleted = this.db.prepare('DELETE FROM imported_images WHERE id = ?').run(id).changes > 0
    if (deleted) this.localWrites += 1
    return deleted
  }

  // Reordena dentro de un proyecto. Igual que reorderPart, las posiciones se
  // apartan primero sumando un salto grande: no pueden negarse porque la tabla
  // exige position > 0, y sin apartarlas chocarian con el UNIQUE al vuelo.
  reorderImages(universeId: string, orderedIds: string[]): ImportedImage[] {
    const reorder = this.db.transaction(() => {
      const current = this.db
        .prepare('SELECT id FROM imported_images WHERE universe_id = ? ORDER BY position')
        .all(universeId) as Array<{ id: string }>
      const known = new Set(current.map((row) => row.id))
      const final = [
        ...orderedIds.filter((id) => known.has(id)),
        ...current.map((row) => row.id).filter((id) => !orderedIds.includes(id)),
      ]
      if (!final.length) return false

      const free = this.db.prepare(
        'UPDATE imported_images SET position = position + 1000000 WHERE universe_id = ?',
      )
      const place = this.db.prepare('UPDATE imported_images SET position = ? WHERE id = ?')
      free.run(universeId)
      final.forEach((id, index) => place.run(index + 1, id))
      return true
    })

    if (!reorder()) return []
    this.localWrites += 1
    return this.listImages(universeId)
  }

  private migrate(): void {
    const version = this.db.pragma('user_version', { simple: true }) as number
    if (version > 6) throw new Error(`La version ${version} de cards.db no es compatible.`)
    if (version === 6) return

    if (version === 5) {
      this.db.exec(`
        ${IMPORTED_IMAGES_SCHEMA}
        PRAGMA user_version = 6;
      `)
      return
    }

    if (version === 1 || version === 2) {
      this.db.exec(`
        DROP INDEX cards_part_id_idx;
        ALTER TABLE cards RENAME TO cards_previous;

        CREATE TABLE cards (
          id TEXT PRIMARY KEY,
          part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
          position INTEGER NOT NULL CHECK (position > 0),
          type TEXT NOT NULL CHECK (type IN (
            'Character', 'Artifact', 'Cover', 'Full Image Cover', 'Tier',
            'Tier Explanation', 'General Explanation'
          )),
          title TEXT NOT NULL,
          data_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (part_id, position)
        );

        INSERT INTO cards (id, part_id, position, type, title, data_json, created_at, updated_at)
        SELECT id, part_id, position, type, title, data_json, created_at, updated_at
        FROM cards_previous;

        DROP TABLE cards_previous;
        CREATE INDEX cards_part_id_idx ON cards(part_id);
        PRAGMA user_version = 3;
      `)
      this.migrate()
      return
    }

    if (version === 3) {
      this.db.exec(`
        DROP INDEX cards_part_id_idx;
        ALTER TABLE cards RENAME TO cards_previous;

        CREATE TABLE cards (
          id TEXT PRIMARY KEY,
          part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
          position INTEGER NOT NULL CHECK (position > 0),
          type TEXT NOT NULL CHECK (type IN (
            'Character', 'Artifact', 'Cover', 'Full Image Cover', 'Tier', 'Pathway',
            'Tier Explanation', 'General Explanation'
          )),
          title TEXT NOT NULL,
          data_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (part_id, position)
        );

        INSERT INTO cards (id, part_id, position, type, title, data_json, created_at, updated_at)
        SELECT id, part_id, position, type, title, data_json, created_at, updated_at
        FROM cards_previous;

        DROP TABLE cards_previous;
        CREATE INDEX cards_part_id_idx ON cards(part_id);
        PRAGMA user_version = 4;
      `)
      this.migrate()
      return
    }

    if (version === 4) {
      this.db.exec(`
        DROP INDEX cards_part_id_idx;
        ALTER TABLE cards RENAME TO cards_previous;

        CREATE TABLE cards (
          id TEXT PRIMARY KEY,
          part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
          position INTEGER NOT NULL CHECK (position > 0),
          type TEXT NOT NULL CHECK (type IN (
            'Character', 'Artifact', 'Cover', 'Full Image Cover', 'Tier', 'Pathway',
            'Tier Explanation', 'General Explanation', 'Pathway Explanation', 'Breakdown', 'Map'
          )),
          title TEXT NOT NULL,
          data_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (part_id, position)
        );

        INSERT INTO cards (id, part_id, position, type, title, data_json, created_at, updated_at)
        SELECT id, part_id, position, type, title, data_json, created_at, updated_at
        FROM cards_previous;

        DROP TABLE cards_previous;
        CREATE INDEX cards_part_id_idx ON cards(part_id);
        PRAGMA user_version = 5;
      `)
      this.migrate()
      return
    }

    this.db.exec(`
      CREATE TABLE universes (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE parts (
        id TEXT PRIMARY KEY,
        universe_id TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
        slug TEXT NOT NULL COLLATE NOCASE,
        name TEXT NOT NULL,
        number INTEGER,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (universe_id, slug)
      );

      CREATE TABLE cards (
        id TEXT PRIMARY KEY,
        part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
        position INTEGER NOT NULL CHECK (position > 0),
        type TEXT NOT NULL CHECK (type IN (
          'Character', 'Artifact', 'Cover', 'Full Image Cover', 'Tier', 'Pathway',
          'Tier Explanation', 'General Explanation', 'Pathway Explanation', 'Breakdown', 'Map'
        )),
        title TEXT NOT NULL,
        data_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (part_id, position)
      );

      CREATE INDEX cards_part_id_idx ON cards(part_id);
      CREATE INDEX parts_universe_id_idx ON parts(universe_id);
      ${IMPORTED_IMAGES_SCHEMA}
      PRAGMA user_version = 6;
    `)
  }
}

// Imagenes que se importan tal cual, sin convertirse en carta: no se editan,
// solo se ordenan y se exportan. Cuelgan del universo (el "proyecto") y no de
// una parte, porque no participan en la numeracion de las cartas.
function mapImage(row: ImportedImageRow): ImportedImage {
  return {
    id: row.id,
    universeId: row.universe_id,
    position: row.position,
    url: row.url,
    name: row.name,
    createdAt: row.created_at,
  }
}

const IMPORTED_IMAGES_SCHEMA = `
  CREATE TABLE imported_images (
    id TEXT PRIMARY KEY,
    universe_id TEXT NOT NULL REFERENCES universes(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position > 0),
    url TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (universe_id, position)
  );
  CREATE INDEX imported_images_universe_id_idx ON imported_images(universe_id);
`

const CARD_SELECT = `
  SELECT
    c.id, c.position, c.type, c.title, c.data_json, c.created_at, c.updated_at,
    u.id AS universe_id, u.slug AS universe_slug, u.name AS universe_name,
    u.description AS universe_description,
    p.id AS part_id, p.slug AS part_slug, p.name AS part_name,
    p.number AS part_number, p.description AS part_description
  FROM cards c
  JOIN parts p ON p.id = c.part_id
  JOIN universes u ON u.id = p.universe_id
`

function mapCard(row: JoinedCardRow): StoredCard {
  return {
    id: row.id,
    position: row.position,
    type: row.type,
    title: row.title,
    content: CardContentSchema.parse(JSON.parse(row.data_json)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    universe: {
      id: row.universe_id,
      slug: row.universe_slug,
      name: row.universe_name,
      description: row.universe_description,
    },
    part: {
      id: row.part_id,
      slug: row.part_slug,
      name: row.part_name,
      number: row.part_number,
      description: row.part_description,
    },
  }
}
