import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  DeleteCardsSchema,
  ExportCardsSchema,
  ListCardLibrarySchema,
  SaveCardBatchSchema,
  UpdateCardSchema,
} from './schema'
import { exportCardsToZip } from './export'
import type { CardRepository, StoredCard } from './repository'

type McpOptions = {
  repository: CardRepository
  downloadBaseUrl?: string
}

export function createCardsMcpServer({ repository, downloadBaseUrl }: McpOptions): McpServer {
  const server = new McpServer(
    { name: 'lotm-card-studio', version: '1.2.0' },
    {
      instructions:
        'Este servidor solo administra y exporta cartas. Organiza cada lote por anime/universo y parte. ' +
        'Guarda contenido textual y referencias de imagen en un SQLite separado; nunca guarda binarios en la base. ' +
        'Flujo recomendado: save_card_batch, list_card_library y export_cards_zip.',
    },
  )

  server.registerTool(
    'save_card_batch',
    {
      title: 'Guardar lote de cartas',
      description:
        'Crea o reutiliza un anime/universo y una parte, y agrega hasta 100 cartas. ' +
        'Acepta Character, Artifact, Cover, Full Image Cover, Tier, Tier Explanation y General Explanation. ' +
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
      return { card: updated }
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
