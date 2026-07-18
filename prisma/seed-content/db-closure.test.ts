// Pasada B de las auditorías requeridas: aplica las migraciones y el seed a
// una base SQLite temporal, carga el grafo con Prisma y corre el mismo
// simulador puro que las pruebas estáticas. Verifica que el cierre calculado
// desde una base real coincide exactamente con PHASE3_CLOSURE_SLUGS, y que
// sembrar dos veces es idempotente (mismos recuentos de filas gestionadas).
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../../src/generated/prisma/client'
import { PHASE3_CLOSURE_SLUGS } from './progression'
import { simulateProgression, type SimInput } from './progression-simulator'

const repoRoot = process.cwd()
const managedTables = [
  'Element',
  'Recipe',
  'RecipeIngredient',
  'RecipeOutput',
  'Advance',
  'AdvanceIngredient',
  'Ritual',
  'ElementUnlockRequirement',
  'ElementUnlockTrigger',
  'Sequence',
]

describe('cierre respaldado por base de datos (pasada B)', { timeout: 120_000 }, () => {
  let dir: string
  let dbPath: string
  let databaseUrl: string

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'lotm-progression-'))
    dbPath = join(dir, 'test.db')
    databaseUrl = `file:${dbPath}`
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: repoRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
      shell: process.platform === 'win32',
    })
  })

  after(() => {
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  })

  async function seed() {
    execFileSync('npx', ['tsx', 'prisma/seed.ts'], {
      cwd: repoRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
      shell: process.platform === 'win32',
    })
  }

  async function loadGraphAndCounts() {
    const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
    try {
      const [elements, recipes, advances, sequences, rituals] = await Promise.all([
        prisma.element.findMany({
          select: {
            slug: true,
            type: true,
            isStarter: true,
            isActive: true,
            unlockedByType: true,
            unlockedBySequenceNumber: true,
          },
        }),
        prisma.recipe.findMany({
          select: {
            isActive: true,
            ingredients: { select: { element: { select: { slug: true } }, quantity: true } },
            outputs: { select: { element: { select: { slug: true } } } },
          },
        }),
        prisma.advance.findMany({
          select: {
            internalName: true,
            ingredients: { select: { element: { select: { slug: true } } } },
            sourceSequence: { select: { element: { select: { slug: true } } } },
            targetSequence: { select: { element: { select: { slug: true } } } },
          },
        }),
        prisma.sequence.findMany({ select: { number: true, element: { select: { slug: true } } } }),
        prisma.ritual.findMany({
          select: {
            requiredSequenceNumber: true,
            ingredients: { select: { element: { select: { slug: true } } } },
            advance: { select: { internalName: true } },
          },
        }),
      ])
      const [triggers, requirements] = await Promise.all([
        prisma.elementUnlockTrigger.findMany({
          select: { element: { select: { slug: true } }, trigger: { select: { slug: true } } },
        }),
        prisma.elementUnlockRequirement.findMany({
          select: { element: { select: { slug: true } }, required: { select: { slug: true } } },
        }),
      ])

      const triggerMap: Record<string, string[]> = {}
      for (const t of triggers) (triggerMap[t.element.slug] ??= []).push(t.trigger.slug)
      const reqMap: Record<string, string[]> = {}
      for (const r of requirements) (reqMap[r.element.slug] ??= []).push(r.required.slug)

      const input: SimInput = {
        elements: elements.map((e) => ({
          slug: e.slug,
          type: e.type,
          isStarter: e.isStarter,
          isActive: e.isActive,
          unlockedByType: e.unlockedByType,
          unlockedBySequenceNumber: e.unlockedBySequenceNumber,
        })),
        recipes: recipes.map((r) => ({
          ings: r.ingredients.map((i) => [i.element.slug, i.quantity] as [string, number]),
          outputs: r.outputs.map((o) => o.element.slug),
          isActive: r.isActive,
        })),
        advances: advances.map((a) => ({
          internalName: a.internalName,
          ingredients: a.ingredients.map((i) => i.element.slug),
          source: a.sourceSequence.element.slug,
          target: a.targetSequence.element.slug,
        })),
        sequences: sequences.map((s) => ({ slug: s.element.slug, number: s.number })),
        rituals: rituals.map((r) => ({
          advanceName: r.advance.internalName,
          ingredients: r.ingredients.map((i) => i.element.slug),
          requiredSequenceNumber: r.requiredSequenceNumber,
        })),
        triggers: triggerMap,
        andRequirements: reqMap,
      }

      const counts: Record<string, number> = {}
      for (const table of managedTables) {
        counts[table] = await (prisma as unknown as Record<string, { count: () => Promise<number> }>)[
          table.charAt(0).toLowerCase() + table.slice(1)
        ].count()
      }

      return { input, counts }
    } finally {
      await prisma.$disconnect()
    }
  }

  it('el cierre calculado desde una base recién sembrada coincide exactamente con PHASE3_CLOSURE_SLUGS', async () => {
    await seed()
    const { input } = await loadGraphAndCounts()
    const result = simulateProgression(input)
    const expected = new Set<string>(PHASE3_CLOSURE_SLUGS)

    const missing = PHASE3_CLOSURE_SLUGS.filter((slug) => !result.discovered.has(slug))
    const extra = [...result.discovered].filter((slug) => !expected.has(slug))

    assert.deepEqual(missing, [], `Elementos esperados y no alcanzados: ${missing.join(', ')}`)
    assert.deepEqual(extra, [], `Elementos alcanzados fuera del cierre esperado: ${extra.join(', ')}`)
    assert.equal(result.discovered.size, PHASE3_CLOSURE_SLUGS.length)
  })

  it('sembrar dos veces es idempotente: los recuentos de filas gestionadas no cambian', async () => {
    const before = (await loadGraphAndCounts()).counts
    await seed()
    const after = (await loadGraphAndCounts()).counts
    assert.deepEqual(after, before)
  })
})
