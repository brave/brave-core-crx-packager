import assert from 'node:assert/strict'
import test from 'node:test'
import tmp from 'tmp'
import fs from 'fs'

import { generateResourcesFile } from '../lib/adBlockRustUtils.js'

test('generateResourcesFile', async (t) => {
  const tmpfile = tmp.fileSync({ discardDescriptor: true })
  return generateResourcesFile(tmpfile.name).then(() => {
    const filedata = fs.readFileSync(tmpfile.name)
    const resources = JSON.parse(filedata)
    assert.ok(Object.prototype.toString.call(resources) === '[object Array]')
    assert.ok(resources.length >= 10)
  })
})
