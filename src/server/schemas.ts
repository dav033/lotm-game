import { z } from 'zod'
import { elementTypeSchema } from './domain/tipos'

// Texto visible: longitud acotada y sin HTML arbitrario.
const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .refine((s) => !/[<>]/.test(s), 'No se permite HTML en este campo.')

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'El identificador es obligatorio.')
  .max(60)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Solo minúsculas, números y guiones; sin acentos ni espacios.',
  )

export const elementoSchema = z.object({
  slug: slugSchema,
  name: texto(80).refine((s) => s.length > 0, 'El nombre es obligatorio.'),
  description: texto(500).default(''),
  iconKey: z.string().trim().max(40).default('sparkles'),
  imageUrl: z
    .union([z.literal(''), z.string().trim().max(300).regex(/^(\/|https?:\/\/)/, 'Debe ser una ruta o URL.')])
    .default(''),
  type: elementTypeSchema,
  tier: z.coerce.number().int().min(0).max(99).default(0),
  isStarter: z.coerce.boolean().default(false),
  isHiddenUntilDiscovered: z.coerce.boolean().default(true),
  isMajorDiscovery: z.coerce.boolean().default(false),
  revealTitle: texto(120).default(''),
  revealText: texto(500).default(''),
  // Descubrimiento espontáneo: vacío = solo recetas; un tipo = se desbloquea
  // al descubrir un elemento de ese tipo; triggerIds = al descubrir
  // cualquiera de esos elementos concretos.
  unlockedByType: z.union([z.literal(''), elementTypeSchema]).default(''),
  unlockedBySequenceNumber: z.union([z.literal(''), z.coerce.number().int().min(0).max(99)]).default(''),
  triggerIds: z.array(z.string().min(1)).max(50).default([]),
  isActive: z.coerce.boolean().default(true),
  categoriaIds: z.array(z.string().min(1)).default([]),
  categoriaPrincipalId: z.string().default(''),
})

// Creación rápida desde el constructor de recetas: solo nombre y tipo; el
// resto (slug, icono, categoría) se deriva con valores sensatos.
export const elementoRapidoSchema = z.object({
  name: texto(80).refine((s) => s.length > 0, 'El nombre es obligatorio.'),
  type: elementTypeSchema,
})

export const categoriaSchema = z.object({
  slug: slugSchema,
  name: texto(80).refine((s) => s.length > 0, 'El nombre es obligatorio.'),
  description: texto(500).default(''),
  parentId: z.string().default(''),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isHidden: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
})

export const caminoSchema = z.object({
  slug: slugSchema,
  name: texto(80).refine((s) => s.length > 0, 'El nombre es obligatorio.'),
  description: texto(500).default(''),
  categoryId: z.string().min(1, 'Selecciona una categoría.'),
  iconKey: z.string().trim().max(40).default(''),
  isHiddenUntilDiscovered: z.coerce.boolean().default(true),
  isActive: z.coerce.boolean().default(true),
})

export const secuenciaSchema = z
  .object({
    pathwayId: z.string().min(1, 'Selecciona un camino.'),
    number: z.coerce.number().int().min(0).max(99),
    name: texto(80).refine((s) => s.length > 0, 'El nombre es obligatorio.'),
    description: texto(500).default(''),
    elementId: z.string().min(1, 'Selecciona el elemento que representa la secuencia.'),
    crearRecetaNormal: z.coerce.boolean().default(true),
    ingrediente1Id: z.string().default(''),
    ingrediente2Id: z.string().default(''),
  })
  .superRefine((data, ctx) => {
    if (data.crearRecetaNormal && (!data.ingrediente1Id || !data.ingrediente2Id)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Selecciona los dos ingredientes de la receta normal.',
      })
    }
  })

export const ingredienteSchema = z.object({
  elementId: z.string().min(1),
  quantity: z.coerce.number().int().min(1, 'La cantidad mínima es 1.').max(99),
})

export const recetaOutputSchema = z.object({
  elementId: z.string().min(1, 'Selecciona un elemento resultado.'),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
  chance: z.coerce.number().min(0).max(1).default(1.0),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
})

// Vínculo opcional del primer resultado de una receta con un camino: uno
// existente (pathwayId) o uno nuevo (nombre + categoría; el slug se deriva).
export const recetaCaminoSchema = z
  .object({
    pathwayId: z.string().default(''),
    nuevoNombre: texto(80).default(''),
    nuevaCategoriaId: z.string().default(''),
    numero: z.coerce.number().int().min(0).max(99).default(9),
    nombreSecuencia: texto(80).default(''),
  })
  .nullish()

export const recetaBaseSchema = z.object({
  name: texto(120).default(''),
  // Puede quedar vacío si la receta define camino + nombre de secuencia: en
  // ese caso el elemento resultado se crea automáticamente.
  outputs: z.array(recetaOutputSchema).max(10),
  successText: texto(300).default(''),
  hintText: texto(300).default(''),
  isActive: z.coerce.boolean().default(true),
  ingredientes: z
    .array(ingredienteSchema)
    .min(1, 'Añade al menos un ingrediente.')
    .max(8)
    .refine(
      (ings) => new Set(ings.map((i) => i.elementId)).size === ings.length,
      'Un mismo elemento no puede repetirse en dos filas; ajusta su cantidad.',
    ),
  camino: recetaCaminoSchema,
})

// La interfaz de la primera versión exige exactamente dos unidades en total
// (la base de datos y el dominio ya soportan más para el futuro).
export const recetaSchema = recetaBaseSchema
  .refine(
    (r) => r.ingredientes.reduce((s, i) => s + i.quantity, 0) === 2,
    'La receta debe usar exactamente dos unidades en total (p. ej. Ojo × 2, o Ojo × 1 + Visión × 1).',
  )
  .refine(
    (r) =>
      r.outputs.length > 0 ||
      (r.camino != null &&
        (r.camino.pathwayId !== '' || r.camino.nuevoNombre !== '') &&
        r.camino.nombreSecuencia.trim() !== ''),
    'Añade al menos un resultado, o vincula un camino e indica el nombre de la secuencia para crear su elemento automáticamente.',
  )

export const avanceSchema = z
  .object({
    internalName: texto(120).refine((s) => s.length > 0, 'El nombre interno es obligatorio.'),
    ingredientAId: z.string().min(1, 'Selecciona el primer ingrediente.'),
    ingredientBId: z.string().min(1, 'Selecciona el segundo ingrediente.'),
    sourceSequenceId: z.string().min(1, 'Selecciona la secuencia requerida.'),
    targetSequenceId: z.string().min(1, 'Selecciona la secuencia que se descubrirá.'),
    isActive: z.coerce.boolean().default(true),
  })
  .refine((data) => data.sourceSequenceId !== data.targetSequenceId, {
    message: 'La secuencia requerida y la secuencia descubierta deben ser distintas.',
  })

export const logroSchema = z.object({
  slug: slugSchema,
  name: texto(100).refine((value) => value.length > 0, 'El nombre es obligatorio.'),
  description: texto(500).default(''),
  iconKey: z.string().trim().min(1).max(40).default('trophy'),
  triggerType: z.enum(['ELEMENT', 'SEQUENCE']),
  triggerId: z.string().min(1, 'Selecciona el desencadenante.'),
  isHiddenUntilUnlocked: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
})

export const ritualSchema = z.object({
  name: texto(120).refine((value) => value.length > 0, 'El nombre es obligatorio.'),
  ingredientAId: z.string().min(1, 'Selecciona el primer concepto.'),
  ingredientBId: z.string().min(1, 'Selecciona el segundo concepto.'),
  advanceId: z.string().min(1, 'Selecciona el avance protegido.'),
  requiredSequenceNumber: z.coerce.number().int().min(0).max(99).default(6),
  failureOutputIds: z.array(z.string().min(1)).max(20).default([]),
  isActive: z.coerce.boolean().default(true),
})

// ---------- Importación / exportación ----------

export const importCategoriaSchema = z.object({
  slug: slugSchema,
  name: texto(80),
  description: texto(500).nullish(),
  parentSlug: slugSchema.nullish(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isHidden: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export const importElementoSchema = z.object({
  slug: slugSchema,
  name: texto(80),
  description: texto(500).default(''),
  iconKey: z.string().trim().max(40).default('sparkles'),
  imageUrl: z.string().trim().max(300).nullish(),
  type: elementTypeSchema,
  tier: z.number().int().min(0).max(99).default(0),
  isStarter: z.boolean().default(false),
  isHiddenUntilDiscovered: z.boolean().default(true),
  isMajorDiscovery: z.boolean().default(false),
  revealTitle: texto(120).nullish(),
  revealText: texto(500).nullish(),
  unlockedByType: elementTypeSchema.nullish(),
  unlockedBySequenceNumber: z.number().int().min(0).max(99).nullish(),
  unlockedByElements: z.array(slugSchema).default([]),
  unlockedByAllElements: z.array(slugSchema).max(50).default([]),
  isActive: z.boolean().default(true),
  categorias: z
    .array(z.object({ slug: slugSchema, isPrimary: z.boolean().default(false) }))
    .default([]),
})

export const importCaminoSchema = z.object({
  slug: slugSchema,
  name: texto(80),
  description: texto(500).default(''),
  categorySlug: slugSchema,
  iconKey: z.string().trim().max(40).nullish(),
  isHiddenUntilDiscovered: z.boolean().default(true),
  isActive: z.boolean().default(true),
})

export const importSecuenciaSchema = z.object({
  pathwaySlug: slugSchema,
  number: z.number().int().min(0).max(99),
  name: texto(80),
  description: texto(500).nullish(),
  elementSlug: slugSchema,
})

export const importRecetaSchema = z.object({
  name: texto(120).nullish(),
  outputs: z
    .array(
      z.object({
        elementSlug: slugSchema,
        quantity: z.number().int().min(1).max(99).default(1),
        chance: z.number().min(0).max(1).default(1.0),
        sortOrder: z.number().int().min(0).max(999).default(0),
      }),
    )
    .min(1)
    .max(10),
  successText: texto(300).nullish(),
  hintText: texto(300).nullish(),
  isActive: z.boolean().default(true),
  ingredientes: z
    .array(z.object({ elementSlug: slugSchema, quantity: z.number().int().min(1).max(99) }))
    .min(1)
    .max(8),
})

export const importAvanceSchema = z.object({
  internalName: texto(120),
  pathwaySlug: slugSchema,
  sourceSequenceNumber: z.number().int().min(0).max(99),
  targetSequenceNumber: z.number().int().min(0).max(99),
  isActive: z.boolean().default(true),
  ingredientes: z
    .array(z.object({ elementSlug: slugSchema, quantity: z.number().int().min(1).max(2) }))
    .min(1)
    .max(2)
    .refine(
      (ingredients) => ingredients.reduce((total, ingredient) => total + ingredient.quantity, 0) === 2,
      'Un avance debe usar exactamente dos unidades.',
    ),
})

export const importRitualSchema = z.object({
  name: texto(120),
  requiredSequenceNumber: z.number().int().min(0).max(99).default(6),
  isActive: z.boolean().default(true),
  advanceIngredients: z
    .array(z.object({ elementSlug: slugSchema, quantity: z.number().int().min(1).max(2) }))
    .min(1)
    .max(2),
  ingredientes: z
    .array(z.object({ elementSlug: slugSchema, quantity: z.number().int().min(1).max(99) }))
    .min(1)
    .max(8),
  failureOutputSlugs: z.array(slugSchema).max(20).default([]),
})

const importLogroBaseSchema = {
  slug: slugSchema,
  name: texto(100),
  description: texto(500).default(''),
  iconKey: z.string().trim().min(1).max(40).default('trophy'),
  isHiddenUntilUnlocked: z.boolean().default(false),
  isActive: z.boolean().default(true),
}

export const importLogroSchema = z.discriminatedUnion('triggerType', [
  z.object({
    ...importLogroBaseSchema,
    triggerType: z.literal('ELEMENT'),
    triggerElementSlug: slugSchema,
  }),
  z.object({
    ...importLogroBaseSchema,
    triggerType: z.literal('SEQUENCE'),
    triggerPathwaySlug: slugSchema,
    triggerSequenceNumber: z.number().int().min(0).max(99),
  }),
])

export const importDocumentoSchema = z.object({
  version: z.literal(1),
  categorias: z.array(importCategoriaSchema).default([]),
  elementos: z.array(importElementoSchema).default([]),
  caminos: z.array(importCaminoSchema).default([]),
  secuencias: z.array(importSecuenciaSchema).default([]),
  recetas: z.array(importRecetaSchema).default([]),
  avances: z.array(importAvanceSchema).default([]),
  rituales: z.array(importRitualSchema).default([]),
  logros: z.array(importLogroSchema).default([]),
})

export type ImportDocumento = z.infer<typeof importDocumentoSchema>
