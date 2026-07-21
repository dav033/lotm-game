// Pasada B de las auditorías requeridas: aplica las migraciones y el seed a
// una base SQLite temporal, carga el grafo con Prisma y corre el mismo
// simulador puro que las pruebas estáticas. Verifica que el cierre calculado
// desde una base real coincide con los cierres autoritativos de Fase 1 y 2,
// y que sembrar dos veces es idempotente (mismos recuentos de filas gestionadas).
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../../src/generated/prisma/client'
import { buildRecipeInputKey } from '../../src/server/domain/inputKey'
import { combinarParaPerfil } from '../../src/server/domain/combinar'
import { cargarAnalisisProgresion } from '../../src/server/services/progresion'
import { completarFaseActual } from '../../src/server/services/completarFase'
import { eliminarRecetasCompletamente } from '../../src/server/services/recetas'
import { PHASE_2_AVAILABLE_SLUGS } from './phases'
import { PHASE1_CLOSURE_SLUGS } from './progression'
import { simulateProgression, type SimInput } from './progression-simulator'
import { createRuntimeReplayProfile, replayRuntimeProgression } from './runtime-progression-replay'

const repoRoot = process.cwd()
const managedTables = [
  'Element',
  'ProgressionPhase',
  'Recipe',
  'RecipeIngredient',
  'RecipeOutput',
  'Advance',
  'AdvanceIngredient',
  'Ritual',
  'RitualIngredient',
  'RitualFailureOutput',
  'Category',
  'Pathway',
  'ElementCategory',
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
      const [elements, recipes, advances, sequences, rituals, phases] = await Promise.all([
        prisma.element.findMany({
          select: {
            slug: true,
            type: true,
            isStarter: true,
            isActive: true,
            unlockedByType: true,
            unlockedBySequenceNumber: true,
            unlockedAtDiscoveryCount: true,
            availableFromPhaseId: true,
            availableFromPhase: { select: { sortOrder: true, isActive: true } },
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
            isActive: true,
            ingredients: { select: { element: { select: { slug: true } }, quantity: true } },
            sourceSequence: { select: { element: { select: { slug: true } } } },
            targetSequence: { select: { element: { select: { slug: true } } } },
          },
        }),
        prisma.sequence.findMany({
          select: {
            number: true,
            element: { select: { slug: true } },
            pathway: { select: { slug: true, isActive: true } },
          },
        }),
        prisma.ritual.findMany({
          select: {
            name: true,
            isActive: true,
            requiredSequenceNumber: true,
            ingredients: { select: { element: { select: { slug: true } } } },
            failureOutputs: { select: { element: { select: { slug: true } } } },
            advance: { select: { internalName: true } },
          },
        }),
        prisma.progressionPhase.findMany({
          select: { sortOrder: true, unlockAtDiscoveryCount: true, isActive: true },
          orderBy: { sortOrder: 'asc' },
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
          unlockedAtDiscoveryCount: e.unlockedAtDiscoveryCount,
          availableFromPhaseOrder: e.availableFromPhase?.sortOrder ?? null,
          availableFromPhaseIsActive: e.availableFromPhase?.isActive,
        })),
        recipes: recipes.map((r) => ({
          ings: r.ingredients.map((i) => [i.element.slug, i.quantity] as [string, number]),
          outputs: r.outputs.map((o) => o.element.slug),
          isActive: r.isActive,
        })),
        advances: advances.map((a) => ({
          internalName: a.internalName,
          ingredients: a.ingredients.map((i) => [i.element.slug, i.quantity] as [string, number]),
          source: a.sourceSequence.element.slug,
          target: a.targetSequence.element.slug,
          isActive: a.isActive,
        })),
        sequences: sequences.map((s) => ({
          slug: s.element.slug,
          number: s.number,
          pathwaySlug: s.pathway.slug,
          pathwayIsActive: s.pathway.isActive,
        })),
        rituals: rituals.map((r) => ({
          name: r.name,
          advanceName: r.advance.internalName,
          ingredients: r.ingredients.map((i) => i.element.slug),
          requiredSequenceNumber: r.requiredSequenceNumber,
          isActive: r.isActive,
          failureOutputs: r.failureOutputs.map((output) => output.element.slug),
        })),
        triggers: triggerMap,
        andRequirements: reqMap,
        phases,
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

  async function loadManagedSnapshot() {
    const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
    try {
      const [elements, categories, pathways, recipes, sequences, advances, rituals] = await Promise.all([
        prisma.element.findMany({
          select: {
            id: true,
            slug: true,
            name: true,
            type: true,
            tier: true,
            isStarter: true,
            isActive: true,
            unlockedByType: true,
            unlockedBySequenceNumber: true,
            unlockedAtDiscoveryCount: true,
            availableFromPhaseId: true,
            unlockTriggers: { select: { trigger: { select: { slug: true } } } },
            unlockRequirements: { select: { required: { select: { slug: true } } } },
            categories: { select: { isPrimary: true, category: { select: { slug: true } } } },
          },
        }),
        prisma.category.findMany({
          select: { id: true, slug: true, name: true, parentId: true, sortOrder: true, isHidden: true, isActive: true },
        }),
        prisma.pathway.findMany({
          select: { id: true, slug: true, name: true, categoryId: true, isHiddenUntilDiscovered: true, isActive: true },
        }),
        prisma.recipe.findMany({
          select: {
            id: true,
            inputKey: true,
            isActive: true,
            minimumDiscoveries: true,
            ingredients: { select: { quantity: true, element: { select: { slug: true } } } },
            outputs: { select: { quantity: true, chance: true, sortOrder: true, element: { select: { slug: true } } } },
          },
        }),
        prisma.sequence.findMany({
          select: { id: true, number: true, name: true, description: true, element: { select: { slug: true } }, pathway: { select: { slug: true } } },
        }),
        prisma.advance.findMany({
          select: {
            id: true,
            internalName: true,
            inputKey: true,
            isActive: true,
            sourceSequence: { select: { element: { select: { slug: true } } } },
            targetSequence: { select: { element: { select: { slug: true } } } },
            ingredients: { select: { quantity: true, element: { select: { slug: true } } } },
          },
        }),
        prisma.ritual.findMany({
          select: {
            id: true,
            name: true,
            inputKey: true,
            requiredSequenceNumber: true,
            isActive: true,
            advance: { select: { internalName: true } },
            ingredients: { select: { quantity: true, element: { select: { slug: true } } } },
            failureOutputs: { select: { element: { select: { slug: true } } } },
          },
        }),
      ])
      const by = <T>(values: T[], key: (value: T) => string) => values.sort((a, b) => key(a).localeCompare(key(b)))
      return {
        elements: by(elements, (element) => element.slug).map((element) => ({
          ...element,
          unlockTriggers: element.unlockTriggers.map((item) => item.trigger.slug).sort(),
          unlockRequirements: element.unlockRequirements.map((item) => item.required.slug).sort(),
          categories: element.categories
            .map((item) => `${item.category.slug}:${item.isPrimary}`)
            .sort(),
        })),
        categories: by(categories, (category) => category.slug),
        pathways: by(pathways, (pathway) => pathway.slug),
        recipes: by(recipes, (recipe) => recipe.inputKey).map((recipe) => ({
          ...recipe,
          ingredients: recipe.ingredients
            .map((item) => `${item.element.slug}*${item.quantity}`)
            .sort(),
          outputs: recipe.outputs
            .map((item) => `${item.sortOrder}:${item.element.slug}*${item.quantity}@${item.chance}`)
            .sort(),
        })),
        sequences: by(sequences, (sequence) => sequence.element.slug),
        advances: by(advances, (advance) => advance.inputKey).map((advance) => ({
          ...advance,
          ingredients: advance.ingredients
            .map((item) => `${item.element.slug}*${item.quantity}`)
            .sort(),
        })),
        rituals: by(rituals, (ritual) => ritual.inputKey).map((ritual) => ({
          ...ritual,
          ingredients: ritual.ingredients
            .map((item) => `${item.element.slug}*${item.quantity}`)
            .sort(),
          failureOutputs: ritual.failureOutputs.map((item) => item.element.slug).sort(),
        })),
      }
    } finally {
      await prisma.$disconnect()
    }
  }

  it('el cierre calculado desde una base recién sembrada coincide con la Fase 2 de 56 elementos', async () => {
    await seed()
    const { input } = await loadGraphAndCounts()
    const result = simulateProgression(input)
    const expected = new Set<string>(PHASE_2_AVAILABLE_SLUGS)

    const missing = PHASE_2_AVAILABLE_SLUGS.filter((slug) => !result.discovered.has(slug))
    const extra = [...result.discovered].filter((slug) => !expected.has(slug))

    assert.deepEqual(missing, [], `Elementos esperados y no alcanzados: ${missing.join(', ')}`)
    assert.deepEqual(extra, [], `Elementos alcanzados fuera del cierre esperado: ${extra.join(', ')}`)
    assert.equal(result.discovered.size, PHASE_2_AVAILABLE_SLUGS.length)
    assert.equal(result.discovered.has('tiempo'), false, 'Tiempo está prohibido')
    assert.equal(result.discovered.has('edad'), false, 'Edad es la frontera bloqueada')
  })

  it('el cierre de Fase 1 leído desde la base coincide con el pool orgánico', async () => {
    const { input } = await loadGraphAndCounts()
    input.phases = input.phases?.map((phase) =>
      phase.sortOrder === 1
        ? phase
        : { ...phase, unlockAtDiscoveryCount: Number.MAX_SAFE_INTEGER },
    )
    const result = simulateProgression(input)
    const expected = new Set<string>(PHASE1_CLOSURE_SLUGS)

    const missing = PHASE1_CLOSURE_SLUGS.filter((slug) => !result.discovered.has(slug))
    const extra = [...result.discovered].filter((slug) => !expected.has(slug))

    assert.deepEqual(missing, [], `Elementos del cierre no alcanzados: ${missing.join(', ')}`)
    assert.deepEqual(extra, [], `Elementos fuera de la Fase 1: ${extra.join(', ')}`)
    assert.equal(result.discovered.size, PHASE1_CLOSURE_SLUGS.length)
  })

  it('la base sembrada no contiene claves, salidas ni nombres normalizados duplicados', async () => {
    const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
    try {
      const [recipes, outputs, elements] = await Promise.all([
        prisma.recipe.findMany({ select: { inputKey: true } }),
        prisma.recipeOutput.findMany({ select: { recipeId: true, elementId: true } }),
        prisma.element.findMany({ select: { slug: true, name: true } }),
      ])
      assert.equal(new Set(recipes.map((recipe) => recipe.inputKey)).size, recipes.length)
      assert.equal(
        new Set(outputs.map((output) => `${output.recipeId}:${output.elementId}`)).size,
        outputs.length,
      )
      const normalizedNames = elements.map((element) =>
        element.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase(),
      )
      assert.equal(new Set(normalizedNames).size, normalizedNames.length)
      assert.equal(elements.filter((element) => element.slug === 'percepcion-espiritual').length, 1)
      assert.equal(elements.some((element) => element.slug === 'persepcion-espiritual'), false)
    } finally {
      await prisma.$disconnect()
    }
  })

  it('todas las recetas sembradas tienen el campo legacy normalizado a cero', async () => {
    const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
    try {
      assert.equal(await prisma.recipe.count({ where: { minimumDiscoveries: { not: 0 } } }), 0)
    } finally {
      await prisma.$disconnect()
    }
  })

  it('mantiene íntegras las fórmulas y sus cascadas de eliminación', async () => {
    const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
    try {
      const recipes = await prisma.recipe.findMany({
        include: {
          ingredients: { include: { element: { select: { slug: true } } } },
          outputs: true,
        },
      })
      for (const recipe of recipes) {
        assert.equal(
          recipe.ingredients.reduce((total, ingredient) => total + ingredient.quantity, 0),
          2,
          `${recipe.inputKey} debe tener exactamente dos unidades`,
        )
        assert.ok(recipe.outputs.length > 0, `${recipe.inputKey} debe tener resultados`)
        assert.equal(
          recipe.inputKey,
          buildRecipeInputKey(
            recipe.ingredients.map((ingredient) => ({
              slug: ingredient.element.slug,
              quantity: ingredient.quantity,
            })),
          ),
        )
      }

      const profile = await prisma.playerProfile.create({ data: {} })
      const [ojo, tierra, humano, apuesta] = await Promise.all([
        prisma.element.findUniqueOrThrow({ where: { slug: 'ojo' } }),
        prisma.element.findUniqueOrThrow({ where: { slug: 'tierra' } }),
        prisma.element.findUniqueOrThrow({ where: { slug: 'humano' } }),
        prisma.element.findUniqueOrThrow({ where: { slug: 'apuesta' } }),
      ])
      await assert.rejects(prisma.element.delete({ where: { id: apuesta.id } }))

      const temporary = await prisma.recipe.create({
        data: {
          inputKey: 'integrity-test-only',
          ingredients: {
            create: [
              { elementId: ojo.id, quantity: 1 },
              { elementId: tierra.id, quantity: 1 },
            ],
          },
          outputs: { create: { elementId: humano.id } },
          stats: {
            create: {
              profileId: profile.id,
              inputKey: 'integrity-test-only',
              attempts: 1,
              successes: 1,
            },
          },
        },
        include: { ingredients: true, outputs: true },
      })
      await prisma.recipe.delete({ where: { id: temporary.id } })
      assert.equal(await prisma.recipeIngredient.count({ where: { recipeId: temporary.id } }), 0)
      assert.equal(await prisma.recipeOutput.count({ where: { recipeId: temporary.id } }), 0)
      const stat = await prisma.playerCombinationStat.findUniqueOrThrow({
        where: {
          profileId_inputKey: { profileId: profile.id, inputKey: 'integrity-test-only' },
        },
      })
      assert.equal(stat.recipeId, null)
      await prisma.playerCombinationStat.delete({
        where: {
          profileId_inputKey: { profileId: profile.id, inputKey: 'integrity-test-only' },
        },
      })
      await prisma.playerProfile.delete({ where: { id: profile.id } })
    } finally {
      await prisma.$disconnect()
    }
  })

  it('el resolvedor runtime reproduce exactamente el cierre de Fase 2', async () => {
    const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
    try {
      const profileId = await createRuntimeReplayProfile(prisma)
      const initialSlugs = (
        await prisma.playerDiscovery.findMany({
          where: { profileId },
          select: { element: { select: { slug: true } } },
        })
      ).map((discovery) => discovery.element.slug).sort()
      assert.deepEqual(initialSlugs, ['humano', 'moneda', 'ojo', 'tierra'])
      const { input } = await loadGraphAndCounts()
      const runtime = await replayRuntimeProgression(prisma, profileId)
      const simulated = simulateProgression(input)
      assert.deepEqual([...runtime.elements].sort(), [...PHASE_2_AVAILABLE_SLUGS].sort())
      assert.deepEqual([...runtime.elements].sort(), [...simulated.discovered].sort())
      assert.deepEqual([...runtime.pathways].sort(), [...simulated.discoveredPathwaySlugs].sort())
      assert.deepEqual([...runtime.sequences].sort(), [...simulated.discoveredSequenceSlugs].sort())
      assert.deepEqual([...runtime.preparedAdvances].sort(), [...simulated.preparedAdvances].sort())
      assert.deepEqual([...runtime.rituals].sort(), [...simulated.preparedRituals].sort())

      const diagnostics = await cargarAnalisisProgresion(prisma)
      assert.deepEqual(
        [...simulateProgression(diagnostics.simInput).discovered].sort(),
        [...PHASE_2_AVAILABLE_SLUGS].sort(),
      )
      const diagnosticSlugs = diagnostics.elementos
        .filter((element) => diagnostics.analisis.get(element.id)?.reachable)
        .map((element) => element.slug)
        .sort()
      assert.deepEqual(
        diagnosticSlugs,
        [...PHASE_2_AVAILABLE_SLUGS].sort(),
      )
    } finally {
      await prisma.$disconnect()
    }
  })

  it('el botón completa Fase 1 y abre Fase 2 con sus aperturas', async () => {
    const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
    try {
      const profileId = await createRuntimeReplayProfile(prisma)
      const result = await completarFaseActual(prisma, profileId, 'fase-1')
      assert.equal(result.phase.slug, 'fase-2')
      assert.deepEqual(
        result.openingElementSlugs.sort(),
        ['agua', 'beyonder', 'misticismo'],
      )
      const discovered = new Set(
        (await prisma.playerDiscovery.findMany({
          where: { profileId },
          select: { element: { select: { slug: true } } },
        })).map((item) => item.element.slug),
      )
      for (const slug of PHASE1_CLOSURE_SLUGS) assert.equal(discovered.has(slug), true, slug)
      await prisma.playerProfile.delete({ where: { id: profileId } })
    } finally {
      await prisma.$disconnect()
    }
  })

  it('sembrar dos veces converge exactamente y preserva el progreso de jugadores', async () => {
    const baselineSnapshot = await loadManagedSnapshot()
    const before = (await loadGraphAndCounts()).counts
    const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
    let progressBefore: unknown
    try {
      const [tiempo, desgaste, ojo, mago, robot, shepherd, ageRecipe] = await Promise.all([
        prisma.element.findUniqueOrThrow({ where: { slug: 'tiempo' } }),
        prisma.element.findUniqueOrThrow({ where: { slug: 'desgaste' } }),
        prisma.element.findUniqueOrThrow({ where: { slug: 'ojo' } }),
        prisma.advance.findFirstOrThrow({ where: { targetSequence: { element: { slug: 'mago' } } } }),
        prisma.sequence.findFirstOrThrow({ where: { element: { slug: 'robot' } } }),
        prisma.ritual.findFirstOrThrow({ where: { advance: { internalName: 'Avance a Shepherd' } } }),
        prisma.recipe.findUniqueOrThrow({
          where: {
            inputKey: buildRecipeInputKey([
              { slug: 'continuidad', quantity: 1 },
              { slug: 'humano', quantity: 1 },
            ]),
          },
        }),
      ])
      await prisma.element.update({ where: { id: tiempo.id }, data: { unlockedAtDiscoveryCount: 1 } })
      await prisma.elementUnlockTrigger.create({
        data: { elementId: tiempo.id, triggerId: ojo.id },
      })
      await prisma.advance.update({ where: { id: mago.id }, data: { internalName: 'STALE', isActive: true } })
      await prisma.advanceIngredient.updateMany({
        where: { advanceId: mago.id },
        data: { quantity: 2 },
      })
      await prisma.sequence.update({ where: { id: robot.id }, data: { name: 'STALE' } })
      await prisma.ritual.update({ where: { id: shepherd.id }, data: { name: 'STALE' } })
      await prisma.ritualIngredient.updateMany({
        where: { ritualId: shepherd.id },
        data: { quantity: 2 },
      })
      await prisma.recipe.update({ where: { id: ageRecipe.id }, data: { minimumDiscoveries: 99 } })
      await prisma.recipeOutput.upsert({
        where: { recipeId_elementId: { recipeId: ageRecipe.id, elementId: tiempo.id } },
        update: { quantity: 2, chance: 0.5, sortOrder: 99 },
        create: {
          recipeId: ageRecipe.id,
          elementId: tiempo.id,
          quantity: 2,
          chance: 0.5,
          sortOrder: 99,
        },
      })
      const legacyProfile = await prisma.playerProfile.findFirstOrThrow()
      await prisma.playerDiscovery.upsert({
        where: {
          profileId_elementId: { profileId: legacyProfile.id, elementId: tiempo.id },
        },
        update: {},
        create: { profileId: legacyProfile.id, elementId: tiempo.id },
      })
      await prisma.playerDiscovery.upsert({
        where: {
          profileId_elementId: { profileId: legacyProfile.id, elementId: desgaste.id },
        },
        update: {},
        create: { profileId: legacyProfile.id, elementId: desgaste.id },
      })
      progressBefore = await prisma.playerDiscovery.findMany({
        orderBy: [{ profileId: 'asc' }, { elementId: 'asc' }],
      })
    } finally {
      await prisma.$disconnect()
    }
    await seed()
    const after = (await loadGraphAndCounts()).counts
    assert.deepEqual(after, before)
    assert.deepEqual(await loadManagedSnapshot(), baselineSnapshot)
    const verification = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
    try {
      assert.deepEqual(
        await verification.playerDiscovery.findMany({
          orderBy: [{ profileId: 'asc' }, { elementId: 'asc' }],
        }),
        progressBefore,
      )
      const [legacyProfile, tiempo] = await Promise.all([
        verification.playerProfile.findFirstOrThrow(),
        verification.element.findUniqueOrThrow({ where: { slug: 'tiempo' } }),
      ])
      assert.equal(tiempo.isActive, false)
      assert.ok(
        await verification.playerDiscovery.findUnique({
          where: {
            profileId_elementId: { profileId: legacyProfile.id, elementId: tiempo.id },
          },
        }),
      )
      await assert.rejects(
        combinarParaPerfil(verification, legacyProfile.id, ['tiempo', 'desgaste']),
        /no está disponible/,
      )
    } finally {
      await verification.$disconnect()
    }
  })

  it('el seed restaura una arista perdida sin reemplazar la receta canónica', async () => {
    const inputKey = buildRecipeInputKey([
      { slug: 'apuesta', quantity: 1 },
      { slug: 'moneda', quantity: 1 },
    ])
    const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
    let recipeId: string
    try {
      const recipe = await prisma.recipe.findUniqueOrThrow({
        where: { inputKey },
        include: { ingredients: { include: { element: true } } },
      })
      recipeId = recipe.id
      const apuesta = recipe.ingredients.find((ingredient) => ingredient.element.slug === 'apuesta')
      assert.ok(apuesta)
      await prisma.recipeIngredient.delete({ where: { id: apuesta.id } })
    } finally {
      await prisma.$disconnect()
    }

    await seed()

    const verification = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
    try {
      const restored = await verification.recipe.findUniqueOrThrow({
        where: { inputKey },
        include: { ingredients: { include: { element: { select: { slug: true } } } } },
      })
      assert.equal(restored.id, recipeId)
      assert.deepEqual(
        restored.ingredients.map((ingredient) => ingredient.element.slug).sort(),
        ['apuesta', 'moneda'],
      )
    } finally {
      await verification.$disconnect()
    }
  })

  it('el seed no recrea una receta eliminada manualmente', async () => {
    const inputKey = buildRecipeInputKey([
      { slug: 'apuesta', quantity: 1 },
      { slug: 'moneda', quantity: 1 },
    ])
    let profileId: string | null = null

    try {
      const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
      try {
        const recipe = await prisma.recipe.findUniqueOrThrow({ where: { inputKey } })
        const profile = await prisma.playerProfile.create({ data: {} })
        profileId = profile.id
        await prisma.playerCombinationStat.create({
          data: {
            profileId,
            inputKey,
            recipeId: recipe.id,
            attempts: 1,
            successes: 1,
          },
        })
        await prisma.$transaction((tx) => eliminarRecetasCompletamente(tx, [recipe]))

        assert.equal(await prisma.recipe.findUnique({ where: { inputKey } }), null)
        assert.equal(
          await prisma.playerCombinationStat.findUnique({
            where: { profileId_inputKey: { profileId, inputKey } },
          }),
          null,
        )
        assert.ok(await prisma.recipeSeedSuppression.findUnique({ where: { inputKey } }))
      } finally {
        await prisma.$disconnect()
      }

      await seed()

      const verification = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
      try {
        assert.equal(await verification.recipe.findUnique({ where: { inputKey } }), null)
      } finally {
        await verification.$disconnect()
      }
    } finally {
      const cleanup = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
      try {
        await cleanup.recipeSeedSuppression.deleteMany({ where: { inputKey } })
        if (profileId) await cleanup.playerProfile.deleteMany({ where: { id: profileId } })
      } finally {
        await cleanup.$disconnect()
      }
      await seed()
    }

    const restoration = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
    try {
      assert.ok(await restoration.recipe.findUnique({ where: { inputKey } }))
    } finally {
      await restoration.$disconnect()
    }
  })
})
