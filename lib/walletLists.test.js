import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import JSZip from 'jszip'

import { checkContents, extractZip } from './walletLists.js'

const tmpDir = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-lists-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  return dir
}

const makeZip = (files) => {
  const zip = new JSZip()
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content)
  }
  return zip.generateAsync({ type: 'nodebuffer' })
}

const writeFiles = (t, files) => {
  const dir = tmpDir(t)
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
    fs.writeFileSync(path.join(dir, name), content)
  }
  return dir
}

const validFiles = {
  'manifest.json': JSON.stringify({ key: 'abc' }),
  VERSION: 'v1.38.2\n',
  'prohibited-addresses.json': JSON.stringify({ addresses: ['TBEmt7kPSwAv6NJTYKNdBVW524bUfPwJpJ'] }),
  'images/token.png': 'png'
}

test('extractZip writes nested files', async (t) => {
  const dir = tmpDir(t)
  await extractZip(await makeZip(validFiles), dir)

  assert.equal(fs.readFileSync(path.join(dir, 'images', 'token.png'), 'utf-8'), 'png')
  assert.equal(fs.readFileSync(path.join(dir, 'VERSION'), 'utf-8'), 'v1.38.2\n')
})

test('extractZip keeps traversing and absolute entries inside the output directory', async (t) => {
  const dir = tmpDir(t)
  const outputDir = path.join(dir, 'out')
  const zip = await makeZip({ '../evil.txt': 'x', 'a/../../evil2.txt': 'x', '/abs/evil3.txt': 'x' })

  await extractZip(zip, outputDir)
  assert.deepEqual(fs.readdirSync(dir), ['out'])
})

test('checkContents returns the prohibited address count', (t) => {
  assert.equal(checkContents(writeFiles(t, validFiles), 'v1.38.2'), 1)
})

test('checkContents rejects a VERSION from another release', (t) => {
  assert.throws(() => checkContents(writeFiles(t, validFiles), 'v1.38.3'), /does not match/)
})

test('checkContents rejects an empty prohibited address list', (t) => {
  const dir = writeFiles(t, { ...validFiles, 'prohibited-addresses.json': JSON.stringify({ addresses: [] }) })
  assert.throws(() => checkContents(dir, 'v1.38.2'), /no addresses/)
})

test('checkContents rejects a manifest without a key', (t) => {
  const dir = writeFiles(t, { ...validFiles, 'manifest.json': '{}' })
  assert.throws(() => checkContents(dir, 'v1.38.2'), /no key/)
})
