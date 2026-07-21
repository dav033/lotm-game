'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { phaseRuleElementSlugs, serializePhaseRule } from '@/shared/phaseRules'
import { FEATURE_KEYS } from '@/shared/featureGates'
import { exigirAdminAccion, NoAutorizadoError } from '../adminAuth'
import { prisma } from '../db'
import { faseSchema } from '../schemas'
import {
  sincronizarStartersConPrimeraFase,
  sincronizarUmbralesFases,
} from '../services/fasesProgresion'

function revalidarFases() {
  revalidatePath('/')
  revalidatePath('/admin/arbol')
  revalidatePath('/admin/diagnostico')
  revalidatePath('/coleccion')
}

const featureGateSchema = z.object({
  key: z.enum(FEATURE_KEYS),
  minimumPhaseSortOrder: z.coerce.number().int().min(1).max(9999),
})

export async function guardarFeatureGate(
  input: unknown,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    await exigirAdminAccion()
    const parsed = featureGateSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'Configuración de feature inválida.' }
    await prisma.$transaction(async (tx) => {
      await tx.featureGate.upsert({
        where: { key: parsed.data.key },
        update: { minimumPhaseSortOrder: parsed.data.minimumPhaseSortOrder },
        create: parsed.data,
      })
      await sincronizarUmbralesFases(tx)
    })
    revalidarFases()
    return { ok: true, error: null }
  } catch (error) {
    if (error instanceof NoAutorizadoError) return { ok: false, error: 'No autorizado.' }
    console.error('[guardarFeatureGate]', error)
    return { ok: false, error: 'No se pudo guardar la feature.' }
  }
}

export async function guardarFase(
  id: string | null,
  input: unknown,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    await exigirAdminAccion()
    const parsed = faseSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }
    const { advancementRule, ...phaseData } = parsed.data
    const requiredSlugs = phaseRuleElementSlugs(advancementRule)
    if (requiredSlugs.length > 0) {
      const existing = await prisma.element.count({ where: { slug: { in: requiredSlugs } } })
      if (existing !== requiredSlugs.length) {
        return { ok: false, error: 'La regla referencia elementos que no existen.' }
      }
    }
    const advancementRuleJson = serializePhaseRule(advancementRule)
    await prisma.$transaction(async (tx) => {
      if (id) {
        await tx.progressionPhase.update({
          where: { id },
          data: { ...phaseData, advancementRuleJson },
        })
      } else {
        // El cierre alcanzable lo fija la sincronización inmediatamente después.
        await tx.progressionPhase.create({
          data: { ...phaseData, advancementRuleJson, unlockAtDiscoveryCount: 0 },
        })
      }
      await sincronizarStartersConPrimeraFase(tx)
      await sincronizarUmbralesFases(tx)
    })
    revalidarFases()
    return { ok: true, error: null }
  } catch (error) {
    if (error instanceof NoAutorizadoError) return { ok: false, error: 'No autorizado.' }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return { ok: false, error: 'Ya existe una fase con ese slug o ese orden.' }
    }
    console.error('[guardarFase]', error)
    return { ok: false, error: 'No se pudo guardar la fase.' }
  }
}

export async function eliminarFase(id: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    await exigirAdminAccion()
    await prisma.$transaction(async (tx) => {
      // onDelete: SetNull; sus aperturas vuelven al pool global.
      await tx.progressionPhase.delete({ where: { id } })
      await sincronizarStartersConPrimeraFase(tx)
      await sincronizarUmbralesFases(tx)
    })
    revalidarFases()
    return { ok: true, error: null }
  } catch (error) {
    if (error instanceof NoAutorizadoError) return { ok: false, error: 'No autorizado.' }
    console.error('[eliminarFase]', error)
    return { ok: false, error: 'No se pudo eliminar la fase.' }
  }
}

const condicionesSchema = z.object({
  elementId: z.string().min(1),
  // null = sin condición de cantidad. Si además hay requisitos, deben
  // cumplirse AMBOS (regla AND de desbloqueoEspontaneo).
  unlockedAtDiscoveryCount: z.number().int().min(0).max(9999).nullable(),
  requiredElementIds: z.array(z.string().min(1)).max(50),
})

export async function guardarCondicionesDesbloqueo(
  elementId: string,
  condiciones: { unlockedAtDiscoveryCount: number | null; requiredElementIds: string[] },
): Promise<{ ok: boolean; error: string | null }> {
  try {
    await exigirAdminAccion()
    const parsed = condicionesSchema.safeParse({ elementId, ...condiciones })
    if (!parsed.success) return { ok: false, error: 'Condiciones de desbloqueo inválidas.' }
    const d = parsed.data
    const requeridos = [...new Set(d.requiredElementIds)].filter((id) => id !== d.elementId)

    await prisma.$transaction(async (tx) => {
      await tx.element.update({
        where: { id: d.elementId },
        data: { unlockedAtDiscoveryCount: d.unlockedAtDiscoveryCount },
      })
      await tx.elementUnlockRequirement.deleteMany({ where: { elementId: d.elementId } })
      if (requeridos.length > 0) {
        await tx.elementUnlockRequirement.createMany({
          data: requeridos.map((requiredElementId) => ({
            elementId: d.elementId,
            requiredElementId,
          })),
        })
      }
    })
    await sincronizarUmbralesFases(prisma)
    revalidarFases()
    return { ok: true, error: null }
  } catch (error) {
    if (error instanceof NoAutorizadoError) return { ok: false, error: 'No autorizado.' }
    console.error('[guardarCondicionesDesbloqueo]', error)
    return { ok: false, error: 'No se pudieron guardar las condiciones.' }
  }
}

const assignmentSchema = z.object({
  elementIds: z.array(z.string().min(1)).min(1).max(500),
  phaseId: z.string().min(1).nullable(),
})

export async function asignarElementosAFase(
  elementIds: string[],
  phaseId: string | null,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    await exigirAdminAccion()
    const parsed = assignmentSchema.safeParse({ elementIds, phaseId })
    if (!parsed.success) return { ok: false, error: 'Asignación de fase inválida.' }
    const ids = [...new Set(parsed.data.elementIds)]

    const assignmentError = await prisma.$transaction(async (tx) => {
      const [elementCount, phase] = await Promise.all([
        tx.element.count({ where: { id: { in: ids } } }),
        phaseId
          ? tx.progressionPhase.findUnique({ where: { id: phaseId }, select: { id: true } })
          : null,
      ])
      if (elementCount !== ids.length) return 'Alguno de los elementos no existe.'
      if (phaseId && !phase) return 'La fase seleccionada no existe.'

      await tx.element.updateMany({
        where: { id: { in: ids } },
        data: { availableFromPhaseId: phaseId },
      })
      await sincronizarStartersConPrimeraFase(tx)
      await sincronizarUmbralesFases(tx)
      return null
    })
    if (assignmentError) return { ok: false, error: assignmentError }
    revalidarFases()
    return { ok: true, error: null }
  } catch (error) {
    if (error instanceof NoAutorizadoError) return { ok: false, error: 'No autorizado.' }
    console.error('[asignarElementosAFase]', error)
    return { ok: false, error: 'No se pudieron guardar las aperturas.' }
  }
}
