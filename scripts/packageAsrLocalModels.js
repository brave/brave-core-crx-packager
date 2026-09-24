/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  pnpm package-asr-local-models -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/asr-local-models-component.pem

import { packageLocalModelsComponent } from '../lib/localModelsPackager.js'
import { pathToFileURL } from 'url'

export async function main () {
  packageLocalModelsComponent({
    componentType: 'asr-local-models-updater',
    resourceDir: 'asr-local-models'
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
