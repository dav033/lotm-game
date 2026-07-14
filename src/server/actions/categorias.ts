'use server'

import { revalidatePath } from 'next/cache'
import { exigirAdminAccion, NoAutorizadoError } from '../adminAuth'
import { prisma } from '../db'
import { categoriaSchema } from '../schemas'
import type { EstadoAccion } from './tipos'

// ¿candidatoId es descendiente de (o igual a) categoriaId?
async function esDescendiente(categoriaId: string, candidatoId: string): Promise<boolean> {
  let actual: string | null = candidatoId
  for (let i = 0; actual && i < 20; i++) {
    if (actual === categoriaId) return true
    const cat: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: actual },
      select: { parentId: true },
    })
    actual = cat?.parentId ?? null
  }
  return false
}

export async function guardarCategoria(
  id: string | null,
  _prev: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirAdminAccion()
    const parsed = categoriaSchema.safeParse({
      slug: formData.get('slug') ?? '',
      name: formData.get('name') ?? '',
      description: formData.get('description') ?? '',
      parentId: formData.get('parentId') ?? '',
      sortOrder: formData.get('sortOrder') ?? 0,
      isHidden: formData.get('isHidden') === 'on',
      isActive: formData.get('isActive') === 'on',
    })
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }
    const d = parsed.data

    if (id && d.parentId && (await esDescendiente(id, d.parentId))) {
      return { ok: false, error: 'Una categoría no puede colgar de sí misma ni de una descendiente.' }
    }

    const data = {
      name: d.name,
      description: d.description || null,
      parentId: d.parentId || null,
      sortOrder: d.sortOrder,
      isHidden: d.isHidden,
      isActive: d.isActive,
    }
    if (id) {
      await prisma.category.update({ where: { id }, data: { ...data, slug: d.slug } })
    } else {
      await prisma.category.create({ data: { ...data, slug: d.slug } })
    }
    revalidatePath('/admin/categorias')
    revalidatePath('/coleccion')
    return { ok: true, error: null }
  } catch (err: unknown) {
    if (err instanceof NoAutorizadoError) return { ok: false, error: 'No autorizado.' }
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      return { ok: false, error: 'Ya existe una categoría con ese identificador (slug).' }
    }
    console.error('[guardarCategoria]', err)
    return { ok: false, error: 'No se pudo guardar la categoría.' }
  }
}
