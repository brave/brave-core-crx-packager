/* Copyright (c) 2022 The Brave Authors. All rights reserved.
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Example usage:
//  pnpm package-ad-block -- --binary "/Applications/Google\\ Chrome\\ Canary.app/Contents/MacOS/Google\\ Chrome\\ Canary" --keys-directory path/to/ad-block-updater-regional-component-keys

import fs from 'fs-extra'
import path from 'path'
import util from '../lib/util.js'
import { getPackagingArgs, packageComponent } from './packageComponent.js'
import { getListCatalog, regionalCatalogComponentId, resourcesComponentId } from '../lib/adBlockRustUtils.js'

// Increase this number if you want to recreate adblock components, even if
// the hash of the content file has not changed.
const contentHashVersion = 1

const getOriginalManifest = (componentSubdir) => {
  const manifestsDir = path.join('build', 'ad-block-updater')
  return path.join(manifestsDir, componentSubdir, 'manifest.json')
}

// A generic descriptor for the ad-block components: data files are
// pre-generated into build/ad-block-updater/<subdir> by the data file
// generation job; this job only versions and packages them.
class AdblockComponent {
  constructor (componentSubdir, hashFileName) {
    this.componentSubdir = componentSubdir
    this.componentId = util.getIDFromBase64PublicKey(util.parseManifest(getOriginalManifest(componentSubdir)).key)

    this.crxName = `ad-block-updater-${componentSubdir}`
    this.stagingDir = path.join('build', 'ad-block-updater', componentSubdir)
    this.crxFile = path.join('build', 'ad-block-updater', `${this.crxName}.crx`)
    this.contentHashFile = path.join('build', 'ad-block-updater', `${this.crxName}.contentHash`)
    this.verifiedContentsPatterns = ['resources.json', 'list.txt', 'list_catalog.json']

    this.hashFileName = hashFileName
  }

  contentHash () {
    const contentFile = path.join('build', 'ad-block-updater', this.componentSubdir, this.hashFileName)
    // On the first run for a component, there is nothing to hash yet.
    if (!fs.existsSync(contentFile)) {
      return undefined
    }
    return util.generateVersionedSHA256HashOfFile(contentFile, contentHashVersion)
  }

  privateKeyFromDir (keyDir) {
    return path.join(keyDir, `${this.crxName}.pem`)
  }

  async stageFiles (version, outputDir) {
    // ad-block components are already written in the output directory
    // so we don't need to stage anything
    const originalManifest = path.join(outputDir, 'manifest.json')
    // note - in-place manifest replacement, unlike other components
    util.copyManifestWithVersion(originalManifest, outputDir, version)
  }
}

const getComponentList = async () => {
  const output = [
    // The catalog component carries the catalog of available filter lists
    new AdblockComponent(regionalCatalogComponentId, 'list_catalog.json'),
    // The resources component carries the data for adblock-rust's resource
    // replacements and scriptlets
    new AdblockComponent(resourcesComponentId, 'resources.json')
  ]
  const catalog = await getListCatalog()
  catalog.forEach(entry => {
    output.push(new AdblockComponent(entry.list_text_component.component_id, 'list.txt'))
  })
  return output
}

const args = getPackagingArgs()
await Promise.all((await getComponentList()).map(descriptor =>
  packageComponent(args, descriptor)))
