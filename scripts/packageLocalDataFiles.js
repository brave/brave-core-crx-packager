/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  pnpm package-local-data-files -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/local-data-files-updater.pem

import path from 'path'
import util from '../lib/util.js'
import { getPackagingArgs, packageComponent } from './packageComponent.js'

const componentType = 'local-data-files-updater'
const datFileName = 'default'
const datFileVersion = '1'

const getOriginalManifest = () => {
  return path.join('manifests', 'local-data-files-updater', 'default-manifest.json')
}

class LocalDataFiles {
  constructor () {
    const parsedManifest = util.parseManifest(getOriginalManifest())
    this.componentId = util.getIDFromBase64PublicKey(parsedManifest.key)

    this.stagingDir = path.join('build', componentType, datFileName)
    this.crxFile = path.join('build', componentType, `${componentType}-${datFileName}.crx`)
  }

  privateKeyFromDir (keyDir) {
    return path.join(keyDir, `${componentType}.pem`)
  }

  async stageFiles (version, outputDir) {
    const files = [
      { path: getOriginalManifest(), outputName: 'manifest.json' },
      { path: path.join('brave-lists', 'webcompat-exceptions.json'), outputName: path.join(datFileVersion, 'webcompat-exceptions.json') },
      { path: path.join('brave-lists', 'debounce.json'), outputName: path.join(datFileVersion, 'debounce.json') },
      { path: path.join('brave-lists', 'request-otr.json'), outputName: path.join(datFileVersion, 'request-otr.json') },
      { path: path.join('brave-lists', 'clean-urls.json'), outputName: path.join(datFileVersion, 'clean-urls.json') },
      { path: path.join('brave-lists', 'clean-urls-permissions.json'), outputName: path.join(datFileVersion, 'clean-urls-permissions.json') },
      { path: path.join('brave-lists', 'https-upgrade-exceptions-list.txt'), outputName: path.join(datFileVersion, 'https-upgrade-exceptions-list.txt') },
      { path: path.join('brave-lists', 'localhost-permission-allow-list.txt'), outputName: path.join(datFileVersion, 'localhost-permission-allow-list.txt') }
    ]
    util.stageFiles(files, version, outputDir)
  }
}

const args = getPackagingArgs()
packageComponent(args, new LocalDataFiles())
