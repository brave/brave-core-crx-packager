import assert from 'node:assert/strict'
import test from 'node:test'
import zlib from 'node:zlib'

import {
  IOS_VALIDATOR_ZSTD_THRESHOLD,
  maybeZstdCompressIosValidatorBody,
  sanityCheckList
} from './adBlockRustUtils.js'

const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

test('maybeZstdCompressIosValidatorBody leaves small payloads uncompressed', async () => {
  const headers = { 'Content-Type': 'application/json' }
  const body = 'x'.repeat(IOS_VALIDATOR_ZSTD_THRESHOLD - 1)
  const result = await maybeZstdCompressIosValidatorBody(body, headers)

  assert.equal(result, body)
  assert.equal(typeof result, 'string')
  assert.equal(headers['Content-Encoding'], undefined)
})

test('maybeZstdCompressIosValidatorBody zstd-compresses payloads at the size threshold', async () => {
  const headers = { 'Content-Type': 'application/json' }
  const body = 'x'.repeat(IOS_VALIDATOR_ZSTD_THRESHOLD)
  const result = await maybeZstdCompressIosValidatorBody(body, headers)

  assert.ok(Buffer.isBuffer(result))
  assert.ok(result.length < body.length)
  assert.deepEqual(result.subarray(0, 4), ZSTD_MAGIC)
  assert.equal(headers['Content-Encoding'], 'application/zstd')

  const decompressed = zlib.zstdDecompressSync(result)
  assert.equal(decompressed.toString(), body)
})

test('maybeZstdCompressIosValidatorBody zstd-compresses payloads above the size threshold', async () => {
  const headers = { 'Content-Type': 'application/json' }
  const body = `{${' "k": "v",'.repeat(IOS_VALIDATOR_ZSTD_THRESHOLD / 10)}}`
  const result = await maybeZstdCompressIosValidatorBody(body, headers)

  assert.ok(body.length > IOS_VALIDATOR_ZSTD_THRESHOLD)
  assert.ok(Buffer.isBuffer(result))
  assert.equal(headers['Content-Encoding'], 'application/zstd')

  const decompressed = zlib.zstdDecompressSync(result)
  assert.equal(decompressed.toString(), body)
})

test('sanityCheckList zstd-compresses oversized iOS validator payloads', async (t) => {
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    requests.push({ url, init })
    return new Response('', { status: 200 })
  })

  const data = Array.from({ length: 70000 }, (_, i) => `##.adblock-zstd-${i}`).join('\n')
  await sanityCheckList({ title: 'large list', data, format: 'Standard' })

  assert.equal(requests.length, 1)
  assert.equal(requests[0].init.method, 'POST')
  assert.equal(requests[0].init.headers['Content-Type'], 'application/json')
  assert.equal(requests[0].init.headers['Content-Encoding'], 'application/zstd')
  assert.ok(Buffer.isBuffer(requests[0].init.body))
  assert.deepEqual(requests[0].init.body.subarray(0, 4), ZSTD_MAGIC)

  const decompressed = zlib.zstdDecompressSync(requests[0].init.body)
  const rules = JSON.parse(decompressed.toString())
  assert.ok(Array.isArray(rules))
  assert.ok(JSON.stringify(rules).length >= IOS_VALIDATOR_ZSTD_THRESHOLD)
})
