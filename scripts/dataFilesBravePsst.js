/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Checks out the latest revision of the psst-component repository (main branch),
// installs its dependencies, and bundles it.
//
// Example usage:
//  npm run data-files-brave-psst          (defaults to dev)
//  npm run data-files-brave-psst dev
//  npm run data-files-brave-psst prod

import { execSync } from 'child_process'
import { existsSync } from 'fs'

const mode = (process.argv[2] || 'dev').toLowerCase()

if (mode !== 'dev' && mode !== 'prod') {
  console.error(`Invalid mode "${mode}". Expected "dev" or "prod".`)
  process.exit(1)
}

const psstPrefix = './psst-component'
const psstRepo = 'git@github.com:brave/psst-component.git'

if (existsSync(psstPrefix)) {
  // Repo already cloned — fetch and reset to latest main
  execSync(`git -C ${psstPrefix} fetch origin main`, { stdio: 'inherit' })
  execSync(`git -C ${psstPrefix} reset --hard origin/main`, { stdio: 'inherit' })
} else {
  // Fresh clone
  execSync(`git clone --branch main --depth 1 ${psstRepo} ${psstPrefix}`, { stdio: 'inherit' })
}

execSync(`npm install --prefix ${psstPrefix}`, { stdio: 'inherit' })
execSync(`npm run --prefix ${psstPrefix} bundle:${mode}`, { stdio: 'inherit' })
