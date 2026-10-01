// Shared mutable state for hermetic fakes. One singleton per test process,
// keyed by a global symbol so every module sees the same object.
export const STATE_KEY = Symbol.for('crx-packager.mock-state')

export function freshState () {
  return {
    s3: {
      constructorArgs: [],
      sendCalls: [], // { command, input }
      replies: {} // command name -> { value } | { error }
    },
    dynamodb: {
      constructorArgs: [],
      sendCalls: [],
      replies: {}
    },
    sentry: {
      initCalls: [],
      captureCalls: [] // { fn, args }
    },
    fetchRoutes: [],
    fetchCalls: [],
    scripts: {
      exitCalls: []
    },
    logs: [] // { level, args }
  }
}

export function mockState () {
  const globalScope = globalThis
  if (!globalScope[STATE_KEY]) {
    globalScope[STATE_KEY] = freshState()
  }
  return globalScope[STATE_KEY]
}

export function resetState () {
  globalThis[STATE_KEY] = freshState()
  return globalThis[STATE_KEY]
}
