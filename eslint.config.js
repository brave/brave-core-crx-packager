import neostandard, { resolveIgnoresFromGitignore } from 'neostandard'
import importPlugin from 'eslint-plugin-import'

export default [
  ...neostandard({
    // `standard` skipped gitignored paths implicitly; flat config does not.
    // The two explicit patterns are anchored at the project root, matching the
    // `/submodules/` and `/lib/adBlockRust0_8_6/` entries of the config this replaced.
    ignores: [
      ...resolveIgnoresFromGitignore(),
      'submodules/**',
      'lib/adBlockRust0_8_6/**'
    ]
  }),
  {
    // neostandard drops eslint-plugin-import, which `standard` bundled. These are
    // the six rules eslint-config-standard@17 enabled, at their original severities.
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
