/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Shared packaging logic for local-models components (e.g. leo-local-models,
// asr-local-models). These components ship a directory of model files staged
// alongside a committed default-manifest.json, so the only per-component
// differences are the component type and the resource directory.

import path from 'path'
import util from './util.js'
// The shared CLI scaffolding lives in scripts/ alongside the other component
// packaging entry points.
import { getPackagingArgs, packageComponent } from '../scripts/packageComponent.js'

/**
 * Packages a local-models component into a CRX file.
 *
 * @param {Object} options
 * @param {string} options.componentType - Component type and manifest
 *   directory name (e.g. 'asr-local-models-updater').
 * @param {string} options.resourceDir - Local directory holding the downloaded
 *   model files to stage (e.g. 'asr-local-models').
 */
export const packageLocalModelsComponent = ({ componentType, resourceDir }) => {
  const datFileName = 'default'

  const getOriginalManifest = () => {
    return path.join('manifests', componentType, 'default-manifest.json')
  }

  class LocalModelsComponent {
    constructor () {
      const parsedManifest = util.parseManifest(getOriginalManifest())
      this.componentId = util.getIDFromBase64PublicKey(parsedManifest.key)

      this.stagingDir = path.join('build', componentType, datFileName)
      this.crxFile = path.join('build', componentType, `${componentType}-${datFileName}.crx`)
    }

    privateKeyFromDir (keyDir) {
      return path.join(keyDir, `${componentType}-${datFileName}.pem`)
    }

    async stageFiles (version, outputDir) {
      util.stageDir(resourceDir, getOriginalManifest(), version, outputDir)
    }
  }

  const args = getPackagingArgs()
  return packageComponent(args, new LocalModelsComponent())
}

export default { packageLocalModelsComponent }
