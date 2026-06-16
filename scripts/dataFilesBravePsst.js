/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Installs the PSST submodule dependencies and bundles it.
//
// Example usage:
//  npm run data-files-brave-psst          (defaults to dev)
//  npm run data-files-brave-psst dev
//  npm run data-files-brave-psst prod

import { execSync } from 'child_process'

const mode = (process.argv[2] || 'dev').toLowerCase()

if (mode !== 'dev' && mode !== 'prod') {
  console.error(`Invalid mode "${mode}". Expected "dev" or "prod".`)
  process.exit(1)
}

const psstPrefix = './submodules/psst'

execSync('npm install --prefix ' + psstPrefix, { stdio: 'inherit' })
execSync(`npm run --prefix ${psstPrefix} bundle:${mode}`, { stdio: 'inherit' })
