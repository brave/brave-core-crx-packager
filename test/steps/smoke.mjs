import { When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { mockState } from '../support/state.mjs'

When('the AWS S3 probe constructs a client', async function () {
  const { probeAWS } = await import('../fixtures/aws-probe.mjs')
  probeAWS()
})

When('the AWS probe constructs both clients', async function () {
  const { probeAWS } = await import('../fixtures/aws-probe.mjs')
  probeAWS()
})

Then('the S3 client constructor received {string} {string}', function (key, value) {
  const args = mockState().s3.constructorArgs
  expect(args).to.have.lengthOf(1)
  expect(args[0][key]).to.equal(value)
})

Then('a DynamoDB client was constructed with region {string}', function (region) {
  const args = mockState().dynamodb.constructorArgs
  expect(args).to.have.lengthOf(1)
  expect(args[0].region).to.equal(region)
})

Then('a sent DynamoDB command is recorded with its input', async function () {
  const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb')
  const { ListTablesCommand } = await import('@aws-sdk/client-dynamodb')
  // Importantly these resolve to the MOCK module; constructing + sending
  // records into state.
  const client = new DynamoDBClient({ region: 'us-west-2' })
  await client.send(new ListTablesCommand({}))
  const sendCalls = mockState().dynamodb.sendCalls
  expect(sendCalls).to.have.lengthOf(1)
  expect(sendCalls[0].command).to.equal('ListTablesCommand')
})

When('a request is made to {string}', async function (url) {
  try {
    await globalThis.fetch(url)
    this.fetchError = null
  } catch (error) {
    this.fetchError = error
  }
})

Then('the request fails with {string}', function (message) {
  expect(this.fetchError).to.be.an('error')
  expect(this.fetchError.message).to.equal(message)
})

Then('the failed request was recorded in the fetch log', function () {
  expect(mockState().fetchCalls).to.have.lengthOf(1)
  expect(mockState().fetchCalls[0].url).to.equal('https://example.invalid/data.json')
})

When('the chrome shim runs with {string}', function (arg) {
  this.shimResult = spawnSync('chrome', [arg])
})

Then('it exits with code {int} complaining about {string}', function (code, fragment) {
  expect(this.shimResult.status).to.equal(code)
  expect(this.shimResult.stderr.toString()).to.include(fragment)
})

When('the puffin shim runs with {string} and records its invocation', function (arg) {
  this.recordPath = path.join(os.tmpdir(), `crx-shim-record-${process.pid}-${Date.now()}.json`)
  fs.writeFileSync(this.recordPath, '')
  process.env.CRX_PACKAGER_RECORD = this.recordPath
  const out = path.join(os.tmpdir(), `puff-out-${process.pid}`)
  execFileSync('puffin', [arg, 'a.crx', 'b.crx', out])
})

Then('the puffin record contains {string}', function (binName) {
  const lines = fs.readFileSync(this.recordPath, 'utf8').trim().split('\n').map(JSON.parse)
  expect(lines.some(entry => entry.bin === binName)).to.equal(true)
})
