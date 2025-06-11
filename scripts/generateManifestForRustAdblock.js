/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { promises as fs } from 'fs'
import path from 'path'

import {
  getListCatalog,
  regionalCatalogComponentId,
  regionalCatalogPubkey,
  resourcesComponentId,
  resourcesPubkey
} from '../lib/adBlockRustUtils.js'
import util from '../lib/util.js'

const outPath = path.join('build', 'ad-block-updater')

const generateManifestFile = async (name, base64PublicKey, subdir) => {
  const manifest =
    '{\n' +
    '  "description": "Brave Ad Block Updater extension",\n' +
    '  "key": "' +
    base64PublicKey +
    '",\n' +
    '  "manifest_version": 2,\n' +
    '  "name": "Brave Ad Block Updater (' +
    name +
    ')",\n' +
    '  "version": "0.0.0"\n' +
    '}\n'

  const filePath = path.join(outPath, subdir, 'manifest.json')
  return fs
    .writeFile(filePath, manifest)
    .catch((e) =>
      console.warn('Skipped writing manifest for ' + name + ': ' + e.message)
    )
}

const generateManifestFileForRegionalCatalog = generateManifestFile.bind(
  null,
  'Regional Catalog',
  regionalCatalogPubkey,
  regionalCatalogComponentId
)

const generateManifestFileForResources = generateManifestFile.bind(
  null,
  'Resources',
  resourcesPubkey,
  resourcesComponentId
)

const generateManifestFilesForAllLists = async () => {
  const catalog = await getListCatalog()
  return Promise.all(
    catalog.map(async (entry) => {
      const title = util.escapeStringForJSON(entry.title)
      await generateManifestFile(
        title + ' (plaintext)',
        entry.list_text_component.base64_public_key,
        entry.list_text_component.component_id
      )
    })
  )
}

generateManifestFileForRegionalCatalog()
  .then(generateManifestFileForResources)
  .then(generateManifestFilesForAllLists)
  .then(() => {
    console.log(
      "Thank you for updating the data files, don't forget to upload them too!"
    )
  })
  .catch((e) => {
    console.error(`Something went wrong, aborting: ${e}`)
    process.exit(1)
  })

process.on('uncaughtException', (err) => {
  console.error('Caught exception:', err)
  process.exit(1)
})

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err)
  process.exit(1)
})
