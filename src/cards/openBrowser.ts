import { exec } from 'node:child_process'

// Dedup por URL para todo el proceso: el MCP HTTP crea un McpServer nuevo por
// request (transporte sin sesion), asi que la deduplicacion no puede vivir en
// una instancia — vive aca para cubrir tanto stdio (un proceso, un server)
// como http (un proceso, muchos servers).
const openedUrls = new Set<string>()

// No hay forma multiplataforma nativa en Node de abrir el navegador por defecto
// del usuario; cada SO expone su propio comando de shell para eso.
export function openBrowserOnce(url: string): void {
  if (openedUrls.has(url)) return
  openedUrls.add(url)
  const command = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`
  exec(command, (error) => {
    if (error) console.error('[cards-mcp] No se pudo abrir el navegador:', error.message)
  })
}
