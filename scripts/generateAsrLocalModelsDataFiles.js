/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Downloads ASR local models data files from the leo-local-models repository

import { downloadLocalModels } from '../lib/localModelsDownloader.js'

downloadLocalModels({
  targetDir: 'asr-local-models',
  sparseCheckoutPath: 'nemotron-speech-streaming-en-0.6b-int4-onnx'
})
