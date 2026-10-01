/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Downloads leo-local-models data files from the leo-local-models repository

import { downloadLocalModels } from '../lib/localModelsDownloader.js'
import { pathToFileURL } from 'url'

export function main () {
  downloadLocalModels({
    targetDir: 'leo-local-models',
    sparseCheckoutPath: 'embeddinggemma-300m',
    renames: {
      'embeddinggemma-300m-Q4_0.gguf': 'model.gguf'
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
