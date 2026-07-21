import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { PATH_NAMES } from './pathways.js'
import { PATHWAY_BACKGROUNDS } from './pathwayBackgrounds.js'

test('asocia fondos existentes para los 22 pathways', () => {
  const backgrounds = PATHWAY_BACKGROUNDS as Record<string, string>
  const missing = PATH_NAMES.filter((pathway) => !backgrounds[pathway])

  assert.deepEqual(missing, [])
  assert.equal(Object.keys(backgrounds).length, 22)
  for (const source of Object.values(backgrounds)) {
    assert.equal(fs.existsSync(path.join(process.cwd(), 'public', source)), true, source)
  }
})
