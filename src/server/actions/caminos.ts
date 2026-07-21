'use server'

import { revalidatePath } from 'next/cache'
import { exigirAdminAccion, NoAutorizadoError } from '../adminAuth'
import { prisma } from '../db'
import { caminoSchema, secuenciaSchema } from '../schemas'
import { buscarRecetaEquivalente, crearReceta, RecetaError } from '../services/recetas'
import { sincronizarUmbralesFases } from '../services/fasesProgresion'
import type { EstadoAccion } from './tipos'

export async function guardarCamino(
  id: string | null,
  _prev: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirAdminAccion()
    const parsed = caminoSchema.safeParse({
      slug: formData.get('slug') ?? '',
      name: formData.get('name') ?? '',
      description: formData.get('description') ?? '',
      categoryId: formData.get('categoryId') ?? '',
      iconKey: formData.get('iconKey') ?? '',
      isHiddenUntilDiscovered: formData.get('isHiddenUntilDiscovered') === 'on',
      isActive: formData.get('isActive') === 'on',
    })
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }
    const d = parsed.data
    const data = {
      name: d.name,
      description: d.description,
      categoryId: d.categoryId,
      iconKey: d.iconKey || null,
      isHiddenUntilDiscovered: d.isHiddenUntilDiscovered,
      isActive: d.isActive,
    }
    if (id) {
      await prisma.pathway.update({ where: { id }, data: { ...data, slug: d.slug } })
    } else {
      await prisma.pathway.create({ data: { ...data, slug: d.slug } })
    }
    await sincronizarUmbralesFases(prisma)
    revalidatePath('/admin/caminos')
    revalidatePath('/coleccion')
    return { ok: true, error: null }
  } catch (err: unknown) {
    if (err instanceof NoAutorizadoError) return { ok: false, error: 'No autorizado.' }
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      return { ok: false, error: 'Ya existe un camino con ese identificador (slug).' }
    }
    console.error('[guardarCamino]', err)
    return { ok: false, error: 'No se pudo guardar el camino.' }
  }
}

export async function guardarSecuencia(
  _prev: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirAdminAccion()
    const parsed = secuenciaSchema.safeParse({
      pathwayId: formData.get('pathwayId') ?? '',
      number: formData.get('number') ?? '',
      name: formData.get('name') ?? '',
      description: formData.get('description') ?? '',
      elementId: formData.get('elementId') ?? '',
      crearRecetaNormal: formData.get('crearRecetaNormal') === 'on',
      ingrediente1Id: formData.get('ingrediente1Id') ?? '',
      ingrediente2Id: formData.get('ingrediente2Id') ?? '',
    })
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }
    const d = parsed.data

    if (d.crearRecetaNormal) {
      const ingredientes =
        d.ingrediente1Id === d.ingrediente2Id
          ? [{ elementId: d.ingrediente1Id, quantity: 2 }]
          : [
              { elementId: d.ingrediente1Id, quantity: 1 },
              { elementId: d.ingrediente2Id, quantity: 1 },
            ]
      const { existente } = await buscarRecetaEquivalente(prisma, ingredientes)
      if (existente) {
        const yaLoProduce = existente.outputs.some((o) => o.elementId === d.elementId)
        if (!yaLoProduce) {
          const nombres = existente.outputs.map((o) => o.element.name).join(', ')
          return {
            ok: false,
            error: `Esa combinación ya tiene receta (produce ${nombres}). Elige otra combinación.`,
          }
        }
      } else {
        await crearReceta(prisma, {
          outputs: [{ elementId: d.elementId, quantity: 1, chance: 1.0, sortOrder: 0 }],
          ingredientes,
        })
      }
    }

    // Un elemento solo puede representar una secuencia: upsert por elementId.
    await prisma.sequence.upsert({
      where: { elementId: d.elementId },
      update: {
        pathwayId: d.pathwayId,
        number: d.number,
        name: d.name,
        description: d.description || null,
      },
      create: {
        pathwayId: d.pathwayId,
        number: d.number,
        name: d.name,
        description: d.description || null,
        elementId: d.elementId,
      },
    })
    await sincronizarUmbralesFases(prisma)
    revalidatePath('/admin/caminos')
    revalidatePath('/coleccion')
    return { ok: true, error: null }
  } catch (err: unknown) {
    if (err instanceof NoAutorizadoError) return { ok: false, error: 'No autorizado.' }
    if (err instanceof RecetaError) return { ok: false, error: err.message }
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      return { ok: false, error: 'Ese camino ya tiene una secuencia con ese número.' }
    }
    console.error('[guardarSecuencia]', err)
    return { ok: false, error: 'No se pudo guardar la secuencia.' }
  }
}

export async function eliminarSecuencia(id: string): Promise<void> {
  await exigirAdminAccion()
  await prisma.sequence.delete({ where: { id } }).catch(() => null)
  await sincronizarUmbralesFases(prisma)
  revalidatePath('/admin/caminos')
  revalidatePath('/coleccion')
}
