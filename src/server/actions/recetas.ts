'use server'

import { revalidatePath } from 'next/cache'
import { exigirAdminAccion, NoAutorizadoError } from '../adminAuth'
import { prisma } from '../db'
import { generarSlug } from '../domain/slug'
import { recetaSchema } from '../schemas'
import {
  actualizarReceta,
  buscarRecetaEquivalente,
  crearReceta,
  derivarInputKey,
  RecetaError,
} from '../services/recetas'
import type { EstadoAccion } from './tipos'

export type RecetaOutputFormData = {
  elementId: string
  quantity: number
  chance: number
  sortOrder: number
}

// Vínculo opcional del primer resultado con un camino (existente o nuevo).
export type RecetaCaminoFormData = {
  pathwayId: string
  nuevoNombre: string
  nuevaCategoriaId: string
  numero: number
  nombreSecuencia: string
}

export type RecetaFormData = {
  name: string
  outputs: RecetaOutputFormData[]
  successText: string
  hintText: string
  isActive: boolean
  ingredientes: { elementId: string; quantity: number }[]
  camino?: RecetaCaminoFormData | null
}

// Resuelve el camino del vínculo (creándolo si es nuevo). Devuelve su id.
async function resolverCaminoId(
  camino: RecetaCaminoFormData,
): Promise<{ pathwayId: string; error: null } | { pathwayId: null; error: string }> {
  if (camino.pathwayId) return { pathwayId: camino.pathwayId, error: null }
  if (!camino.nuevaCategoriaId) {
    return { pathwayId: null, error: 'Selecciona la categoría del camino nuevo.' }
  }
  const base = generarSlug(camino.nuevoNombre)
  if (!base) {
    return { pathwayId: null, error: 'El nombre del camino no produce un identificador válido.' }
  }
  let slug = base
  for (let i = 2; await prisma.pathway.findUnique({ where: { slug } }); i++) {
    if (i > 50) return { pathwayId: null, error: 'Demasiados caminos con ese nombre.' }
    slug = `${base}-${i}`
  }
  const nuevo = await prisma.pathway.create({
    data: {
      slug,
      name: camino.nuevoNombre,
      description: '',
      categoryId: camino.nuevaCategoriaId,
      isHiddenUntilDiscovered: true,
    },
  })
  return { pathwayId: nuevo.id, error: null }
}

// Receta cuyo único resultado es una secuencia: el elemento que la representa
// se crea automáticamente (BEYONDER, oculto, descubrimiento mayor) en la
// categoría del camino. Icono y textos pueden afinarse luego en «Elementos».
async function crearElementoDeSecuencia(
  nombre: string,
  pathwayId: string,
): Promise<{ elementId: string; error: null } | { elementId: null; error: string }> {
  const base = generarSlug(nombre)
  if (!base) {
    return { elementId: null, error: 'El nombre de la secuencia no produce un identificador válido.' }
  }
  let slug = base
  for (let i = 2; await prisma.element.findUnique({ where: { slug } }); i++) {
    if (i > 50) return { elementId: null, error: 'Demasiados elementos con ese nombre.' }
    slug = `${base}-${i}`
  }
  const elemento = await prisma.element.create({
    data: {
      slug,
      name: nombre,
      description: '',
      iconKey: 'sparkles',
      type: 'BEYONDER',
      tier: 3,
      isMajorDiscovery: true,
    },
  })
  const camino = await prisma.pathway.findUnique({ where: { id: pathwayId } })
  if (camino) {
    await prisma.elementCategory.create({
      data: { elementId: elemento.id, categoryId: camino.categoryId, isPrimary: true },
    })
  }
  return { elementId: elemento.id, error: null }
}

// Vincula (o reasigna) el elemento como secuencia del camino.
async function vincularSecuencia(
  elementId: string,
  pathwayId: string,
  numero: number,
  nombreSecuencia: string,
): Promise<string | null> {
  const elemento = await prisma.element.findUnique({ where: { id: elementId } })
  if (!elemento) return 'El elemento resultado no existe.'
  const name = nombreSecuencia || elemento.name
  await prisma.sequence.upsert({
    where: { elementId },
    update: { pathwayId, number: numero, name },
    create: { pathwayId, number: numero, name, elementId },
  })
  return null
}

export async function guardarReceta(
  id: string | null,
  datos: RecetaFormData,
): Promise<EstadoAccion & { recetaId?: string }> {
  try {
    await exigirAdminAccion()
    const parsed = recetaSchema.safeParse(datos)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }
    const d = parsed.data
    const conCamino =
      d.camino && (d.camino.pathwayId || d.camino.nuevoNombre) ? d.camino : null

    let pathwayId: string | null = null
    if (conCamino) {
      const res = await resolverCaminoId(conCamino)
      if (res.error !== null) return { ok: false, error: res.error }
      pathwayId = res.pathwayId
    }

    // Receta cuyo único resultado es la secuencia: el elemento se crea solo.
    let outputs = d.outputs
    if (outputs.length === 0) {
      if (!conCamino || !pathwayId || !conCamino.nombreSecuencia.trim()) {
        return {
          ok: false,
          error: 'Añade un resultado, o vincula un camino e indica el nombre de la secuencia.',
        }
      }
      // Validar la combinación ANTES de crear el elemento, para no dejar
      // elementos huérfanos si la receta equivalente ya existe.
      const { existente } = await buscarRecetaEquivalente(prisma, d.ingredientes, id ?? undefined)
      if (existente) {
        const nombres = existente.outputs.map((o) => o.element.name).join(', ')
        return { ok: false, error: `Ya existe una receta equivalente (produce ${nombres}).` }
      }
      const creado = await crearElementoDeSecuencia(conCamino.nombreSecuencia.trim(), pathwayId)
      if (creado.error !== null) return { ok: false, error: creado.error }
      outputs = [{ elementId: creado.elementId, quantity: 1, chance: 1.0, sortOrder: 0 }]
      revalidatePath('/admin/elementos')
    }

    const receta = id
      ? await actualizarReceta(prisma, id, { ...d, outputs })
      : await crearReceta(prisma, { ...d, outputs })

    // Vínculo con el camino: la secuencia recae en el primer resultado.
    if (conCamino && pathwayId) {
      const errorCamino = await vincularSecuencia(
        outputs[0].elementId,
        pathwayId,
        conCamino.numero,
        conCamino.nombreSecuencia,
      )
      if (errorCamino) {
        return {
          ok: false,
          error: `La receta se guardó, pero el camino no: ${errorCamino}`,
          recetaId: receta.id,
        }
      }
      revalidatePath('/admin/caminos')
      revalidatePath('/coleccion')
    }

    // La receta funciona en el juego inmediatamente: el juego consulta la base
    // en cada combinación, así que no hay nada que reconstruir.
    revalidatePath('/admin/recetas')
    revalidatePath('/admin/combinaciones-fallidas')
    return { ok: true, error: null, recetaId: receta.id }
  } catch (err) {
    if (err instanceof NoAutorizadoError) return { ok: false, error: 'No autorizado.' }
    if (err instanceof RecetaError) return { ok: false, error: err.message }
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      return { ok: false, error: 'El camino ya tiene una secuencia con ese número.' }
    }
    console.error('[guardarReceta]', err)
    return { ok: false, error: 'No se pudo guardar la receta.' }
  }
}

// Previsualización en vivo del constructor: inputKey calculada y aviso de
// receta equivalente existente (Ojo + Visión == Visión + Ojo).
export async function previsualizarReceta(
  ingredientes: { elementId: string; quantity: number }[],
  excluirRecetaId?: string,
): Promise<{ inputKey: string | null; existente: { id: string; outputs: { elementId: string; quantity: number; chance: number; sortOrder: number }[]; successText: string | null; hintText: string | null; isActive: boolean } | null; error: string | null }> {
  try {
    await exigirAdminAccion()
    if (ingredientes.length === 0) return { inputKey: null, existente: null, error: null }
    const { inputKey, existente } = await buscarRecetaEquivalente(
      prisma,
      ingredientes,
      excluirRecetaId,
    )
    return {
      inputKey,
      existente: existente
        ? {
            id: existente.id,
            outputs: existente.outputs.map((o) => ({
              elementId: o.elementId,
              quantity: o.quantity,
              chance: o.chance,
              sortOrder: o.sortOrder,
            })),
            successText: existente.successText,
            hintText: existente.hintText,
            isActive: existente.isActive,
          }
        : null,
      error: null,
    }
  } catch (err) {
    if (err instanceof RecetaError) return { inputKey: null, existente: null, error: err.message }
    console.error('[previsualizarReceta]', err)
    return { inputKey: null, existente: null, error: 'No se pudo calcular la combinación.' }
  }
}

// «Probar» desde el formulario: ¿qué produciría hoy esta combinación en el juego?
export async function probarCombinacion(
  ingredientes: { elementId: string; quantity: number }[],
): Promise<{ mensaje: string }> {
  try {
    await exigirAdminAccion()
    if (ingredientes.length === 0) return { mensaje: 'Añade ingredientes para probar.' }
    const inputKey = await derivarInputKey(prisma, ingredientes)
    const receta = await prisma.recipe.findFirst({
      where: { inputKey, isActive: true },
      include: { outputs: { include: { element: { select: { name: true, isActive: true } } } } },
    })
    const activeOutputs = receta?.outputs.filter((o) => o.element.isActive) ?? []
    if (!receta || activeOutputs.length === 0) {
      return { mensaje: `«${inputKey}» → La combinación no responde.` }
    }
    const outputNames = activeOutputs.map((o) => o.element.name).join(', ')
    return { mensaje: `«${inputKey}» → produce ${outputNames}.` }
  } catch (err) {
    if (err instanceof RecetaError) return { mensaje: err.message }
    console.error('[probarCombinacion]', err)
    return { mensaje: 'No se pudo probar la combinación.' }
  }
}

export async function alternarRecetaActiva(id: string): Promise<void> {
  await exigirAdminAccion()
  const r = await prisma.recipe.findUnique({
    where: { id },
    include: { outputs: { select: { elementId: true } } },
  })
  if (!r) return
  if (!r.isActive) {
    const protectedTarget = await prisma.advance.findFirst({
      where: {
        isActive: true,
        targetSequence: { elementId: { in: r.outputs.map((output) => output.elementId) } },
      },
      select: { id: true },
    })
    if (protectedTarget) return
  }
  await prisma.recipe.update({ where: { id }, data: { isActive: !r.isActive } })
  revalidatePath('/admin/recetas')
}

export async function eliminarReceta(id: string): Promise<EstadoAccion> {
  try {
    await exigirAdminAccion()
    const r = await prisma.recipe.findUnique({ where: { id } })
    if (!r) return { ok: false, error: 'La receta no existe.' }

    await prisma.recipe.delete({ where: { id } })
    revalidatePath('/admin/recetas')
    revalidatePath('/coleccion')
    return { ok: true, error: null }
  } catch (err) {
    if (err instanceof NoAutorizadoError) return { ok: false, error: 'No autorizado.' }
    console.error('[eliminarReceta]', err)
    return { ok: false, error: 'No se pudo eliminar la receta.' }
  }
}
