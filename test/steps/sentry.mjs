import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'
import { mockState } from '../support/state.mjs'

// lib/sentry.js is evaluated once per specifier — a unique query string
// forces a fresh module evaluation per scenario.
let probeCounter = 0

Given('the sentry env var is set to {string}', function (dsn) {
  process.env.sentry = dsn
})

When('the sentry module is freshly imported', async function () {
  const module = await import(`../../lib/sentry.js?probe-${++probeCounter}`)
  this.sentry = module.default
})

Then('Sentry is null', function () {
  expect(this.sentry).to.equal(null)
})

Then('Sentry was initialized with dsn {string}', function (dsn) {
  expect(mockState().sentry.initCalls).to.deep.equal([{ dsn }])
})

Then('the initialized Sentry exports captureException', function () {
  expect(typeof this.sentry.captureException).to.equal('function')
})
