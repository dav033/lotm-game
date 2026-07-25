// Sonda temporal: escucha el stream de produccion por HTTPS. Se borra al terminar.
const started = Date.now()
const at = () => `+${String(Date.now() - started).padStart(6)}ms`

const response = await fetch('https://lotm.marosconstruction.com/api/cards/live/stream', {
  headers: { Accept: 'text/event-stream' },
})
console.log(at(), 'stream:', response.status, response.headers.get('content-type'))

const reader = response.body.getReader()
const decoder = new TextDecoder()
const deadline = Date.now() + 20000

while (Date.now() < deadline) {
  const { value, done } = await Promise.race([
    reader.read(),
    new Promise((r) => setTimeout(() => r({ value: null, done: false }), 500)),
  ])
  if (done) break
  if (!value) continue
  for (const line of decoder.decode(value).split('\n')) {
    if (line.trim()) console.log(at(), 'RX', line)
  }
}
await reader.cancel()
console.log(at(), 'fin')
