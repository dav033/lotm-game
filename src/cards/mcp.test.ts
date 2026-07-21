import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createCardsMcpServer } from './mcp'
import { CardRepository } from './repository'

test('expone herramientas MCP para guardar y consultar cartas', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lotm-cards-mcp-'))
  const repository = new CardRepository(path.join(directory, 'cards.db'))
  const server = createCardsMcpServer({ repository })
  const client = new Client({ name: 'cards-test', version: '1.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)])
  t.after(async () => {
    await client.close()
    await server.close()
    repository.close()
    await fs.rm(directory, { recursive: true, force: true })
  })

  const tools = await client.listTools()
  assert.deepEqual(
    tools.tools.map(({ name }) => name).sort(),
    ['delete_cards', 'export_cards_zip', 'list_card_library', 'save_card_batch', 'update_card'],
  )

  const saved = await client.callTool({
    name: 'save_card_batch',
    arguments: {
      universe: { name: 'Fate' },
      part: { name: 'Parte 1', number: 1 },
      cards: [
        { type: 'Cover', title: 'Fate', partNumber: '1' },
        {
          type: 'General Explanation',
          title: 'Pathways in Fate',
          description: 'Una explicación general del cruce.',
          pathway: 'Fool',
        },
        { type: 'Full Image Cover', title: 'Fate x LOTM', imageUrl: '/cover-default.jpg' },
      ],
    },
  })
  assert.equal(saved.isError, undefined)

  const listed = await client.callTool({
    name: 'list_card_library',
    arguments: { universe: 'fate', includeContent: true },
  })
  const content = (listed as { content: Array<{ type: string; text?: string }> }).content
  const text = content.find((item) => item.type === 'text')?.text
  assert.ok(text)
  assert.equal(JSON.parse(text).universes[0].parts[0].cards.length, 3)
})
