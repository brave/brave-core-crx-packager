/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Checks out the latest revision of the brave-webmcp repository (main branch)
// and assembles the component resource directory that packageWebMcpComponent.js
// stages into the CRX. The scripts are plain JS with no build step, so this
// only clones and copies the shipped files.
//
// Example usage:
//  npm run data-files-web-mcp

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import fs from 'fs-extra'
import path from 'path'

const sourcePrefix = './brave-webmcp'
const sourceRepo = 'git@github.com:brave/brave-webmcp.git'
const resourceDir = './web-mcp'

if (existsSync(sourcePrefix)) {
  // Repo already cloned — fetch and reset to latest main
  execSync(`git -C ${sourcePrefix} fetch origin main`, { stdio: 'inherit' })
  execSync(`git -C ${sourcePrefix} reset --hard origin/main`, { stdio: 'inherit' })
} else {
  // Fresh clone
  execSync(`git clone --branch main --depth 1 ${sourceRepo} ${sourcePrefix}`, { stdio: 'inherit' })
}

// Assemble a clean resource directory containing only what the component ships.
// The source repo also holds README.md / LICENSE / manifest.json / key.pem,
// none of which belong in the CRX — the manifest is generated from the template
// in manifests/web-mcp/ and the key is provisioned separately at signing time.
fs.removeSync(resourceDir)
fs.copySync(path.join(sourcePrefix, 'scripts'), path.join(resourceDir, 'scripts'))
