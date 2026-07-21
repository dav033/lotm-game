'use server'

import { revalidatePath } from 'next/cache'
import { parsePhaseRule, phaseRuleElementSlugs } from '@/shared/phaseRules'
import { exigirAdminAccion, NoAutorizadoError } from '../adminAuth'
import { prisma } from '../db'
import { generarSlug } from '../domain/slug'
import { elementoRapidoSchema, elementoSchema } from '../schemas'
import {
  sincronizarStartersConPrimeraFase,
  sincronizarUmbralesFases,
} from '../services/fasesProgresion'
import { eliminarRecetasCompletamente } from '../services/recetas'
import type { EstadoAccion } from './tipos'

function leerFormulario(formData: FormData) {
  return {
    slug: formData.get('slug') ?? '',
    name: formData.get('name') ?? '',
    description: formData.get('description') ?? '',
    iconKey: formData.get('iconKey') ?? 'sparkles',
    imageUrl: formData.get('imageUrl') ?? '',
    type: formData.get('type') ?? 'OTRO',
    tier: formData.get('tier') ?? 0,
    isHiddenUntilDiscovered: formData.get('isHiddenUntilDiscovered') === 'on',
    isMajorDiscovery: formData.get('isMajorDiscovery') === 'on',
    revealTitle: formData.get('revealTitle') ?? '',
    revealText: formData.get('revealText') ?? '',
    unlockedByType: formData.get('unlockedByType') ?? '',
    unlockedBySequenceNumber: formData.get('unlockedBySequenceNumber') ?? '',
    unlockedAtDiscoveryCount: formData.get('unlockedAtDiscoveryCount') ?? '',
    triggerIds: formData.getAll('triggerIds').map(String),
    isActive: formData.get('isActive') === 'on',
    categoriaIds: formData.getAll('categoriaIds').map(String),
    categoriaPrincipalId: formData.get('categoriaPrincipalId') ?? '',
  }
}

// Un elemento referenciado (recetas o secuencia) no puede borrarse.
// Los descubrimientos de jugadores se eliminan en cascada.
export async function elementoEstaReferenciado(id: string): Promise<boolean> {
  const [comoIngrediente, comoResultado, ingredienteDeAvance, secuencia, element, phases] = await Promise.all([
    prisma.recipeIngredient.count({ where: { elementId: id } }),
    prisma.recipeOutput.count({ where: { elementId: id } }),
    prisma.advanceIngredient.count({ where: { elementId: id } }),
    prisma.sequence.count({ where: { elementId: id } }),
    prisma.element.findUnique({ where: { id }, select: { slug: true } }),
    prisma.progressionPhase.findMany({
      select: { advancementRuleJson: true, unlockAtDiscoveryCount: true },
    }),
  ])
  const phaseReference = element && phases.some((phase) =>
    phaseRuleElementSlugs(
      parsePhaseRule(phase.advancementRuleJson, phase.unlockAtDiscoveryCount),
    ).includes(element.slug),
  )
  return comoIngrediente + comoResultado + ingredienteDeAvance + secuencia > 0 || Boolean(phaseReference)
}

export async function guardarElemento(
  id: string | null,
  _prev: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirAdminAccion()
    const parsed = elementoSchema.safeParse(leerFormulario(formData))
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }
    const d = parsed.data

    const data = {
      name: d.name,
      description: d.description,
      iconKey: d.iconKey || 'sparkles',
      imageUrl: d.imageUrl || null,
      type: d.type,
      tier: d.tier,
      isHiddenUntilDiscovered: d.isHiddenUntilDiscovered,
      isMajorDiscovery: d.isMajorDiscovery,
      revealTitle: d.revealTitle || null,
      revealText: d.revealText || null,
      unlockedByType: d.unlockedByType || null,
      unlockedBySequenceNumber:
        d.unlockedBySequenceNumber === '' ? null : d.unlockedBySequenceNumber,
      unlockedAtDiscoveryCount:
        d.unlockedAtDiscoveryCount === '' ? null : d.unlockedAtDiscoveryCount,
      isActive: d.isActive,
    }

    const actual = id ? await prisma.element.findUnique({ where: { id } }) : null
    if (id) {
      if (!actual) return { ok: false, error: 'El elemento no existe.' }
      if (actual.slug !== d.slug && (await elementoEstaReferenciado(id))) {
        return {
          ok: false,
          error:
            'El identificador (slug) es inmutable porque este elemento ya es usado por recetas, secuencias o reglas de fase.',
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      const elementId = id
        ? (await tx.element.update({ where: { id }, data: { ...data, slug: d.slug } })).id
        : (await tx.element.create({ data: { ...data, slug: d.slug } })).id

      // Reasignar categorías (la principal se marca con isPrimary) y
      // desencadenantes del descubrimiento espontáneo.
      await tx.elementCategory.deleteMany({ where: { elementId } })
      for (const categoryId of d.categoriaIds) {
        await tx.elementCategory.create({
          data: {
            elementId,
            categoryId,
            isPrimary: categoryId === d.categoriaPrincipalId || d.categoriaIds.length === 1,
          },
        })
      }
      await tx.elementUnlockTrigger.deleteMany({ where: { elementId } })
      for (const triggerId of new Set(d.triggerIds)) {
        // Un elemento no puede desencadenarse a sí mismo.
        if (triggerId === elementId) continue
        await tx.elementUnlockTrigger.create({ data: { elementId, triggerId } })
      }
      await sincronizarStartersConPrimeraFase(tx)
      await sincronizarUmbralesFases(tx)
    })

    revalidatePath('/admin/elementos')
    revalidatePath('/coleccion')
    return { ok: true, error: null }
  } catch (err: unknown) {
    if (err instanceof NoAutorizadoError) return { ok: false, error: 'No autorizado.' }
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      return { ok: false, error: 'Ya existe un elemento con ese identificador (slug).' }
    }
    console.error('[guardarElemento]', err)
    return { ok: false, error: 'No se pudo guardar el elemento.' }
  }
}

// Categoría automática según el tipo (si existe la convención del seed).
const CATEGORIA_POR_TIPO: Record<string, string> = {
  MUNDANO: 'mundano',
  CONCEPTO: 'conceptos',
  MISTICISMO: 'misticismo',
  BEYONDER: 'beyonder',
}

// Creación rápida desde el constructor de recetas: permite armar una
// combinación completamente desde cero sin salir del formulario. El elemento
// nace oculto hasta descubrirse; icono y textos pueden afinarse después.
export async function crearElementoRapido(datos: {
  name: string
  type: string
}): Promise<
  | { ok: true; error: null; elemento: { id: string; name: string; slug: string; iconKey: string; isActive: boolean } }
  | { ok: false; error: string; elemento: null }
> {
  try {
    await exigirAdminAccion()
    const parsed = elementoRapidoSchema.safeParse(datos)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.', elemento: null }
    }
    const { name, type } = parsed.data

    const base = generarSlug(name)
    if (!base) return { ok: false, error: 'El nombre no produce un identificador válido.', elemento: null }
    // Resolver colisiones: espejo, espejo-2, espejo-3…
    let slug = base
    for (let i = 2; await prisma.element.findUnique({ where: { slug } }); i++) {
      if (i > 50) return { ok: false, error: 'Demasiados elementos con ese nombre.', elemento: null }
      slug = `${base}-${i}`
    }

    const elemento = await prisma.element.create({
      data: { slug, name, type, description: '', iconKey: 'sparkles' },
    })

    const catSlug = CATEGORIA_POR_TIPO[type]
    if (catSlug) {
      const categoria = await prisma.category.findUnique({ where: { slug: catSlug } })
      if (categoria) {
        await prisma.elementCategory.create({
          data: { elementId: elemento.id, categoryId: categoria.id, isPrimary: true },
        })
      }
    }

    revalidatePath('/admin/elementos')
    return {
      ok: true,
      error: null,
      elemento: {
        id: elemento.id,
        name: elemento.name,
        slug: elemento.slug,
        iconKey: elemento.iconKey,
        isActive: elemento.isActive,
      },
    }
  } catch (err) {
    if (err instanceof NoAutorizadoError) return { ok: false, error: 'No autorizado.', elemento: null }
    console.error('[crearElementoRapido]', err)
    return { ok: false, error: 'No se pudo crear el elemento.', elemento: null }
  }
}

export async function alternarElementoActivo(id: string): Promise<void> {
  await exigirAdminAccion()
  const el = await prisma.element.findUnique({ where: { id } })
  if (!el) return
  await prisma.element.update({ where: { id }, data: { isActive: !el.isActive } })
  await sincronizarUmbralesFases(prisma)
  revalidatePath('/admin/elementos')
  revalidatePath('/coleccion')
}

export async function eliminarElemento(id: string): Promise<EstadoAccion> {
  try {
    await exigirAdminAccion()

    const elemento = await prisma.element.findUnique({ where: { id } })
    if (!elemento) return { ok: false, error: 'El elemento no existe.' }
    if (elemento.isStarter) {
      return { ok: false, error: 'Los elementos iniciales no pueden eliminarse.' }
    }
    const phaseRules = await prisma.progressionPhase.findMany({
      select: { advancementRuleJson: true, unlockAtDiscoveryCount: true },
    })
    if (phaseRules.some((phase) =>
      phaseRuleElementSlugs(
        parsePhaseRule(phase.advancementRuleJson, phase.unlockAtDiscoveryCount),
      ).includes(elemento.slug),
    )) {
      return {
        ok: false,
        error: 'Este elemento forma parte de una regla de avance. Retíralo de la fase primero.',
      }
    }

    // Verificar si tiene secuencia vinculada
    const secuencia = await prisma.sequence.count({ where: { elementId: id } })
    if (secuencia > 0) {
      return { ok: false, error: 'Este elemento tiene una secuencia vinculada. Elimina la secuencia primero.' }
    }

    // Un avance sin su fórmula no es válido: al borrar uno de sus ingredientes
    // se retira también la definición completa del avance. Lo mismo se aplica
    // a recetas: nunca se dejan padres con ingredientes o salidas incompletos.
    await prisma.$transaction(async (tx) => {
      const recipes = await tx.recipe.findMany({
        where: {
          OR: [
            { ingredients: { some: { elementId: id } } },
            { outputs: { some: { elementId: id } } },
          ],
        },
        select: { id: true, inputKey: true },
      })
      await eliminarRecetasCompletamente(tx, recipes)
      const advanceIds = await tx.advanceIngredient.findMany({
        where: { elementId: id },
        select: { advanceId: true },
      })
      if (advanceIds.length > 0) {
        await tx.advance.deleteMany({
          where: { id: { in: advanceIds.map((item) => item.advanceId) } },
        })
      }
      await tx.element.delete({ where: { id } })
      await sincronizarUmbralesFases(tx)
    })
    revalidatePath('/admin/elementos')
    revalidatePath('/admin/recetas')
    revalidatePath('/admin/arbol')
    revalidatePath('/admin/diagnostico')
    revalidatePath('/admin/combinaciones-fallidas')
    revalidatePath('/coleccion')
    return { ok: true, error: null }
  } catch (err) {
    if (err instanceof NoAutorizadoError) return { ok: false, error: 'No autorizado.' }
    console.error('[eliminarElemento]', err)
    return { ok: false, error: 'No se pudo eliminar el elemento.' }
  }
}
