import { z } from 'zod/v4'
import {
  PATH_NAMES,
  POWER_LEVELS,
  TIER_RANK_NAMES,
} from '../builder/data/pathways.js'

const enumFrom = (values: string[]) => z.enum(values as [string, ...string[]])

export const PathwayNameSchema = enumFrom(PATH_NAMES).describe(
  'Nombre canonico de uno de los 22 pathways de Lord of Mysteries.',
)
export const PowerLevelSchema = enumFrom(POWER_LEVELS.map(({ key }) => key)).describe(
  'Nivel de poder mostrado en una carta de personaje.',
)
export const TierRankSchema = enumFrom(TIER_RANK_NAMES).describe(
  'Rango de tier: S, A, B, C, D o F.',
)

const ImageSourceSchema = z
  .string()
  .trim()
  .max(2_048)
  .refine(
    (value) => /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value),
    'La imagen debe ser una URL http(s) o una ruta de /public que empiece por /.',
  )
  .describe(
    'URL http(s) o ruta publica de la imagen. SQLite guarda solo esta referencia textual, nunca el binario.',
  )

const SequenceSchema = z.object({
  pathway: PathwayNameSchema,
  sequence: z.int().min(0).max(9).describe('Secuencia entre 0 y 9.'),
})

const SharedStandardCardSchema = z.object({
  name: z.string().trim().min(1).max(80).describe('Nombre visible de la carta.'),
  pathway: PathwayNameSchema,
  sequence: z.int().min(0).max(9).describe('Secuencia principal entre 0 y 9.'),
  secondSequence: SequenceSchema.optional().describe(
    'Segundo pathway y secuencia para personajes o artefactos duales.',
  ),
  modifier: z.string().trim().max(80).optional().describe('Modificador opcional del poder o grado.'),
  alterDomain: z.string().trim().max(120).optional().describe('Dominio alternativo; por defecto, None.'),
  imageUrl: ImageSourceSchema.optional().describe('Ilustracion principal opcional.'),
})

export const CharacterCardSchema = SharedStandardCardSchema.extend({
  type: z.literal('Character'),
  power: PowerLevelSchema,
}).strict()

export const ArtifactCardSchema = SharedStandardCardSchema.extend({
  type: z.literal('Artifact'),
  grade: z.enum(['0', '1', '2', '3', '4', '5']).describe('Grado del artefacto, de 5 a 0.'),
}).strict()

export const CoverCardSchema = z
  .object({
    type: z.literal('Cover'),
    title: z.string().trim().min(1).max(80).describe('Anime o universo que cruza con Lord of Mysteries.'),
    partNumber: z.string().trim().min(1).max(20).describe('Numero o identificador visible de la parte.'),
    topImageUrl: ImageSourceSchema.optional().describe('Imagen superior opcional.'),
    mainImageUrl: ImageSourceSchema.optional().describe('Imagen principal opcional.'),
  })
  .strict()

export const FullImageCoverCardSchema = z
  .object({
    type: z.literal('Full Image Cover'),
    title: z.string().trim().min(1).max(100).describe('Titulo mostrado al pie de la portada.'),
    imageUrl: ImageSourceSchema.optional().describe('Imagen de cuerpo completo opcional.'),
  })
  .strict()

export const TierCardSchema = z
  .object({
    type: z.literal('Tier'),
    pathway: PathwayNameSchema,
    sequence: z.int().min(0).max(9).optional().describe(
      'Secuencia concreta opcional entre 0 y 9. Si se omite, aplica al pathway completo.',
    ),
    rank: TierRankSchema,
    points: z
      .array(z.string().trim().min(1).max(180))
      .max(14)
      .describe('Puntos de explicacion, uno por linea en la carta.'),
    footerText: z.string().trim().max(240).optional().describe(
      'Texto destacado opcional mostrado al pie de la carta.',
    ),
    backgroundImageUrl: ImageSourceSchema.optional().describe(
      'Imagen de fondo opcional, mostrada bajo un overlay oscuro.',
    ),
  })
  .strict()

export const PathwayCardSchema = z
  .object({
    type: z.literal('Pathway'),
    pathway: PathwayNameSchema,
    sequence: z.int().min(0).max(9).optional().describe(
      'Secuencia concreta opcional entre 0 y 9. Si se omite, aplica al pathway completo.',
    ),
    points: z
      .array(z.string().trim().min(1).max(180))
      .max(14)
      .describe('Puntos de explicacion, uno por linea en la carta.'),
    footerText: z.string().trim().max(240).optional().describe(
      'Texto destacado opcional mostrado al pie de la carta.',
    ),
    backgroundImageUrl: ImageSourceSchema.optional().describe(
      'Imagen de fondo opcional, mostrada bajo un overlay oscuro.',
    ),
  })
  .strict()

export const TierExplanationCardSchema = z
  .object({
    type: z.literal('Tier Explanation'),
    rank: TierRankSchema,
    description: z.string().trim().min(1).max(240).describe('Descripcion breve mostrada debajo del tier.'),
    backgroundImageUrl: ImageSourceSchema.optional().describe(
      'Imagen de fondo opcional, mostrada bajo un overlay oscuro.',
    ),
  })
  .strict()

export const GeneralExplanationCardSchema = z
  .object({
    type: z.literal('General Explanation'),
    title: z.string().trim().min(1).max(100).describe('Titulo principal de la explicacion.'),
    description: z.string().trim().min(1).max(800).describe('Texto explicativo general.'),
    pathway: PathwayNameSchema.optional().describe(
      'Pathway concreto opcional. Si se omite, la explicacion es general.',
    ),
  })
  .strict()

export const CardContentSchema = z.discriminatedUnion('type', [
  CharacterCardSchema,
  ArtifactCardSchema,
  CoverCardSchema,
  FullImageCoverCardSchema,
  TierCardSchema,
  PathwayCardSchema,
  TierExplanationCardSchema,
  GeneralExplanationCardSchema,
])

export type CardContent = z.infer<typeof CardContentSchema>

export const UniverseInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120).describe('Nombre del anime o universo.'),
    description: z.string().trim().max(4_000).optional().describe('Contexto textual opcional para la IA.'),
  })
  .strict()

export const PartInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120).describe('Nombre de la parte, arco o lote.'),
    number: z.int().positive().optional().describe('Orden numerico opcional dentro del universo.'),
    description: z.string().trim().max(4_000).optional().describe('Contexto textual opcional de esta parte.'),
  })
  .strict()

export const SaveCardBatchSchema = z
  .object({
    universe: UniverseInputSchema,
    part: PartInputSchema,
    cards: z.array(CardContentSchema).min(1).max(100).describe('Cartas que se agregaran en orden.'),
  })
  .strict()

export const CardFilterSchema = z
  .object({
    universe: z.string().trim().min(1).max(120).optional().describe('Nombre o slug del universo.'),
    part: z.string().trim().min(1).max(120).optional().describe('Nombre o slug de la parte.'),
  })
  .strict()

export const ListCardLibrarySchema = CardFilterSchema.extend({
  includeContent: z.boolean().default(true).describe('Incluye el contenido completo de cada carta.'),
})

export const UpdateCardSchema = z
  .object({
    cardId: z.uuid().describe('ID de la carta que se reemplazara.'),
    card: CardContentSchema,
  })
  .strict()

export const DeleteCardsSchema = z
  .object({
    cardIds: z.array(z.uuid()).min(1).max(100).describe('IDs de las cartas que se eliminaran.'),
  })
  .strict()

export const ExportCardsSchema = CardFilterSchema.extend({
  filename: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe('Nombre opcional del ZIP, sin ruta.'),
})

export type SaveCardBatchInput = z.infer<typeof SaveCardBatchSchema>
export type CardFilter = z.infer<typeof CardFilterSchema>

export type BuilderCardState = {
  type: 'Character' | 'Artifact' | 'Cover' | 'Full Image Cover' | 'Tier' | 'Pathway' | 'Tier Explanation' | 'General Explanation'
  name: string
  path: string
  seq: number
  hasSecond: boolean
  path2: string
  seq2: number
  power: string
  grade: string
  mod: string
  dom: string
  image: string | null
  coverImage1: string | null
  coverImage2: string | null
  coverTitle: string
  coverPartNum: string
  fullCoverImage: string | null
  fullCoverTitle: string
  tierPath: string
  tierSeq: number | null
  tierRank: string
  tierText: string
  tierFooterText: string
  tierBackgroundImage: string | null
  pathwayCardPath: string
  pathwayCardSeq: number | null
  pathwayCardText: string
  pathwayCardFooterText: string
  pathwayCardBackgroundImage: string | null
  explanationPath: string | null
  tierExplanationText: string
  tierExplanationBackgroundImage: string | null
  generalExplanationTitle: string
  generalExplanationText: string
}

const DEFAULT_BUILDER_STATE: BuilderCardState = {
  type: 'Character',
  name: '',
  path: 'Fool',
  seq: 9,
  hasSecond: false,
  path2: 'Fool',
  seq2: 9,
  power: 'Human',
  grade: '5',
  mod: '',
  dom: 'None',
  image: null,
  coverImage1: null,
  coverImage2: null,
  coverTitle: '',
  coverPartNum: '1',
  fullCoverImage: null,
  fullCoverTitle: '',
  tierPath: 'Fool',
  tierSeq: null,
  tierRank: 'S',
  tierText: '',
  tierFooterText: '',
  tierBackgroundImage: null,
  pathwayCardPath: 'Fool',
  pathwayCardSeq: null,
  pathwayCardText: '',
  pathwayCardFooterText: '',
  pathwayCardBackgroundImage: null,
  explanationPath: null,
  tierExplanationText: '',
  tierExplanationBackgroundImage: null,
  generalExplanationTitle: '',
  generalExplanationText: '',
}

export function toBuilderCardState(content: CardContent): BuilderCardState {
  const state = { ...DEFAULT_BUILDER_STATE, type: content.type }

  if (content.type === 'Cover') {
    return {
      ...state,
      coverTitle: content.title,
      coverPartNum: content.partNumber,
      coverImage1: content.topImageUrl ?? null,
      coverImage2: content.mainImageUrl ?? null,
    }
  }

  if (content.type === 'Full Image Cover') {
    return {
      ...state,
      fullCoverTitle: content.title,
      fullCoverImage: content.imageUrl ?? null,
    }
  }

  if (content.type === 'Tier') {
    return {
      ...state,
      tierPath: content.pathway,
      tierSeq: content.sequence ?? null,
      tierRank: content.rank,
      tierText: content.points.join('\n'),
      tierFooterText: content.footerText ?? '',
      tierBackgroundImage: content.backgroundImageUrl ?? null,
    }
  }

  if (content.type === 'Pathway') {
    return {
      ...state,
      pathwayCardPath: content.pathway,
      pathwayCardSeq: content.sequence ?? null,
      pathwayCardText: content.points.join('\n'),
      pathwayCardFooterText: content.footerText ?? '',
      pathwayCardBackgroundImage: content.backgroundImageUrl ?? null,
    }
  }

  if (content.type === 'Tier Explanation') {
    return {
      ...state,
      tierRank: content.rank,
      tierExplanationText: content.description,
      tierExplanationBackgroundImage: content.backgroundImageUrl ?? null,
    }
  }

  if (content.type === 'General Explanation') {
    return {
      ...state,
      explanationPath: content.pathway ?? null,
      generalExplanationTitle: content.title,
      generalExplanationText: content.description,
    }
  }

  return {
    ...state,
    name: content.name,
    path: content.pathway,
    seq: content.sequence,
    hasSecond: Boolean(content.secondSequence),
    path2: content.secondSequence?.pathway ?? 'Fool',
    seq2: content.secondSequence?.sequence ?? 9,
    power: content.type === 'Character' ? content.power : 'Human',
    grade: content.type === 'Artifact' ? content.grade : '5',
    mod: content.modifier ?? '',
    dom: content.alterDomain ?? 'None',
    image: content.imageUrl ?? null,
  }
}

export function titleForCard(content: CardContent): string {
  if (content.type === 'Cover') return `Pathways in ${content.title} - Part ${content.partNumber}`
  if (content.type === 'Full Image Cover') return content.title
  if (content.type === 'Tier') {
    return `${content.pathway}${content.sequence === undefined ? '' : ` Sequence ${content.sequence}`} - Tier ${content.rank}`
  }
  if (content.type === 'Pathway') {
    return `${content.pathway}${content.sequence === undefined ? '' : ` Sequence ${content.sequence}`} - Pathway`
  }
  if (content.type === 'Tier Explanation') {
    return `Tier ${content.rank} Explanation`
  }
  if (content.type === 'General Explanation') {
    return content.pathway ? `${content.title} - ${content.pathway}` : content.title
  }
  return content.name
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'sin-nombre'
}

export function filenameForCard(content: CardContent): string {
  if (content.type === 'Cover') return `${slugify(content.title)}_part-${slugify(content.partNumber)}`
  if (content.type === 'Full Image Cover') return `full-cover_${slugify(content.title)}`
  if (content.type === 'Tier') {
    const base = `tier-${content.rank.toLowerCase()}_${slugify(content.pathway)}`
    return content.sequence === undefined ? base : `${base}_seq-${content.sequence}`
  }
  if (content.type === 'Pathway') {
    const base = `pathway_${slugify(content.pathway)}`
    return content.sequence === undefined ? base : `${base}_seq-${content.sequence}`
  }
  if (content.type === 'Tier Explanation') {
    return `tier-explanation-${content.rank.toLowerCase()}`
  }
  if (content.type === 'General Explanation') {
    const base = `general-explanation_${slugify(content.title)}`
    return content.pathway ? `${base}_${slugify(content.pathway)}` : base
  }
  return `${slugify(content.name)}_seq-${content.sequence}`
}
