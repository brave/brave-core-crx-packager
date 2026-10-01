module.exports = {
  default: {
    paths: ['test/features/**/*.feature'],
    import: [
      'test/support/state.mjs',
      'test/support/mocks.mjs',
      'test/support/world.mjs',
      'test/steps/*.mjs'
    ],
    format: ['summary']
  }
}
