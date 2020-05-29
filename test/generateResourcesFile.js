const tap = require('tap')
const tmp = require('tmp')
const fs = require('fs')

const { generateResourcesFile } = require('../lib/adBlockRustUtils')

tap.test('generateResourcesFile', (t) => {
  const tmpfile = tmp.fileSync({discardDescriptor: true});
  t.resolves(generateResourcesFile(tmpfile.name)).then(() => {
    const filedata = fs.readFileSync(tmpfile.name);
    const resources = JSON.parse(filedata);
    t.ok(Object.prototype.toString.call(resources) === '[object Array]')
    t.ok(resources.length >= 10)
    t.end()
  })
})
