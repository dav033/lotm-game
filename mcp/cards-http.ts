import fs from 'node:fs/promises'
import path from 'node:path'
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CardRepository } from '../src/cards/repository'
import { resolveCardExportDir } from '../src/cards/export'
import { createCardsMcpServer } from '../src/cards/mcp'

try { process.loadEnvFile() } catch { /* .env is optional */ }

const host = process.env.CARDS_MCP_HOST || '127.0.0.1'
const port = Number(process.env.CARDS_MCP_PORT || 3_101)
const token = process.env.CARDS_MCP_TOKEN
const localHosts = new Set(['127.0.0.1', 'localhost', '::1'])

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('CARDS_MCP_PORT debe ser un puerto valido.')
}
if (!localHosts.has(host) && !token) {
  throw new Error('Define CARDS_MCP_TOKEN antes de exponer el servidor fuera de localhost.')
}

const allowedHosts = process.env.CARDS_MCP_ALLOWED_HOSTS
  ?.split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const app = createMcpExpressApp({ host, allowedHosts })
const repository = new CardRepository()
const publicHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host
const publicBaseUrl = process.env.CARDS_MCP_PUBLIC_URL || `http://${publicHost}:${port}`

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'lotm-card-studio' })
})

app.use('/mcp', (request, response, next) => {
  if (token && request.get('authorization') !== `Bearer ${token}`) {
    response.status(401).json({ error: 'No autorizado.' })
    return
  }
  next()
})

app.post('/mcp', async (request, response) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  const mcp = createCardsMcpServer({ repository, downloadBaseUrl: publicBaseUrl })
  response.on('close', () => void Promise.all([transport.close(), mcp.close()]))

  try {
    await mcp.connect(transport)
    await transport.handleRequest(request, response, request.body)
  } catch (error) {
    console.error('[cards-mcp:http]', error)
    if (!response.headersSent) {
      response.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      })
    }
  }
})

app.get('/mcp', (_request, response) => {
  response.status(405).set('Allow', 'POST').send('Method Not Allowed')
})

app.delete('/mcp', (_request, response) => {
  response.status(405).set('Allow', 'POST').send('Method Not Allowed')
})

app.get('/downloads/:filename', async (request, response) => {
  const filename = path.basename(request.params.filename)
  if (filename !== request.params.filename || !filename.endsWith('.zip')) {
    response.status(400).json({ error: 'Archivo invalido.' })
    return
  }

  const outputDir = resolveCardExportDir()
  const file = path.resolve(outputDir, filename)
  if (!file.startsWith(`${path.resolve(outputDir)}${path.sep}`)) {
    response.status(400).json({ error: 'Archivo invalido.' })
    return
  }

  try {
    await fs.access(file)
    response.download(file, filename)
  } catch {
    response.status(404).json({ error: 'Archivo no encontrado.' })
  }
})

const httpServer = app.listen(port, host, () => {
  console.log(`Cards MCP HTTP: ${publicBaseUrl}/mcp`)
})

httpServer.on('error', (error) => {
  console.error('[cards-mcp:http]', error)
  repository.close()
  process.exit(1)
})

async function shutdown() {
  await new Promise<void>((resolve, reject) => {
    httpServer.close((error) => error ? reject(error) : resolve())
  })
  repository.close()
}

process.once('SIGINT', () => void shutdown().finally(() => process.exit(0)))
process.once('SIGTERM', () => void shutdown().finally(() => process.exit(0)))
