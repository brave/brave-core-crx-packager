/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  pnpm package-leo-local-models -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/leo-local-models-component.pem

import { packageLocalModelsComponent } from '../lib/localModelsPackager.js'

packageLocalModelsComponent({
  componentType: 'leo-local-models-updater',
  resourceDir: 'leo-local-models'
})
