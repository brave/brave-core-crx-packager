import neostandard, { resolveIgnoresFromGitignore } from 'neostandard'
import importPlugin from 'eslint-plugin-import'

export default [
  ...neostandard({
    ignores: [
      ...resolveIgnoresFromGitignore(),
      'submodules/**',
      'lib/adBlockRust0_8_6/**'
    ]
  }),
  {
    plugins: { import: importPlugin },
    rules: {
      'import/export': 'error',
      'import/first': 'error',
      'import/no-absolute-path': ['error', { esmodule: true, commonjs: true, amd: false }],
      'import/no-duplicates': 'error',
      'import/no-named-default': 'error',
      'import/no-webpack-loader-syntax': 'error'
    }
  }
]
