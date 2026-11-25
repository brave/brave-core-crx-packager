import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import util from '../lib/util.js'

const makeDescriptor = (dir, overrides = {}) => {
  const staged = []
  return {
    descriptor: {
      componentId: 'testcomponent',
      stagingDir: path.join(dir, 'staging'),
      crxFile: path.join(dir, 'testcomponent.crx'),
      stageFiles: async (version, outputDir) => {
        staged.push({ version, outputDir })
      },
      ...overrides
    },
    staged
  }
}

test('prepareNextVersionCRX stages and writes the content hash file on a local run', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-next-version-crx-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const { descriptor, staged } = makeDescriptor(dir, {
    contentHash: () => 'abc123',
    contentHashFile: path.join(dir, 'testcomponent.contentHash')
  })

  await util.prepareNextVersionCRX({
    componentDescriptor: descriptor,
    privateKeyFile: '',
    localRun: true
  })

  assert.deepEqual(staged, [{ version: '1.0.0', outputDir: descriptor.stagingDir }])
  assert.equal(fs.readFileSync(descriptor.contentHashFile, 'utf-8'), 'abc123')
  assert.ok(fs.statSync(descriptor.stagingDir).isDirectory())
  // No CRX is generated on a local run
  assert.equal(fs.existsSync(descriptor.crxFile), false)
})

test('prepareNextVersionCRX omits the content hash file when no hash is provided', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-next-version-crx-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const { descriptor, staged } = makeDescriptor(dir, {
    contentHashFile: path.join(dir, 'testcomponent.contentHash')
  })

  await util.prepareNextVersionCRX({
    componentDescriptor: descriptor,
    privateKeyFile: '',
    localRun: true
  })

  assert.equal(fs.existsSync(descriptor.contentHashFile), false)
  assert.deepEqual(staged, [{ version: '1.0.0', outputDir: descriptor.stagingDir }])
})

test('prepareNextVersionCRX packages without a hash when contentHash reports unavailability', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-next-version-crx-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const { descriptor, staged } = makeDescriptor(dir, {
    // e.g. first run, before the content has been generated
    contentHash: () => undefined,
    contentHashFile: path.join(dir, 'testcomponent.contentHash')
  })

  await util.prepareNextVersionCRX({
    componentDescriptor: descriptor,
    privateKeyFile: '',
    localRun: true
  })

  assert.equal(fs.existsSync(descriptor.contentHashFile), false)
  assert.deepEqual(staged, [{ version: '1.0.0', outputDir: descriptor.stagingDir }])
})

test('prepareNextVersionCRX creates a missing CRX output directory', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-next-version-crx-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  // e.g. build/<component>/output, which nothing else creates
  const crxFile = path.join(dir, 'output', 'nested', 'testcomponent.crx')
  const { descriptor } = makeDescriptor(dir, { crxFile })

  await util.prepareNextVersionCRX({
    componentDescriptor: descriptor,
    privateKeyFile: '',
    localRun: true
  })

  assert.ok(fs.statSync(path.dirname(crxFile)).isDirectory())
})

test('prepareNextVersionCRX propagates errors thrown by contentHash', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-next-version-crx-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const { descriptor, staged } = makeDescriptor(dir, {
    contentHash: () => {
      throw new Error('boom')
    }
  })

  await assert.rejects(
    util.prepareNextVersionCRX({
      componentDescriptor: descriptor,
      privateKeyFile: '',
      localRun: true
    }),
    /boom/
  )
  assert.deepEqual(staged, [])
})

test('prepareNextVersionCRX replaces a stale content hash file', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-next-version-crx-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const contentHashFile = path.join(dir, 'testcomponent.contentHash')
  fs.writeFileSync(contentHashFile, 'stale-hash')
  const { descriptor } = makeDescriptor(dir, {
    contentHash: () => 'fresh-hash',
    contentHashFile
  })

  await util.prepareNextVersionCRX({
    componentDescriptor: descriptor,
    privateKeyFile: '',
    localRun: true
  })

  assert.equal(fs.readFileSync(contentHashFile, 'utf-8'), 'fresh-hash')
})
