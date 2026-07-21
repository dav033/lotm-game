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

  saveBatch(rawInput: SaveCardBatchInput): StoredCard[] {
    const input = SaveCardBatchSchema.parse(rawInput)
    const save = this.db.transaction(() => {
      const now = new Date().toISOString()
      const universeSlug = slugify(input.universe.name)
      const universeId = randomUUID()

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
          id: universeId,
          slug: universeSlug,
          name: input.universe.name,
          description: input.universe.description ?? '',
          hasDescription: input.universe.description === undefined ? 0 : 1,
          now,
        })

      const universe = this.db
        .prepare('SELECT * FROM universes WHERE slug = ?')
        .get(universeSlug) as UniverseRow
      const partSlug = slugify(input.part.name)

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
          universeId: universe.id,
          slug: partSlug,
          name: input.part.name,
          number: input.part.number ?? null,
          hasNumber: input.part.number === undefined ? 0 : 1,
          description: input.part.description ?? '',
          hasDescription: input.part.description === undefined ? 0 : 1,
          now,
        })

      const part = this.db
        .prepare('SELECT * FROM parts WHERE universe_id = ? AND slug = ?')
        .get(universe.id, partSlug) as PartRow
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

    return save().map((id) => this.getCard(id) as StoredCard)
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
    return result.changes ? this.getCard(id) : null
  }

  deleteCards(ids: string[]): number {
    const placeholders = ids.map(() => '?').join(', ')
    return this.db.prepare(`DELETE FROM cards WHERE id IN (${placeholders})`).run(...ids).changes
  }

  private migrate(): void {
    const version = this.db.pragma('user_version', { simple: true }) as number
    if (version > 3) throw new Error(`La version ${version} de cards.db no es compatible.`)
    if (version === 3) return

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
          'Character', 'Artifact', 'Cover', 'Full Image Cover', 'Tier',
          'Tier Explanation', 'General Explanation'
        )),
        title TEXT NOT NULL,
        data_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (part_id, position)
      );

      CREATE INDEX cards_part_id_idx ON cards(part_id);
      CREATE INDEX parts_universe_id_idx ON parts(universe_id);
      PRAGMA user_version = 3;
    `)
  }
}

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
