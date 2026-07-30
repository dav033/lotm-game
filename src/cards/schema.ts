import { z } from 'zod/v4'
import {
  PATH_NAMES,
  POWER_LEVELS,
  TIER_RANK_NAMES,
} from '../builder/data/pathways.js'
import { parseMapEntries } from '../builder/mapEntries'

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

const BackgroundOpacitySchema = z
  .int()
  .min(0)
  .max(100)
  .optional()
  .describe('Visibilidad de la imagen de fondo, de 0 (oculta) a 100 (maxima). Por defecto, 65.')

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
    backgroundOpacity: BackgroundOpacitySchema,
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
    backgroundOpacity: BackgroundOpacitySchema,
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
    backgroundOpacity: BackgroundOpacitySchema,
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
    backgroundImageUrl: ImageSourceSchema.optional().describe(
      'Imagen de fondo propia. Si se omite y hay pathway, la carta usa el arte de ese pathway.',
    ),
    backgroundOpacity: BackgroundOpacitySchema,
  })
  .strict()

export const PathwayExplanationCardSchema = z
  .object({
    type: z.literal('Pathway Explanation'),
    pathway: PathwayNameSchema,
    title: z.string().trim().min(1).max(100).describe(
      'Titulo de la carta. Envuelve la palabra o frase clave en *asteriscos* para resaltarla en color tier.',
    ),
    description: z.string().trim().min(1).max(240).describe('Texto breve mostrado bajo la regla.'),
    backgroundImageUrl: ImageSourceSchema.optional().describe(
      'Imagen de fondo propia. Si se omite, la carta usa el arte de su pathway.',
    ),
    backgroundOpacity: BackgroundOpacitySchema,
  })
  .strict()

export const BreakdownCardSchema = z
  .object({
    type: z.literal('Breakdown'),
    kicker: z.string().trim().max(40).optional().describe(
      'Etiqueta opcional sobre el titulo para agrupar cartas, p. ej. "Authority".',
    ),
    title: z.string().trim().min(1).max(60).describe('Nombre del concepto o autoridad explicada.'),
    does: z.string().trim().min(1).max(240).describe('Que hace este concepto (seccion DOES).'),
    doesNot: z.string().trim().min(1).max(240).describe('Que no hace, para evitar confusiones (seccion DOESN\'T).'),
    edgeLabel: z.string().trim().min(1).max(20).default('Edge').describe(
      'Etiqueta de la tercera seccion, p. ej. "Edge" o "Caps at".',
    ),
    edgeText: z.string().trim().min(1).max(240).describe(
      'Limite, matiz o dato clave de la tercera seccion, resaltado en color tier.',
    ),
    backgroundImageUrl: ImageSourceSchema.optional().describe(
      'Imagen de fondo opcional, mostrada bajo un velo oscuro.',
    ),
    backgroundOpacity: BackgroundOpacitySchema,
  })
  .strict()

const MapEntrySchema = z
  .object({
    tags: z.string().trim().max(120).describe(
      'Etiquetas de la fila unidas por " · ", p. ej. "Door · Change · King of Space-Time". Puede ir vacio.',
    ),
    value: z.string().trim().min(1).max(120).describe('El valor o resultado que corresponde a esas etiquetas.'),
  })
  .strict()

export const MapCardSchema = z
  .object({
    type: z.literal('Map'),
    title: z.string().trim().min(1).max(100).describe('Titulo de la carta, p. ej. "Where the powers come from".'),
    entries: z.array(MapEntrySchema).min(1).max(8).describe(
      'Filas de la carta, cada una con su etiqueta opcional y su valor.',
    ),
    footerText: z.string().trim().max(160).optional().describe(
      'Texto final opcional bajo una regla, p. ej. "Three roots. Seven powers."',
    ),
    pathway: PathwayNameSchema.optional().describe(
      'Pathway opcional del que la carta toma su color y su imagen de fondo. Si se omite, usa el dorado neutro.',
    ),
    backgroundImageUrl: ImageSourceSchema.optional().describe(
      'Imagen de fondo propia. Tiene prioridad sobre el fondo que aporta el pathway.',
    ),
    backgroundOpacity: BackgroundOpacitySchema,
  })
  .strict()

export const TarotMemberCardSchema = z
  .object({
    type: z.literal('Tarot Member'),
    variant: z.enum(['Portrait', 'Dossier', 'Contrast']).default('Portrait').describe(
      'Composicion visual: Portrait prioriza imagen y nombre; Dossier parece un expediente; Contrast divide percepcion y realidad.',
    ),
    name: z.string().trim().min(1).max(80).describe('Nombre o identidad que se explica.'),
    tarotTitle: z.string().trim().min(1).max(40).describe('Arcano o rol visible, p. ej. The Hanged Man.'),
    description: z.string().trim().min(1).max(360).describe(
      'Descripcion principal; en Contrast es lo que el Club percibe.',
    ),
    detailLabel: z.string().trim().min(1).max(36).default('Club function').describe(
      'Etiqueta de la segunda idea; en Contrast encabeza la realidad.',
    ),
    detailText: z.string().trim().min(1).max(280).describe('Segunda idea, funcion o contraste del personaje.'),
    footerText: z.string().trim().max(180).optional().describe('Remate final breve, divertido pero veraz.'),
    pathway: PathwayNameSchema.optional().describe('Pathway opcional que aporta el color de acento.'),
    imageUrl: ImageSourceSchema.optional().describe('Retrato o arte de fondo opcional.'),
    backgroundOpacity: BackgroundOpacitySchema,
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
  PathwayExplanationCardSchema,
  BreakdownCardSchema,
  MapCardSchema,
  TarotMemberCardSchema,
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

export const SaveCardImageSchema = z
  .object({
    mimeType: z
      .enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
      .describe('Tipo de la imagen que se envia.'),
    data: z
      .string()
      .min(1)
      .describe(
        'Contenido de la imagen en base64, sin el prefijo "data:...;base64,". ' +
        'Hasta 15 MB ya decodificados.',
      ),
  })
  .strict()

export const MoveCardsSchema = z
  .object({
    cardIds: z
      .array(z.uuid())
      .min(1)
      .max(100)
      .describe('IDs de las cartas que se moveran, en el orden que tendran dentro de la seccion.'),
    universe: UniverseInputSchema.optional().describe(
      'Universo destino. Si se omite, las cartas se quedan en el universo que ya tenian.',
    ),
    part: PartInputSchema.describe('Seccion destino. Se crea si no existe.'),
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
  type: 'Character' | 'Artifact' | 'Cover' | 'Full Image Cover' | 'Tier' | 'Pathway' | 'Tier Explanation' | 'General Explanation' | 'Pathway Explanation' | 'Breakdown' | 'Map' | 'Tarot Member'
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
  generalExplanationBackgroundImage: string | null
  pathwayExplanationPath: string
  pathwayExplanationTitle: string
  pathwayExplanationText: string
  pathwayExplanationBackgroundImage: string | null
  breakdownKicker: string
  breakdownTitle: string
  breakdownDoes: string
  breakdownDoesNot: string
  breakdownEdgeLabel: string
  breakdownEdgeText: string
  breakdownBackgroundImage: string | null
  mapTitle: string
  mapEntriesText: string
  mapFooterText: string
  mapPathway: string | null
  mapBackgroundImage: string | null
  tarotMemberVariant: 'Portrait' | 'Dossier' | 'Contrast'
  tarotMemberName: string
  tarotMemberTitle: string
  tarotMemberDescription: string
  tarotMemberDetailLabel: string
  tarotMemberDetailText: string
  tarotMemberFooterText: string
  tarotMemberPathway: string | null
  tarotMemberImage: string | null
  backgroundOpacity: number
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
  generalExplanationBackgroundImage: null,
  pathwayExplanationPath: 'Fool',
  pathwayExplanationTitle: '',
  pathwayExplanationText: '',
  pathwayExplanationBackgroundImage: null,
  breakdownKicker: '',
  breakdownTitle: '',
  breakdownDoes: '',
  breakdownDoesNot: '',
  breakdownEdgeLabel: 'Edge',
  breakdownEdgeText: '',
  breakdownBackgroundImage: null,
  mapTitle: '',
  mapEntriesText: '',
  mapFooterText: '',
  mapPathway: null,
  mapBackgroundImage: null,
  tarotMemberVariant: 'Portrait',
  tarotMemberName: '',
  tarotMemberTitle: '',
  tarotMemberDescription: '',
  tarotMemberDetailLabel: 'Club function',
  tarotMemberDetailText: '',
  tarotMemberFooterText: '',
  tarotMemberPathway: null,
  tarotMemberImage: null,
  backgroundOpacity: 65,
}

export function toBuilderCardState(content: CardContent): BuilderCardState {
  const state = {
    ...DEFAULT_BUILDER_STATE,
    type: content.type,
    backgroundOpacity: 'backgroundOpacity' in content ? content.backgroundOpacity ?? 65 : 65,
  }

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
      generalExplanationBackgroundImage: content.backgroundImageUrl ?? null,
    }
  }

  if (content.type === 'Pathway Explanation') {
    return {
      ...state,
      pathwayExplanationPath: content.pathway,
      pathwayExplanationTitle: content.title,
      pathwayExplanationText: content.description,
      pathwayExplanationBackgroundImage: content.backgroundImageUrl ?? null,
    }
  }

  if (content.type === 'Breakdown') {
    return {
      ...state,
      breakdownKicker: content.kicker ?? '',
      breakdownTitle: content.title,
      breakdownDoes: content.does,
      breakdownDoesNot: content.doesNot,
      breakdownEdgeLabel: content.edgeLabel,
      breakdownEdgeText: content.edgeText,
      breakdownBackgroundImage: content.backgroundImageUrl ?? null,
    }
  }

  if (content.type === 'Map') {
    return {
      ...state,
      mapTitle: content.title,
      mapEntriesText: content.entries
        .map(({ tags, value }) => (tags ? `${tags} -> ${value}` : value))
        .join('\n'),
      mapFooterText: content.footerText ?? '',
      mapPathway: content.pathway ?? null,
      mapBackgroundImage: content.backgroundImageUrl ?? null,
    }
  }

  if (content.type === 'Tarot Member') {
    return {
      ...state,
      tarotMemberVariant: content.variant,
      tarotMemberName: content.name,
      tarotMemberTitle: content.tarotTitle,
      tarotMemberDescription: content.description,
      tarotMemberDetailLabel: content.detailLabel,
      tarotMemberDetailText: content.detailText,
      tarotMemberFooterText: content.footerText ?? '',
      tarotMemberPathway: content.pathway ?? null,
      tarotMemberImage: content.imageUrl ?? null,
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

// Convierte el estado que edita la interfaz al formato validado que guarda el
// MCP. Las imagenes siguen siendo solo referencias URL/rutas publicas.
export function fromBuilderCardState(state: BuilderCardState): CardContent {
  if (state.type === 'Cover') {
    return {
      type: 'Cover',
      title: state.coverTitle.trim(),
      partNumber: state.coverPartNum.trim(),
      ...(state.coverImage1 ? { topImageUrl: state.coverImage1 } : {}),
      ...(state.coverImage2 ? { mainImageUrl: state.coverImage2 } : {}),
    }
  }
  if (state.type === 'Full Image Cover') {
    return {
      type: 'Full Image Cover',
      title: state.fullCoverTitle.trim(),
      ...(state.fullCoverImage ? { imageUrl: state.fullCoverImage } : {}),
    }
  }
  if (state.type === 'Tier') {
    return {
      type: 'Tier', pathway: state.tierPath, rank: state.tierRank as CardContent & { rank: string }['rank'],
      ...(state.tierSeq === null ? {} : { sequence: state.tierSeq }),
      points: state.tierText.split('\n').map((point) => point.trim()).filter(Boolean),
      ...(state.tierFooterText.trim() ? { footerText: state.tierFooterText.trim() } : {}),
      ...(state.tierBackgroundImage ? { backgroundImageUrl: state.tierBackgroundImage } : {}),
      backgroundOpacity: state.backgroundOpacity,
    }
  }
  if (state.type === 'Pathway') {
    return {
      type: 'Pathway', pathway: state.pathwayCardPath,
      ...(state.pathwayCardSeq === null ? {} : { sequence: state.pathwayCardSeq }),
      points: state.pathwayCardText.split('\n').map((point) => point.trim()).filter(Boolean),
      ...(state.pathwayCardFooterText.trim() ? { footerText: state.pathwayCardFooterText.trim() } : {}),
      ...(state.pathwayCardBackgroundImage ? { backgroundImageUrl: state.pathwayCardBackgroundImage } : {}),
      backgroundOpacity: state.backgroundOpacity,
    }
  }
  if (state.type === 'Tier Explanation') {
    return {
      type: 'Tier Explanation', rank: state.tierRank as CardContent & { rank: string }['rank'],
      description: state.tierExplanationText.trim(),
      ...(state.tierExplanationBackgroundImage ? { backgroundImageUrl: state.tierExplanationBackgroundImage } : {}),
      backgroundOpacity: state.backgroundOpacity,
    }
  }
  if (state.type === 'General Explanation') {
    return {
      type: 'General Explanation', title: state.generalExplanationTitle.trim(),
      description: state.generalExplanationText.trim(),
      ...(state.explanationPath ? { pathway: state.explanationPath } : {}),
      ...(state.generalExplanationBackgroundImage
        ? { backgroundImageUrl: state.generalExplanationBackgroundImage }
        : {}),
      backgroundOpacity: state.backgroundOpacity,
    }
  }
  if (state.type === 'Pathway Explanation') {
    return {
      type: 'Pathway Explanation',
      pathway: state.pathwayExplanationPath,
      title: state.pathwayExplanationTitle.trim(),
      description: state.pathwayExplanationText.trim(),
      ...(state.pathwayExplanationBackgroundImage
        ? { backgroundImageUrl: state.pathwayExplanationBackgroundImage }
        : {}),
      backgroundOpacity: state.backgroundOpacity,
    }
  }
  if (state.type === 'Breakdown') {
    return {
      type: 'Breakdown',
      ...(state.breakdownKicker.trim() ? { kicker: state.breakdownKicker.trim() } : {}),
      title: state.breakdownTitle.trim(),
      does: state.breakdownDoes.trim(),
      doesNot: state.breakdownDoesNot.trim(),
      edgeLabel: state.breakdownEdgeLabel.trim() || 'Edge',
      edgeText: state.breakdownEdgeText.trim(),
      ...(state.breakdownBackgroundImage ? { backgroundImageUrl: state.breakdownBackgroundImage } : {}),
      backgroundOpacity: state.backgroundOpacity,
    }
  }
  if (state.type === 'Map') {
    return {
      type: 'Map',
      title: state.mapTitle.trim(),
      entries: parseMapEntries(state.mapEntriesText),
      ...(state.mapFooterText.trim() ? { footerText: state.mapFooterText.trim() } : {}),
      ...(state.mapPathway ? { pathway: state.mapPathway } : {}),
      ...(state.mapBackgroundImage ? { backgroundImageUrl: state.mapBackgroundImage } : {}),
      backgroundOpacity: state.backgroundOpacity,
    }
  }
  if (state.type === 'Tarot Member') {
    return {
      type: 'Tarot Member',
      variant: state.tarotMemberVariant,
      name: state.tarotMemberName.trim(),
      tarotTitle: state.tarotMemberTitle.trim(),
      description: state.tarotMemberDescription.trim(),
      detailLabel: state.tarotMemberDetailLabel.trim() || 'Club function',
      detailText: state.tarotMemberDetailText.trim(),
      ...(state.tarotMemberFooterText.trim() ? { footerText: state.tarotMemberFooterText.trim() } : {}),
      ...(state.tarotMemberPathway ? { pathway: state.tarotMemberPathway } : {}),
      ...(state.tarotMemberImage ? { imageUrl: state.tarotMemberImage } : {}),
      backgroundOpacity: state.backgroundOpacity,
    }
  }
  const standard = {
    name: state.name.trim(),
    pathway: state.path,
    sequence: state.seq,
    ...(state.hasSecond ? { secondSequence: { pathway: state.path2, sequence: state.seq2 } } : {}),
    ...(state.mod.trim() ? { modifier: state.mod.trim() } : {}),
    ...(state.dom.trim() && state.dom !== 'None' ? { alterDomain: state.dom.trim() } : {}),
    ...(state.image ? { imageUrl: state.image } : {}),
  }
  if (state.type === 'Character') return { ...standard, type: 'Character', power: state.power }
  return { ...standard, type: 'Artifact', grade: state.grade as '0' | '1' | '2' | '3' | '4' | '5' }
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
  if (content.type === 'Pathway Explanation') {
    return `${content.pathway} - ${content.title.replace(/\*/g, '')}`
  }
  if (content.type === 'Breakdown') {
    return content.kicker ? `${content.kicker}: ${content.title}` : content.title
  }
  if (content.type === 'Map') {
    return content.title
  }
  if (content.type === 'Tarot Member') return `${content.tarotTitle}: ${content.name}`
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
  if (content.type === 'Pathway Explanation') {
    return `pathway-explanation_${slugify(content.pathway)}`
  }
  if (content.type === 'Breakdown') {
    return `breakdown_${slugify(content.title)}`
  }
  if (content.type === 'Map') {
    return `map_${slugify(content.title)}`
  }
  if (content.type === 'Tarot Member') {
    return `tarot-member_${slugify(content.tarotTitle)}_${slugify(content.name)}`
  }
  return `${slugify(content.name)}_seq-${content.sequence}`
}
