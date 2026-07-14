'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '../db'
import { exigirAdminAccion, NoAutorizadoError } from '../adminAuth'
import { logroSchema } from '../schemas'
import type { EstadoAccion } from './tipos'

export async function guardarLogro(
  id: string | null,
  _prev: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirAdminAccion()
    const parsed = logroSchema.safeParse({
      slug: formData.get('slug') ?? '',
      name: formData.get('name') ?? '',
      description: formData.get('description') ?? '',
      iconKey: formData.get('iconKey') ?? 'trophy',
      triggerType: formData.get('triggerType') ?? '',
      triggerId: formData.get('triggerId') ?? '',
      isHiddenUntilUnlocked: formData.get('isHiddenUntilUnlocked') === 'on',
      isActive: formData.get('isActive') === 'on',
    })
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }
    const data = parsed.data
    if (data.triggerType === 'ELEMENT') {
      const exists = await prisma.element.findUnique({ where: { id: data.triggerId }, select: { id: true } })
      if (!exists) return { ok: false, error: 'El elemento seleccionado no existe.' }
    } else {
      const exists = await prisma.sequence.findUnique({ where: { id: data.triggerId }, select: { id: true } })
      if (!exists) return { ok: false, error: 'La secuencia seleccionada no existe.' }
    }

    const values = {
      slug: data.slug,
      name: data.name,
      description: data.description,
      iconKey: data.iconKey,
      triggerElementId: data.triggerType === 'ELEMENT' ? data.triggerId : null,
      triggerSequenceId: data.triggerType === 'SEQUENCE' ? data.triggerId : null,
      isHiddenUntilUnlocked: data.isHiddenUntilUnlocked,
      isActive: data.isActive,
    }
    if (id) {
      await prisma.achievement.update({ where: { id }, data: values })
    } else {
      await prisma.achievement.create({ data: values })
    }
    revalidatePath('/admin')
    revalidatePath('/admin/logros')
    revalidatePath('/logros')
    return { ok: true, error: null }
  } catch (error: unknown) {
    if (error instanceof NoAutorizadoError) return { ok: false, error: 'No autorizado.' }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return { ok: false, error: 'Ya existe un logro con ese slug.' }
    }
    console.error('[guardarLogro]', error)
    return { ok: false, error: 'No se pudo guardar el logro.' }
  }
}

export async function alternarLogroActivo(id: string): Promise<void> {
  await exigirAdminAccion()
  const achievement = await prisma.achievement.findUnique({ where: { id } })
  if (!achievement) return
  await prisma.achievement.update({
    where: { id },
    data: { isActive: !achievement.isActive },
  })
  revalidatePath('/admin/logros')
  revalidatePath('/logros')
}

export async function eliminarLogro(id: string): Promise<void> {
  await exigirAdminAccion()
  await prisma.achievement.delete({ where: { id } })
  revalidatePath('/admin')
  revalidatePath('/admin/logros')
  revalidatePath('/logros')
}
