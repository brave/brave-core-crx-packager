/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  npm run package-local-data-files -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --key-file path/to/local-data-files-updater.pem

import { mkdirp } from 'mkdirp'
import path from 'path'
import recursive from 'recursive-readdir-sync'
import util from '../lib/util.js'
import { getPackagingArgs, packageComponent } from './packageComponent.js'

const componentType = 'local-data-files-updater'
const datFileName = 'default'

const getOriginalManifest = () => {
  return path.join('manifests', 'local-data-files-updater', 'default-manifest.json')
}

class LocalDataFiles {
  stagingDir = path.join('build', componentType, datFileName)
  crxFile = path.join('build', componentType, `${componentType}-${datFileName}.crx`)
  componentId = (() => {
    const originalManifest = getOriginalManifest()
    const parsedManifest = util.parseManifest(originalManifest)
    return util.getIDFromBase64PublicKey(parsedManifest.key)
  })()

  privateKeyFromDir (keyDir) {
    return path.join(keyDir, `${componentType}-${datFileName}.pem`)
  }

  async stageFiles (version, outputDir) {
    const datFileVersion = '1'
    const files = [
      { path: getOriginalManifest(), outputName: 'manifest.json' },
      { path: path.join('brave-lists', 'debounce.json'), outputName: path.join(datFileVersion, 'debounce.json') },
      { path: path.join('brave-lists', 'request-otr.json'), outputName: path.join(datFileVersion, 'request-otr.json') },
      { path: path.join('brave-lists', 'clean-urls.json'), outputName: path.join(datFileVersion, 'clean-urls.json') },
      { path: path.join('brave-lists', 'https-upgrade-exceptions-list.txt'), outputName: path.join(datFileVersion, 'https-upgrade-exceptions-list.txt') },
      { path: path.join('brave-lists', 'localhost-permission-allow-list.txt'), outputName: path.join(datFileVersion, 'localhost-permission-allow-list.txt') }
    ].concat(
      recursive(path.join('node_modules', 'brave-site-specific-scripts', 'dist')).map(f => {
        let outputDatDir = datFileVersion
        const index = f.indexOf('/dist/')
        let baseDir = f.substring(index + '/dist/'.length)
        baseDir = baseDir.substring(0, baseDir.lastIndexOf('/'))
        outputDatDir = path.join(outputDatDir, baseDir)
        mkdirp.sync(path.join(outputDir, outputDatDir))
        return {
          path: f,
          outputName: path.join(outputDatDir, path.parse(f).base)
        }
      }))
    util.stageFiles(files, version, outputDir)
  }
}

const args = getPackagingArgs()
packageComponent(args, new LocalDataFiles())
