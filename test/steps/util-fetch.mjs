import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { Readable } from 'node:stream'
import { mockState } from '../support/state.mjs'

let util

async function loadUtil () {
  if (!util) util = (await import('../../lib/util.js')).default
  return util
}

Given('{string} is served with body:', function (url, body) {
  mockState().fetchRoutes.push({ match: url, status: 200, body })
})

Given('{string} is served with body {string}', function (url, body) {
  mockState().fetchRoutes.push({ match: url, status: 200, body })
})

Given('{string} is served with status {int}', function (url, status) {
  mockState().fetchRoutes.push({ match: url, status, body: '' })
})

Given('{string} always fails with status {int}', function (url, status) {
  mockState().fetchRoutes.push({ match: url, status, body: '' })
})

Given('{string} fails its first attempt with status {int} and then serves {string}', function (url, status, body) {
  let attempts = 0
  mockState().fetchRoutes.push({
    match: url,
    response () {
      attempts++
      return attempts === 1 ? { status, body: '' } : { status: 200, body }
    }
  })
})

Given('the S3 object {string} serves body {string}', function (objectPath, body) {
  const [bucket, key] = objectPath.split('/')
  mockState().s3.replies.GetObjectCommand = {
    value: { Body: Readable.from([Buffer.from(body)]) }
  }
  this.expectedBucket = bucket
  this.expectedKey = key
})

When('the list is fetched from {string}', async function (url) {
  await loadUtil()
  try {
    this.fetchedText = await util.fetchTextFromURL(url)
    this.fetchError = null
  } catch (error) {
    this.fetchError = error
  }
})

When('an s3-capable fetch is made for {string}', async function (url) {
  await loadUtil()
  try {
    this.response = await util.s3capableFetch(url)
    this.s3capableError = null
    this.s3capableBody = await this.response.text()
  } catch (error) {
    this.s3capableError = error
  }
})

Then('the fetched text is:', function (doc) {
  expect(this.fetchedText).to.equal(doc)
})

Then('the fetched text is {string}', function (expected) {
  expect(this.fetchedText).to.equal(expected)
})

Then('exactly {int} fetch call was recorded', function (count) {
  const fetchCalls = mockState().fetchCalls.filter(call => String(call.url).includes('example.invalid/flaky.txt'))
  expect(fetchCalls).to.have.lengthOf(count)
})

Then('exactly {int} fetch calls were recorded', function (count) {
  const fetchCalls = mockState().fetchCalls.filter(call => String(call.url).includes('example.invalid/flaky.txt'))
  expect(fetchCalls).to.have.lengthOf(count)
})

Then('the fetch fails mentioning {string}', function (fragment) {
  expect(this.fetchError).to.be.an('error')
  expect(this.fetchError.message).to.include(fragment)
})

Then('the response body is {string}', function (expected) {
  expect(this.s3capableError).to.equal(null)
  expect(this.s3capableBody).to.equal(expected)
})

Then('an s3-capable fetch for {string} fails with {string}', async function (url, fragment) {
  await loadUtil()
  try {
    await util.s3capableFetch(url)
    this.s3capableFetchError = null
  } catch (error) {
    this.s3capableFetchError = error
  }
  expect(this.s3capableFetchError).to.be.an('error')
  expect(this.s3capableFetchError.message).to.include(fragment)
})

Then('the S3 GetObject targeted bucket {string} key {string}', function (bucket, key) {
  const sendCalls = mockState().s3.sendCalls.filter(call => call.command === 'GetObjectCommand')
  expect(sendCalls).to.have.lengthOf(1)
  expect(sendCalls[0].input.Bucket).to.equal(bucket)
  expect(sendCalls[0].input.Key).to.equal(key)
})
