// Orquestador del contenido inicial. Los catálogos viven en seed-content y las
// operaciones Prisma permanecen aquí para conservar su orden e idempotencia.

import type { PrismaClient } from '../src/generated/prisma/client'
import { buildRecipeInputKey } from '../src/server/domain/inputKey'
import { getAdvanceDefinitions } from './seed-content/advances'
import { getElementDefinitions } from './seed-content/elements'
import {
  PHASE1_TRANSITION_REQUIREMENT_SLUGS,
  PHASE1_TRANSITION_TARGET_SLUGS,
  TIME_SLUG,
  TIME_UNLOCK_REQUIREMENT_SLUGS,
} from './seed-content/progression'
import { getRecipeDefinitions } from './seed-content/recipes'
import { getRitualDefinitions } from './seed-content/rituals'
import { getSequenceDefinitions } from './seed-content/sequences'

export async function seedGameData(prisma: PrismaClient) {
  // ---------- Categorías ----------
  const mundano = await prisma.category.upsert({
    where: { slug: 'mundano' },
    update: {},
    create: {
      slug: 'mundano',
      name: 'Mundano',
      description: 'Lo que cualquier persona puede tocar sin estremecerse.',
      sortOrder: 1,
    },
  })
  const conceptos = await prisma.category.upsert({
    where: { slug: 'conceptos' },
    update: {},
    create: {
      slug: 'conceptos',
      name: 'Conceptos',
      description: 'Ideas que cobran forma cuando se las contempla demasiado.',
      sortOrder: 2,
    },
  })
  const misticismo = await prisma.category.upsert({
    where: { slug: 'misticismo' },
    update: {},
    create: {
      slug: 'misticismo',
      name: 'Misticismo',
      description: 'Saberes que la razón prefiere no catalogar.',
      sortOrder: 3,
      isHidden: true,
    },
  })
  const beyonder = await prisma.category.upsert({
    where: { slug: 'beyonder' },
    update: {},
    create: {
      slug: 'beyonder',
      name: 'Beyonder',
      description: 'Quienes cruzaron la frontera y ya no pueden regresar.',
      parentId: misticismo.id,
      sortOrder: 4,
      isHidden: true,
    },
  })

  // ---------- Caminos ----------
  const caminoVidente = await prisma.pathway.upsert({
    where: { slug: 'camino-del-vidente' },
    update: {},
    create: {
      slug: 'camino-del-vidente',
      name: 'Camino del Vidente',
      description:
        'La senda de quienes leen el destino en símbolos, cartas y espejos.',
      categoryId: beyonder.id,
      iconKey: 'eye',
      isHiddenUntilDiscovered: true,
    },
  })
  const caminoSuplicante = await prisma.pathway.upsert({
    where: { slug: 'camino-del-suplicante-de-secretos' },
    update: {},
    create: {
      slug: 'camino-del-suplicante-de-secretos',
      name: 'Camino del Suplicante de Secretos',
      description:
        'La senda de quienes mendigan saberes prohibidos a puertas que nadie más ve.',
      categoryId: beyonder.id,
      iconKey: 'book-open',
      isHiddenUntilDiscovered: true,
    },
  })
  const caminoMonstruo = await prisma.pathway.upsert({
    where: { slug: 'camino-del-monstruo' },
    update: {},
    create: {
      slug: 'camino-del-monstruo',
      name: 'Camino del Monstruo',
      description:
        'La senda de quienes juegan con el destino hasta que el destino juega con ellos.',
      categoryId: beyonder.id,
      iconKey: 'ghost',
      isHiddenUntilDiscovered: true,
    },
  })
  const caminoAprendizAnterior = await prisma.pathway.findUnique({
    where: { slug: 'camino-del-aprendiz' },
  })
  const caminoPuertaExistente = await prisma.pathway.findUnique({
    where: { slug: 'camino-de-la-puerta' },
  })
  if (caminoAprendizAnterior && !caminoPuertaExistente) {
    await prisma.pathway.update({
      where: { id: caminoAprendizAnterior.id },
      data: { slug: 'camino-de-la-puerta' },
    })
  }
  const caminoPuertaData = {
    name: 'Camino de la Puerta',
    description:
      'La senda de quienes abren puertas hacia espacios que deberían permanecer vacíos.',
    categoryId: beyonder.id,
    iconKey: 'door-open',
    isHiddenUntilDiscovered: true,
  }
  const caminoPuerta = await prisma.pathway.upsert({
    where: { slug: 'camino-de-la-puerta' },
    update: caminoPuertaData,
    create: {
      slug: 'camino-de-la-puerta',
      ...caminoPuertaData,
    },
  })
  const caminoError = await prisma.pathway.upsert({
    where: { slug: 'camino-del-error' },
    update: {},
    create: {
      slug: 'camino-del-error',
      name: 'Camino del Error',
      description:
        'La senda de quienes roban oportunidades, identidades y hasta las reglas de la realidad.',
      categoryId: beyonder.id,
      iconKey: 'bug',
      isHiddenUntilDiscovered: true,
    },
  })
  const caminoBardoAnterior = await prisma.pathway.findUnique({
    where: { slug: 'camino-del-bardo' },
  })
  const caminoSol = await prisma.pathway.upsert({
    where: { slug: 'camino-del-sol' },
    update: {},
    create: {
      slug: 'camino-del-sol',
      name: 'Camino del Sol',
      description: 'La senda de la luz, la purificación, los juramentos y la justicia divina.',
      categoryId: beyonder.id,
      iconKey: 'sun',
      isHiddenUntilDiscovered: true,
    },
  })
  if (caminoBardoAnterior && caminoBardoAnterior.id !== caminoSol.id) {
    const unlocks = await prisma.playerPathwayUnlock.findMany({
      where: { pathwayId: caminoBardoAnterior.id },
      select: { profileId: true, unlockedAt: true },
    })
    for (const unlock of unlocks) {
      await prisma.playerPathwayUnlock.upsert({
        where: { profileId_pathwayId: { profileId: unlock.profileId, pathwayId: caminoSol.id } },
        update: {},
        create: { profileId: unlock.profileId, pathwayId: caminoSol.id, unlockedAt: unlock.unlockedAt },
      })
    }
    await prisma.sequence.updateMany({
      where: { pathwayId: caminoBardoAnterior.id },
      data: { pathwayId: caminoSol.id },
    })
    await prisma.pathway.delete({ where: { id: caminoBardoAnterior.id } })
  }
  const caminoArbitro = await prisma.pathway.upsert({
    where: { slug: 'camino-del-arbitro' },
    update: {},
    create: {
      slug: 'camino-del-arbitro',
      name: 'Camino del Árbitro',
      description: 'La senda de quienes convierten la ley en una autoridad imposible de ignorar.',
      categoryId: beyonder.id,
      iconKey: 'shield',
      isHiddenUntilDiscovered: true,
    },
  })
  const caminoAbogado = await prisma.pathway.upsert({
    where: { slug: 'camino-del-abogado' },
    update: {},
    create: {
      slug: 'camino-del-abogado',
      name: 'Camino del Abogado',
      description: 'La senda de quienes encuentran poder en las reglas, sus términos y sus vacíos.',
      categoryId: beyonder.id,
      iconKey: 'briefcase-business',
      isHiddenUntilDiscovered: true,
    },
  })
  const caminoSleepless = await prisma.pathway.upsert({
    where: { slug: 'camino-del-sleepless' },
    update: {},
    create: {
      slug: 'camino-del-sleepless',
      name: 'Camino del Sleepless',
      description: 'La senda de quienes atraviesan la noche sin entregarse al sueño.',
      categoryId: beyonder.id,
      iconKey: 'moon',
      isHiddenUntilDiscovered: true,
    },
  })
  const caminoMuerte = await prisma.pathway.upsert({
    where: { slug: 'camino-de-la-muerte' },
    update: {},
    create: {
      slug: 'camino-de-la-muerte',
      name: 'Camino de la Muerte',
      description: 'La senda de quienes estudian aquello que permanece cuando la vida termina.',
      categoryId: beyonder.id,
      iconKey: 'skull',
      isHiddenUntilDiscovered: true,
    },
  })
  const caminoSavant = await prisma.pathway.upsert({
    where: { slug: 'camino-del-savant' },
    update: {},
    create: {
      slug: 'camino-del-savant',
      name: 'Camino del Savant',
      description: 'La senda de quienes transforman conocimiento, técnica y maquinaria en poder.',
      categoryId: beyonder.id,
      iconKey: 'hammer',
      isHiddenUntilDiscovered: true,
    },
  })
  const caminoMysteryPryer = await prisma.pathway.upsert({
    where: { slug: 'camino-del-mystery-pryer' },
    update: {},
    create: {
      slug: 'camino-del-mystery-pryer',
      name: 'Camino del Mystery Pryer',
      description: 'La senda de quienes persiguen el conocimiento oculto detrás de cada misterio.',
      categoryId: beyonder.id,
      iconKey: 'book-key',
      isHiddenUntilDiscovered: true,
    },
  })

  // ---------- Elementos ----------
  const defs = getElementDefinitions({
    mundano: mundano.id,
    conceptos: conceptos.id,
    misticismo: misticismo.id,
    beyonder: beyonder.id,
  })

  const bySlug = new Map<string, { id: string }>()
  for (const def of defs) {
    const { categoryId, ...data } = def
    const normalized = {
      ...data,
      isStarter: data.isStarter ?? false,
      isHiddenUntilDiscovered: data.isHiddenUntilDiscovered ?? true,
      isMajorDiscovery: data.isMajorDiscovery ?? false,
      unlockedByType: data.unlockedByType ?? null,
      unlockedBySequenceNumber: data.unlockedBySequenceNumber ?? null,
    }
    const element = await prisma.element.upsert({
      where: { slug: def.slug },
      update: normalized,
      create: normalized,
    })
    bySlug.set(def.slug, element)
    await prisma.elementCategory.upsert({
      where: { elementId_categoryId: { elementId: element.id, categoryId } },
      update: {},
      create: { elementId: element.id, categoryId, isPrimary: true },
    })
  }

  const id = (slug: string) => {
    const e = bySlug.get(slug)
    if (!e) throw new Error(`Elemento del seed no encontrado: ${slug}`)
    return e.id
  }

  // ---------- Reconciliación de contenido heredado ----------
  // Apuesta se retiró del catálogo (fase 2). Sus recetas obsoletas ya se
  // borraron arriba por clave de ingredientes; aquí se retira cualquier fila
  // del elemento que aún exista en una base ya viva. Operación idempotente:
  // en una base nueva simplemente no encuentra nada que borrar.
  await prisma.element.deleteMany({ where: { slug: 'apuesta' } })

  // «Persepcion espiritual» es un duplicado con errata que solo puede existir
  // en una base ya viva (este seed nunca lo crea). Se fusiona de forma
  // idempotente con el elemento canónico `percepcion-espiritual` antes de
  // eliminarlo, preservando el progreso de los jugadores.
  await fusionarPercepcionEspiritualTypo(prisma, id('percepcion-espiritual'))

  // Transición Fase 1 → Fase 2: los cuatro conceptos raíz (Espacio,
  // Misticismo, Beyonder, Humano) comparten el mismo requisito AND y se
  // desbloquean juntos en cuanto el jugador reúne Mundo, Historia, Profecía
  // y Seer. El antiguo desencadenante directo Seer → Espacio queda retirado:
  // ahora Espacio depende únicamente del requisito conjunto, igual que sus
  // hermanos.
  await prisma.elementUnlockTrigger.deleteMany({
    where: { elementId: id('espacio'), triggerId: id('seer') },
  })
  for (const targetSlug of PHASE1_TRANSITION_TARGET_SLUGS) {
    const targetId = id(targetSlug)
    await prisma.elementUnlockRequirement.deleteMany({
      where: { elementId: targetId },
    })
    await prisma.elementUnlockRequirement.createMany({
      data: PHASE1_TRANSITION_REQUIREMENT_SLUGS.map((requiredSlug) => ({
        elementId: targetId,
        requiredElementId: id(requiredSlug),
      })),
    })
  }

  // Tiempo: descubrimiento compuesto de Fase 3. Exige Monster (requisito AND)
  // Y una Secuencia 6 activa (unlockedBySequenceNumber), nunca uno solo de
  // los dos. Sin desencadenante directo.
  await prisma.elementUnlockRequirement.deleteMany({ where: { elementId: id(TIME_SLUG) } })
  await prisma.elementUnlockRequirement.createMany({
    data: TIME_UNLOCK_REQUIREMENT_SLUGS.map((requiredSlug) => ({
      elementId: id(TIME_SLUG),
      requiredElementId: id(requiredSlug),
    })),
  })

  await prisma.elementUnlockTrigger.upsert({
    where: {
      elementId_triggerId: {
        elementId: id('mundo-espiritual'),
        triggerId: id('proyeccion-astral'),
      },
    },
    update: {},
    create: {
      elementId: id('mundo-espiritual'),
      triggerId: id('proyeccion-astral'),
    },
  })
  await prisma.elementUnlockTrigger.upsert({
    where: {
      elementId_triggerId: {
        elementId: id('magia'),
        triggerId: id('trickmaster'),
      },
    },
    update: {},
    create: {
      elementId: id('magia'),
      triggerId: id('trickmaster'),
    },
  })
  const elementUnlocks = [
    ['sailor', 'iglesia-del-senor-de-las-tormentas'],
    ['sleepless', 'iglesia-de-la-noche-eterna'],
    ['corpse-collector', 'iglesia-de-la-noche-eterna'],
    ['savant', 'iglesia-del-dios-del-vapor-y-la-maquinaria'],
    ['mystery-pryer', 'iglesia-del-dios-del-vapor-y-la-maquinaria'],
    ['ave', 'unshadowed'],
    ['pluma', 'undying'],
    ['pilar', 'imperative-mage'],
    ['lobo', 'nightwatcher'],
  ] as const
  for (const [elementSlug, triggerSlug] of elementUnlocks) {
    await prisma.elementUnlockTrigger.upsert({
      where: {
        elementId_triggerId: {
          elementId: id(elementSlug),
          triggerId: id(triggerSlug),
        },
      },
      update: {},
      create: {
        elementId: id(elementSlug),
        triggerId: id(triggerSlug),
      },
    })
  }
  const caminoVisionario = await prisma.pathway.upsert({
    where: { slug: 'camino-del-visionario' },
    update: {},
    create: {
      slug: 'camino-del-visionario',
      name: 'Camino del Visionario',
      description: 'La senda que observa, comprende y finalmente gobierna la mente y los sueños.',
      categoryId: beyonder.id,
      iconKey: 'brain',
      isHiddenUntilDiscovered: true,
    },
  })
  const caminoTirano = await prisma.pathway.upsert({
    where: { slug: 'camino-del-tirano' },
    update: {},
    create: {
      slug: 'camino-del-tirano',
      name: 'Camino del Tirano',
      description: 'La senda del mar, las tormentas y el dominio absoluto sobre las fuerzas naturales.',
      categoryId: beyonder.id,
      iconKey: 'waves',
      isHiddenUntilDiscovered: true,
    },
  })

  // ---------- Secuencias ----------
  const secuencias = getSequenceDefinitions({
    vidente: caminoVidente,
    sol: caminoSol,
    puerta: caminoPuerta,
    arbitro: caminoArbitro,
    abogado: caminoAbogado,
    sleepless: caminoSleepless,
    muerte: caminoMuerte,
    savant: caminoSavant,
    mysteryPryer: caminoMysteryPryer,
    error: caminoError,
    suplicante: caminoSuplicante,
    monstruo: caminoMonstruo,
    visionario: caminoVisionario,
    tirano: caminoTirano,
  })
  const sequenceBySlug = new Map<string, { id: string }>()
  for (const s of secuencias) {
    const sequence = await prisma.sequence.upsert({
      where: { elementId: id(s.slug) },
      update: {},
      create: {
        pathwayId: s.camino.id,
        number: s.number,
        name: s.name,
        elementId: id(s.slug),
      },
    })
    sequenceBySlug.set(s.slug, sequence)
  }

  // ---------- Recetas ----------
  const recetas = getRecipeDefinitions()

  // Fórmulas sustituidas cuya clave de ingredientes cambió por completo (no
  // basta con resincronizar salidas). El borrado explícito mantiene
  // idempotente una base que ya hubiera ejecutado una versión anterior del
  // seed.
  await prisma.recipe.deleteMany({
    where: {
      inputKey: {
        in: [
          buildRecipeInputKey([{ slug: 'nacion', quantity: 2 }]),
          buildRecipeInputKey([
            { slug: 'fuego', quantity: 1 },
            { slug: 'bendicion', quantity: 1 },
          ]),
          buildRecipeInputKey([
            { slug: 'destino', quantity: 1 },
            { slug: 'humano', quantity: 1 },
          ]),
          buildRecipeInputKey([
            { slug: 'robo', quantity: 1 },
            { slug: 'ojo', quantity: 1 },
          ]),
          buildRecipeInputKey([
            { slug: 'susurro', quantity: 1 },
            { slug: 'ojo', quantity: 1 },
          ]),
          // Estas fórmulas ahora fabrican avances y no descubren directamente
          // la secuencia de destino.
          buildRecipeInputKey([
            { slug: 'registro', quantity: 1 },
            { slug: 'truco', quantity: 1 },
          ]),
          buildRecipeInputKey([
            { slug: 'poder-beyonder', quantity: 1 },
            { slug: 'registro', quantity: 1 },
          ]),
          buildRecipeInputKey([
            { slug: 'fortuna', quantity: 1 },
            { slug: 'truco', quantity: 1 },
          ]),
          buildRecipeInputKey([
            { slug: 'dato', quantity: 1 },
            { slug: 'misticismo', quantity: 1 },
          ]),
          buildRecipeInputKey([
            { slug: 'robo', quantity: 1 },
            { slug: 'poder-beyonder', quantity: 1 },
          ]),
          // Rediseño de progresión (fases 1-3): claves de ingredientes que
          // cambiaron por completo y ya no tienen sucesor con la misma clave.
          buildRecipeInputKey([{ slug: 'vision', quantity: 1 }, { slug: 'tiempo', quantity: 1 }]),
          buildRecipeInputKey([{ slug: 'observacion', quantity: 1 }, { slug: 'tiempo', quantity: 1 }]),
          buildRecipeInputKey([{ slug: 'registro', quantity: 1 }, { slug: 'tiempo', quantity: 1 }]),
          buildRecipeInputKey([{ slug: 'adivinacion', quantity: 1 }, { slug: 'destino', quantity: 1 }]),
          buildRecipeInputKey([{ slug: 'apuesta', quantity: 1 }, { slug: 'moneda', quantity: 1 }]),
          buildRecipeInputKey([{ slug: 'experiencia-2', quantity: 1 }, { slug: 'percepcion', quantity: 1 }]),
          buildRecipeInputKey([{ slug: 'beyonder', quantity: 1 }, { slug: 'tiempo', quantity: 1 }]),
          buildRecipeInputKey([{ slug: 'ruptura', quantity: 1 }, { slug: 'tiempo', quantity: 1 }]),
          // Defensivo: clave heredada de una base ya viva (nunca existió en
          // este seed) donde Conocimiento se fabricaba con Humano.
          buildRecipeInputKey([{ slug: 'experiencia-2', quantity: 1 }, { slug: 'humano', quantity: 1 }]),
        ],
      },
    },
  })
  // Susurro dejó de formar parte del catálogo. El borrado en cascada retira
  // su salida histórica de Humano ×2 y cualquier progreso asociado.
  await prisma.element.deleteMany({ where: { slug: 'susurro' } })

  // Sincronización determinista de recetas gestionadas: ingredientes, salidas
  // e isActive terminan coincidiendo EXACTAMENTE con la definición, incluso
  // en una base que ya hubiera corrido una versión anterior del seed (se
  // borran filas obsoletas, no solo se añaden las que faltan).
  for (const r of recetas) {
    const inputKey = buildRecipeInputKey(
      r.ings.map(([slug, quantity]) => ({ slug, quantity })),
    )
    const isActive = r.isActive ?? true
    const recipe = await prisma.recipe.upsert({
      where: { inputKey },
      update: { isActive },
      create: {
        inputKey,
        isActive,
        ingredients: {
          create: r.ings.map(([slug, quantity]) => ({
            elementId: id(slug),
            quantity,
          })),
        },
        outputs: {
          create: r.outputs.map((output, sortOrder) => ({
            elementId: id(output),
            quantity: 1,
            chance: 1.0,
            sortOrder,
          })),
        },
      },
    })

    const ingredientElementIds = new Set(r.ings.map(([slug]) => id(slug)))
    for (const [slug, quantity] of r.ings) {
      await prisma.recipeIngredient.upsert({
        where: { recipeId_elementId: { recipeId: recipe.id, elementId: id(slug) } },
        update: { quantity },
        create: { recipeId: recipe.id, elementId: id(slug), quantity },
      })
    }
    await prisma.recipeIngredient.deleteMany({
      where: { recipeId: recipe.id, elementId: { notIn: [...ingredientElementIds] } },
    })

    const outputElementIds = new Set(r.outputs.map((slug) => id(slug)))
    for (const [sortOrder, output] of r.outputs.entries()) {
      await prisma.recipeOutput.upsert({
        where: { recipeId_elementId: { recipeId: recipe.id, elementId: id(output) } },
        update: { sortOrder, quantity: 1, chance: 1.0 },
        create: {
          recipeId: recipe.id,
          elementId: id(output),
          quantity: 1,
          chance: 1.0,
          sortOrder,
        },
      })
    }
    await prisma.recipeOutput.deleteMany({
      where: { recipeId: recipe.id, elementId: { notIn: [...outputElementIds] } },
    })
  }

  // Una versión anterior entregaba Folk of Rage junto con Furia. Se conserva
  // la receta y su identidad, retirando únicamente el resultado migrado.
  await prisma.recipeOutput.deleteMany({
    where: {
      elementId: id('folk-of-rage'),
      recipe: {
        inputKey: buildRecipeInputKey([
          { slug: 'ira', quantity: 1 },
          { slug: 'fuerza', quantity: 1 },
        ]),
      },
    },
  })

  // ---------- Avances ----------
  const avances = getAdvanceDefinitions()
  const advanceByName = new Map<string, { id: string }>()
  for (const advance of avances) {
    const sourceSequence = sequenceBySlug.get(advance.source)
    const targetSequence = sequenceBySlug.get(advance.target)
    if (!sourceSequence || !targetSequence) {
      throw new Error(`Secuencias del avance no encontradas: ${advance.internalName}`)
    }
    const inputKey = buildRecipeInputKey(
      advance.ingredients.map((slug) => ({ slug, quantity: 1 })),
    )
    const savedAdvance = await prisma.advance.upsert({
      where: { inputKey },
      update: {},
      create: {
        internalName: advance.internalName,
        inputKey,
        sourceSequenceId: sourceSequence.id,
        targetSequenceId: targetSequence.id,
        ingredients: {
          create: advance.ingredients.map((slug) => ({ elementId: id(slug), quantity: 1 })),
        },
      },
    })
    advanceByName.set(advance.internalName, savedAdvance)
  }

  // ---------- Rituales ----------
  const shepherdAdvance = advanceByName.get('Avance a Shepherd')
  if (!shepherdAdvance) throw new Error('No se encontró el avance a Shepherd para su ritual.')
  const ritualInputKey = buildRecipeInputKey([
    { slug: 'influencia', quantity: 1 },
    { slug: 'alma', quantity: 1 },
  ])
  await prisma.ritual.upsert({
    where: { inputKey: ritualInputKey },
    update: {},
    create: {
      name: 'Ritual de avance a Shepherd',
      inputKey: ritualInputKey,
      advanceId: shepherdAdvance.id,
      requiredSequenceNumber: 6,
      ingredients: {
        create: [
          { elementId: id('influencia'), quantity: 1 },
          { elementId: id('alma'), quantity: 1 },
        ],
      },
      failureOutputs: {
        create: [
          { elementId: id('perdida-de-control') },
          { elementId: id('monstruo-descontrol') },
          { elementId: id('corrupcion-de-alborotador') },
        ],
      },
    },
  })

  const marionetistaAdvance = advanceByName.get('Avance a Marionetista')
  if (!marionetistaAdvance) throw new Error('No se encontró el avance a Marionetista para su ritual.')
  const marionetistaRitualKey = buildRecipeInputKey([
    { slug: 'sirena', quantity: 1 },
    { slug: 'canto', quantity: 1 },
  ])
  await prisma.ritual.upsert({
    where: { inputKey: marionetistaRitualKey },
    update: {},
    create: {
      name: 'Ritual de avance a Marionetista',
      inputKey: marionetistaRitualKey,
      advanceId: marionetistaAdvance.id,
      requiredSequenceNumber: 6,
      ingredients: {
        create: [
          { elementId: id('sirena'), quantity: 1 },
          { elementId: id('canto'), quantity: 1 },
        ],
      },
      failureOutputs: {
        create: [
          { elementId: id('perdida-de-control') },
          { elementId: id('monstruo-descontrol') },
          { elementId: id('corrupcion-de-alborotador') },
        ],
      },
    },
  })

  const winnerAdvance = advanceByName.get('Avance a Winner')
  if (!winnerAdvance) throw new Error('No se encontró el avance a Winner para su ritual.')
  const winnerRitualKey = buildRecipeInputKey([
    { slug: 'mala-suerte', quantity: 1 },
    { slug: 'tiempo', quantity: 1 },
  ])
  await prisma.ritual.upsert({
    where: { inputKey: winnerRitualKey },
    update: {},
    create: {
      name: 'Ritual de avance a Winner',
      inputKey: winnerRitualKey,
      advanceId: winnerAdvance.id,
      requiredSequenceNumber: 6,
      ingredients: {
        create: [
          { elementId: id('mala-suerte'), quantity: 1 },
          { elementId: id('tiempo'), quantity: 1 },
        ],
      },
      failureOutputs: {
        create: [
          { elementId: id('perdida-de-control') },
          { elementId: id('monstruo-descontrol') },
          { elementId: id('corrupcion-de-alborotador') },
        ],
      },
    },
  })

  const bizarroAdvance = advanceByName.get('Avance a Bizarro Sorcerer')
  if (!bizarroAdvance) throw new Error('No se encontró el avance a Bizarro Sorcerer para su ritual.')
  const bizarroRitualKey = buildRecipeInputKey([
    { slug: 'demigod', quantity: 1 },
    { slug: 'muerte', quantity: 1 },
  ])
  await prisma.ritual.upsert({
    where: { inputKey: bizarroRitualKey },
    update: {},
    create: {
      name: 'Ritual de avance a Bizarro Sorcerer',
      inputKey: bizarroRitualKey,
      advanceId: bizarroAdvance.id,
      requiredSequenceNumber: 5,
      ingredients: {
        create: [
          { elementId: id('demigod'), quantity: 1 },
          { elementId: id('muerte'), quantity: 1 },
        ],
      },
      failureOutputs: {
        create: [
          { elementId: id('perdida-de-control') },
          { elementId: id('monstruo-descontrol') },
          { elementId: id('corrupcion-de-alborotador') },
        ],
      },
    },
  })

  const blackKnightAdvance = advanceByName.get('Avance a Black Knight')
  if (!blackKnightAdvance) throw new Error('No se encontró el avance a Black Knight para su ritual.')
  const blackKnightRitualKey = buildRecipeInputKey([
    { slug: 'comunidad', quantity: 1 },
    { slug: 'degeneracion', quantity: 1 },
  ])
  await prisma.ritual.upsert({
    where: { inputKey: blackKnightRitualKey },
    update: {},
    create: {
      name: 'Ritual de avance a Black Knight',
      inputKey: blackKnightRitualKey,
      advanceId: blackKnightAdvance.id,
      requiredSequenceNumber: 5,
      ingredients: {
        create: [
          { elementId: id('comunidad'), quantity: 1 },
          { elementId: id('degeneracion'), quantity: 1 },
        ],
      },
      failureOutputs: {
        create: [
          { elementId: id('perdida-de-control') },
          { elementId: id('monstruo-descontrol') },
          { elementId: id('corrupcion-de-alborotador') },
        ],
      },
    },
  })

  const nuevosRituales = getRitualDefinitions()
  for (const ritual of nuevosRituales) {
    const advance = advanceByName.get(ritual.advanceName)
    if (!advance) throw new Error(`No se encontró ${ritual.advanceName} para su ritual.`)
    const inputKey = buildRecipeInputKey(
      ritual.ingredients.map((slug) => ({ slug, quantity: 1 })),
    )
    await prisma.ritual.upsert({
      where: { inputKey },
      update: {},
      create: {
        name: ritual.name,
        inputKey,
        advanceId: advance.id,
        requiredSequenceNumber: ritual.requiredSequenceNumber,
        ingredients: {
          create: ritual.ingredients.map((slug) => ({ elementId: id(slug), quantity: 1 })),
        },
        failureOutputs: {
          create: [
            { elementId: id('perdida-de-control') },
            { elementId: id('monstruo-descontrol') },
            { elementId: id('corrupcion-de-alborotador') },
          ],
        },
      },
    })
  }
}

// Fusiona el duplicado con errata «Persepcion espiritual» (si existe en la
// base) dentro del elemento canónico `percepcion-espiritual` y lo elimina.
// Este seed nunca crea el typo: la función solo actúa sobre bases ya vivas
// que lo hayan arrastrado, y es segura de ejecutar más de una vez.
async function fusionarPercepcionEspiritualTypo(prisma: PrismaClient, canonicalId: string) {
  const typo = await prisma.element.findFirst({
    where: { name: 'Persepcion espiritual' },
  })
  if (!typo) return

  await prisma.$transaction(async (tx) => {
    const ingredientRows = await tx.recipeIngredient.findMany({ where: { elementId: typo.id } })
    for (const row of ingredientRows) {
      const exists = await tx.recipeIngredient.findUnique({
        where: { recipeId_elementId: { recipeId: row.recipeId, elementId: canonicalId } },
      })
      if (!exists) {
        await tx.recipeIngredient.update({ where: { id: row.id }, data: { elementId: canonicalId } })
      }
    }

    const outputRows = await tx.recipeOutput.findMany({ where: { elementId: typo.id } })
    for (const row of outputRows) {
      const exists = await tx.recipeOutput.findUnique({
        where: { recipeId_elementId: { recipeId: row.recipeId, elementId: canonicalId } },
      })
      if (!exists) {
        await tx.recipeOutput.update({ where: { id: row.id }, data: { elementId: canonicalId } })
      }
    }

    // Descubrimientos de jugadores: se fusionan preservando el primer
    // descubrimiento, el último `lastCreatedAt` y sumando `timesCreated`
    // sin violar la clave compuesta (profileId, elementId).
    const typoDiscoveries = await tx.playerDiscovery.findMany({ where: { elementId: typo.id } })
    for (const disc of typoDiscoveries) {
      const canonical = await tx.playerDiscovery.findUnique({
        where: { profileId_elementId: { profileId: disc.profileId, elementId: canonicalId } },
      })
      if (!canonical) {
        await tx.playerDiscovery.create({
          data: {
            profileId: disc.profileId,
            elementId: canonicalId,
            firstDiscoveredAt: disc.firstDiscoveredAt,
            lastCreatedAt: disc.lastCreatedAt,
            timesCreated: disc.timesCreated,
          },
        })
      } else {
        await tx.playerDiscovery.update({
          where: { profileId_elementId: { profileId: disc.profileId, elementId: canonicalId } },
          data: {
            firstDiscoveredAt:
              disc.firstDiscoveredAt < canonical.firstDiscoveredAt
                ? disc.firstDiscoveredAt
                : canonical.firstDiscoveredAt,
            lastCreatedAt:
              disc.lastCreatedAt > canonical.lastCreatedAt ? disc.lastCreatedAt : canonical.lastCreatedAt,
            timesCreated: canonical.timesCreated + disc.timesCreated,
          },
        })
      }
    }

    // El borrado en cascada retira cualquier fila restante (ingrediente,
    // salida o descubrimiento sin canónico, requisito, desencadenante) que
    // todavía referencie el duplicado.
    await tx.element.delete({ where: { id: typo.id } })
  })
}
