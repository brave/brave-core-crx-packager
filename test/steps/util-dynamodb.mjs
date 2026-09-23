import { When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { mockState } from '../support/state.mjs'

let util

async function loadUtil () {
  if (!util) util = (await import('../../lib/util.js')).default
  return util
}

When('the Extensions table does not exist', function () {
  mockState().dynamodb.replies.ListTablesCommand = { value: { TableNames: ['OtherTable'] } }
})

When('the Extensions table already exists', function () {
  mockState().dynamodb.replies.ListTablesCommand = { value: { TableNames: ['Extensions'] } }
})

When('a table is created if not exists with endpoint {string} and region {string}', async function (endpoint, region) {
  await loadUtil()
  this.createTableError = null
  try {
    await util.createTableIfNotExists(endpoint === '' ? undefined : endpoint, region)
  } catch (error) {
    this.createTableError = error
  }
})

When('the next version is queried for {string} with no stored item', async function (id) {
  await loadUtil()
  mockState().dynamodb.replies.QueryCommand = { value: { Items: [] } }
  this.nextVersion = await util.getNextVersion('http://localhost:8000', 'us-west-2', id, this.queryContentHash)
})

When('the next version is queried for {string} with stored version {string} and content hash {string}', async function (id, version, contentHash) {
  await loadUtil()
  mockState().dynamodb.replies.QueryCommand = {
    value: { Items: [{ Version: { S: version }, ContentHash: { S: contentHash } }] }
  }
  this.id = id
})

When('the queried content hash is {string}', async function (contentHash) {
  this.queryContentHash = contentHash
  this.nextVersion = await util.getNextVersion('http://localhost:8000', 'us-west-2', this.id, contentHash)
})

When('the item is written for id {string} version {string} hash {string} name {string} disabled {word} patch list {string} size {string} and content hash {string}', async function (id, version, hash, name, disabled, patchList, size, contentHash) {
  await loadUtil()
  await util.updateDynamoDB('http://localhost:8000', 'us-west-2', id, version, hash, name, disabled === 'false', contentHash, JSON.parse(patchList), size)
})

Then('a CreateTable command was sent with table name {string} and hash key {string}', function (tableName, hashKey) {
  expect(this.createTableError).to.equal(null)
  const sendCalls = mockState().dynamodb.sendCalls
  const createCall = sendCalls.find(call => call.command === 'CreateTableCommand')
  expect(createCall, JSON.stringify(sendCalls)).to.not.equal(undefined)
  expect(createCall.input.TableName).to.equal(tableName)
  expect(createCall.input.KeySchema[0].AttributeName).to.equal(hashKey)
  expect(createCall.input.AttributeDefinitions[0]).to.deep.equal({ AttributeName: 'ID', AttributeType: 'S' })
})

Then('no CreateTable command was sent', function () {
  expect(this.createTableError).to.equal(null)
  expect(mockState().dynamodb.sendCalls.some(call => call.command === 'CreateTableCommand')).to.equal(false)
})

Then('the next version is {string}', function (expected) {
  expect(this.nextVersion).to.equal(expected)
})

Then('no next version is returned', function () {
  expect(this.nextVersion).to.equal(undefined)
})
