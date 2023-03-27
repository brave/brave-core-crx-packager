import tap from 'tap'
import tmp from 'tmp'
import fs from 'fs'

import { generateResourcesFile } from '../lib/adBlockRustUtils.js'

tap.test('generateResourcesFile', (t) => {
  const tmpfile = tmp.fileSync({ discardDescriptor: true })
  t.resolves(generateResourcesFile(tmpfile.name)).then(() => {
    const filedata = fs.readFileSync(tmpfile.name)
    const resources = JSON.parse(filedata)
    t.ok(Object.prototype.toString.call(resources) === '[object Array]')
    t.ok(resources.length >= 10)
    t.end()
  })
})
