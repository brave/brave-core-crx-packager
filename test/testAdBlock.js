import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { spawnSync } from 'child_process'

import { generateResourcesFile, preprocess, sanityCheckList } from '../lib/adBlockRustUtils.js'

test('generateResourcesFile', async (t) => {
  const tempUserDataDir = fs.mkdtempSync(path.join(tmpdir(), 'generate-resources-file-'))
  const tmpfile = path.join(tempUserDataDir, 'resourcefile')
  return generateResourcesFile(tmpfile).then(() => {
    const filedata = fs.readFileSync(tmpfile)
    const resources = JSON.parse(filedata)
    assert.ok(Object.prototype.toString.call(resources) === '[object Array]')
    assert.ok(resources.length >= 10)
    for (const r of resources) {
      assert.ok(r.kind !== undefined)
      assert.ok(r.kind.mime !== undefined)
      if (r.kind.mime === 'application/javascript' || r.kind.mime === 'fn/javascript') {
        const script = atob(r.content)
        const subprocess = spawnSync('node', ['--check'], { input: script })
        assert.ok(subprocess.status === 0, 'Resource ' + r.name + ' is not valid JS:\n' + subprocess.stderr.toString() + '\n' + script)
      }
    }
  })
})

test('sanityCheckList', async (t) => {
  // Verify that https://bravesoftware.slack.com/archives/C2FQMN4AD/p1704501704164999 would have been caught
  const corruptedList = fs.readFileSync('./test/elc-1.0.3814-corrupted.txt', { encoding: 'utf8' })
  let failureMessage
  try {
    await sanityCheckList({ title: 'corrupted list', data: corruptedList, format: 'Standard' })
  } catch (error) {
    failureMessage = error.message
  }
  assert.ok(failureMessage.startsWith('corrupted list failed sanity check for'))
})

test('preprocess', async (t) => {
  const list = `
    x##x:remove()
    !#if cap_html_filtering
    a##cap-filtering:remove()
    !#else
    b##no-cap-filtering:remove()
    !#endif
    c##c:remove()
    !#if whatever
    d##whatever:remove()
    !#if !env_firefox
    e##not-firefox:remove()
    !#else
    !#if !false
    f##firefox:remove()
    !#endif
    !#endif
    g##whatever:remove()
    !#endif
    h##h:remove()
  `
  const { data } = preprocess({ data: list })
  assert.equal(data, `
    x##x:remove()
    b##no-cap-filtering:remove()
    c##c:remove()
    d##whatever:remove()
    e##not-firefox:remove()
    g##whatever:remove()
    h##h:remove()
  `)
})
