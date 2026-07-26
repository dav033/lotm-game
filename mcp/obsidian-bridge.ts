import fs from 'node:fs'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

// Puente delante del MCP de Obsidian. Reexpone tal cual todas sus herramientas y
// anade la que falta: escribir binarios. `vault_write` solo acepta texto
// (`content: string`, "markdown text"), asi que por MCP no habia forma de dejar
// una imagen en el vault. La API REST del plugin si acepta binario en PUT, que es
// lo que usa aqui vault_write_binary.
//
// Al reexponer el resto, el cliente sigue viendo un unico servidor y no hay que
// configurar un segundo conector.
try { process.loadEnvFile() } catch { /* .env es opcional */ }

const vault = process.env.OBSIDIAN_VAULT
  || path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Documents', 'Obsidian Vault')
const puertoPlugin = Number(process.env.OBSIDIAN_PLUGIN_PORT || 27_123)
const puerto = Number(process.env.OBSIDIAN_BRIDGE_PORT || 27_125)
const host = process.env.OBSIDIAN_BRIDGE_HOST || '127.0.0.1'

const configPlugin = path.join(vault, '.obsidian', 'plugins', 'obsidian-local-rest-api', 'data.json')
if (!fs.existsSync(configPlugin)) {
  throw new Error(`No se encontro la configuracion del plugin en ${configPlugin}. Define OBSIDIAN_VAULT.`)
}
const apiKey = JSON.parse(fs.readFileSync(configPlugin, 'utf8')).apiKey as string
if (!apiKey) throw new Error('El plugin no tiene apiKey; abre Obsidian y activa Local REST API.')

const base = `http://127.0.0.1:${puertoPlugin}`
const cabeceras = { Authorization: `Bearer ${apiKey}` }

const TIPOS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
}
const MAX_BYTES = 25 * 1024 * 1024

const HERRAMIENTA_BINARIA = {
  name: 'vault_write_binary',
  description:
    'Crea o reemplaza un archivo binario del vault (imagen, PDF) a partir de su contenido en base64. '
    + 'Es la unica via para subir binarios: vault_write solo admite texto. '
    + 'Devuelve el enlace de Obsidian listo para pegar en una nota.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Ruta destino dentro del vault, con extension. Ej: "Lotm/assets/images/door.png".',
      },
      mimeType: {
        type: 'string',
        enum: Object.keys(TIPOS),
        description: 'Tipo del archivo que se envia.',
      },
      data: {
        type: 'string',
        description: 'Contenido en base64, sin el prefijo "data:...;base64,". Hasta 25 MB ya decodificados.',
      },
    },
    required: ['path', 'mimeType', 'data'],
    additionalProperties: false,
  },
}

async function escribirBinario(args: Record<string, unknown>) {
  const destino = String(args.path ?? '').replace(/^\/+/, '')
  const mimeType = String(args.mimeType ?? '')
  const data = String(args.data ?? '')

  if (!destino) throw new Error('Falta la ruta de destino.')
  // El vault vive detras de la API del plugin, pero un "../" en la ruta no debe
  // llegar siquiera a intentarlo.
  if (destino.split('/').some((parte) => parte === '..')) throw new Error(`Ruta no permitida: ${destino}`)
  const extension = TIPOS[mimeType]
  if (!extension) throw new Error(`Tipo no admitido: ${mimeType}`)

  const bytes = Buffer.from(data, 'base64')
  if (!bytes.byteLength) throw new Error('El base64 no contiene datos.')
  if (bytes.byteLength > MAX_BYTES) throw new Error('El archivo supera 25 MB.')

  const respuesta = await fetch(`${base}/vault/${destino.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'PUT',
    headers: { ...cabeceras, 'Content-Type': mimeType },
    body: new Uint8Array(bytes),
  })
  if (!respuesta.ok) {
    throw new Error(`El plugin rechazo la escritura (HTTP ${respuesta.status}): ${await respuesta.text()}`)
  }
  return { path: destino, bytes: bytes.byteLength, embed: `![[${destino}]]` }
}

// Cliente hacia el MCP del plugin, para reexponer sus herramientas.
const upstream = new Client({ name: 'obsidian-bridge', version: '1.0.0' })
await upstream.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp/`), {
  requestInit: { headers: cabeceras },
}))

const server = new Server(
  { name: 'obsidian-bridge', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const { tools } = await upstream.listTools()
  return { tools: [...tools, HERRAMIENTA_BINARIA] }
})

server.setRequestHandler(CallToolRequestSchema, async (peticion) => {
  const { name, arguments: args } = peticion.params
  if (name !== HERRAMIENTA_BINARIA.name) {
    return upstream.callTool({ name, arguments: args ?? {} })
  }
  try {
    const resultado = await escribirBinario(args ?? {})
    return { content: [{ type: 'text', text: JSON.stringify(resultado, null, 2) }] }
  } catch (error) {
    return {
      isError: true,
      content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
    }
  }
})

// El SDK valida la cabecera Host contra el DNS rebinding, asi que el dominio
// publico por el que entra ChatGPT tiene que declararse.
const allowedHosts = (process.env.OBSIDIAN_BRIDGE_ALLOWED_HOSTS || 'obsidian.marosconstruction.com')
  .split(',')
  .map((valor) => valor.trim())
  .filter(Boolean)
const app = createMcpExpressApp({ host, allowedHosts })
app.get('/health', (_peticion, respuesta) => respuesta.json({ ok: true, service: 'obsidian-bridge' }))

app.post('/mcp', async (peticion, respuesta) => {
  const transporte = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  respuesta.on('close', () => void transporte.close())
  try {
    await server.connect(transporte)
    await transporte.handleRequest(peticion, respuesta, peticion.body)
  } catch (error) {
    console.error('[obsidian-bridge]', error)
    if (!respuesta.headersSent) respuesta.status(500).json({ error: 'Error interno' })
  }
})

app.listen(puerto, host, () => {
  console.log(`Puente MCP de Obsidian: http://${host}:${puerto}/mcp`)
  console.log(`  vault:  ${vault}`)
  console.log(`  plugin: ${base}`)
})
