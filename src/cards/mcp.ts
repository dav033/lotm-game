import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  DeleteCardsSchema,
  ExportCardsSchema,
  ListCardLibrarySchema,
  MoveCardsSchema,
  SaveCardBatchSchema,
  SaveCardImageSchema,
  UpdateCardSchema,
} from './schema'
import { storeCardImage } from './images'
import { exportCardsToZip } from './export'
import { openBrowserOnce } from './openBrowser'
import type { CardRepository, StoredCard } from './repository'

type McpOptions = {
  repository: CardRepository
  downloadBaseUrl?: string
  // Si se define, la primera vez que se guarde o edite una carta en este
  // proceso se abre esta URL en el navegador del usuario (ver openBrowser.ts).
  liveViewUrl?: string
}

// Este servidor no avisa de los cambios: la app observa la revision de cards.db
// desde su propio stream, asi que la vista en vivo refleja por igual lo que
// escriba este proceso, otro servidor MCP o el propio editor.
export function createCardsMcpServer({ repository, downloadBaseUrl, liveViewUrl }: McpOptions): McpServer {
  const openLiveViewOnce = () => {
    if (liveViewUrl) openBrowserOnce(liveViewUrl)
  }

  const server = new McpServer(
    { name: 'lotm-card-studio', version: '1.2.0' },
    {
      instructions:
        'Este servidor solo administra y exporta cartas. Organiza cada lote por anime/universo y por secciones ' +
        '(las "partes"), que son los grupos en que se divide un universo. ' +
        'Guarda contenido textual y referencias de imagen en un SQLite separado; nunca guarda binarios en la base. ' +
        'Flujo recomendado: save_card_batch, list_card_library y export_cards_zip. ' +
        'Para dividir o reagrupar cartas que ya existen usa move_cards: crea la seccion destino si hace falta y ' +
        'conserva los ids, asi que nunca hay que borrar y volver a crear para reorganizar. ' +
        'Para usar una imagen propia (generada o local) llama antes a save_card_image y pon la ruta que ' +
        'devuelve en imageUrl, topImageUrl, mainImageUrl o backgroundImageUrl.',
    },
  )

  server.registerTool(
    'save_card_batch',
    {
      title: 'Guardar lote de cartas',
      description:
        'Crea o reutiliza un anime/universo y una parte, y agrega hasta 100 cartas. ' +
        'Acepta Character, Artifact, Cover, Full Image Cover, Tier, Pathway, Tier Explanation y General Explanation. ' +
        'Las explicaciones pueden ser generales o asociarse a uno de los 22 pathways. ' +
        'Las imagenes son solo URLs o rutas de /public.',
      inputSchema: SaveCardBatchSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => runTool(() => {
      const cards = repository.saveBatch(input)
      openLiveViewOnce()
      return {
        saved: cards.length,
        cards: cards.map(cardSummary),
      }
    }),
  )

  server.registerTool(
    'list_card_library',
    {
      title: 'Listar biblioteca de cartas',
      description:
        'Lista la biblioteca SQLite agrupada por anime/universo y parte. Puede filtrar por nombre o slug.',
      inputSchema: ListCardLibrarySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ includeContent, ...filter }) => runTool(() => {
      const library = repository.listLibrary(filter)
      if (includeContent) return { universes: library }
      return {
        universes: library.map((universe) => ({
          ...universe,
          parts: universe.parts.map((part) => ({
            ...part,
            cards: part.cards.map(cardSummary),
          })),
        })),
      }
    }),
  )

  server.registerTool(
    'update_card',
    {
      title: 'Actualizar una carta',
      description: 'Reemplaza el contenido de una carta existente sin cambiar su universo, parte ni posicion.',
      inputSchema: UpdateCardSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ cardId, card }) => runTool(() => {
      const updated = repository.updateCard(cardId, card)
      if (!updated) throw new Error(`No existe la carta ${cardId}.`)
      openLiveViewOnce()
      return { card: updated }
    }),
  )

  server.registerTool(
    'save_card_image',
    {
      title: 'Guardar una imagen para una carta',
      description:
        'Guarda una imagen y devuelve la ruta que hay que poner en imageUrl, topImageUrl, ' +
        'mainImageUrl o backgroundImageUrl al crear o actualizar una carta. ' +
        'Es el unico modo de usar una imagen propia: los campos de imagen solo aceptan URLs ' +
        'http(s) o rutas del sitio, nunca el binario en linea. ' +
        'El archivo se guarda junto a la base; en la carta queda solo su ruta.',
      inputSchema: SaveCardImageSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ mimeType, data }) => runTool(async () => {
      const bytes = Buffer.from(data, 'base64')
      if (!bytes.byteLength) throw new Error('El base64 no contiene datos de imagen.')
      const url = await storeCardImage(bytes, mimeType)
      return { url, bytes: bytes.byteLength }
    }),
  )

  server.registerTool(
    'move_cards',
    {
      title: 'Mover cartas a otra seccion',
      description:
        'Reagrupa cartas ya guardadas en otra seccion (parte) del mismo universo o de otro, creandola si no existe. ' +
        'Sirve para dividir una seccion grande en varias o para reordenarlas, sin borrar ni recrear: ' +
        'las cartas conservan su id y su contenido. El orden de cardIds es el que tendran dentro de la seccion.',
      inputSchema: MoveCardsSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ cardIds, ...target }) => runTool(() => {
      const moved = repository.moveCards(cardIds, target)
      openLiveViewOnce()
      return { moved: moved.length, cards: moved.map(cardSummary) }
    }),
  )

  server.registerTool(
    'delete_cards',
    {
      title: 'Eliminar cartas',
      description: 'Elimina definitivamente las cartas indicadas. No elimina universos ni partes.',
      inputSchema: DeleteCardsSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ cardIds }) => runTool(() => ({ deleted: repository.deleteCards(cardIds) })),
  )

  server.registerTool(
    'export_cards_zip',
    {
      title: 'Exportar cartas a ZIP',
      description:
        'Renderiza todas las cartas que coincidan con el filtro y genera un ZIP con PNG de 960x1280 ' +
        'organizados por universo/parte, mas manifest.json.',
      inputSchema: ExportCardsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ filename, ...filter }) => runTool(async () => {
      const result = await exportCardsToZip(repository.listCards(filter), filename)
      return {
        ...result,
        downloadUrl: downloadBaseUrl
          ? new URL(`/downloads/${encodeURIComponent(result.filename)}`, downloadBaseUrl).href
          : undefined,
      }
    }),
  )

  server.registerResource(
    'card-library',
    'cards://library',
    {
      title: 'Biblioteca de cartas',
      description: 'Contenido textual completo agrupado por universo y parte.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(repository.listLibrary(), null, 2) }],
    }),
  )

  return server
}

async function runTool(work: () => unknown | Promise<unknown>): Promise<CallToolResult> {
  try {
    const result = await work()
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  } catch (error) {
    return {
      isError: true,
      content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
    }
  }
}

function cardSummary(card: StoredCard) {
  return {
    id: card.id,
    position: card.position,
    type: card.type,
    title: card.title,
    universe: card.universe.name,
    part: card.part.name,
  }
}
