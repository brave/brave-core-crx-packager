// Fake @sentry/node. Records init and capture calls instead of talking to Sentry.
import { mockState } from './state.mjs'

export function init (opts) {
  mockState().sentry.initCalls.push(opts)
}

export function captureException (...args) {
  mockState().sentry.captureCalls.push({ fn: 'captureException', args })
}

export function captureMessage (...args) {
  mockState().sentry.captureCalls.push({ fn: 'captureMessage', args })
}
