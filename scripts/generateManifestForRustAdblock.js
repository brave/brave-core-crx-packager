/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { promises as fs } from 'fs'
import path from 'path'

import { getRegionalLists, regionalCatalogComponentId, regionalCatalogPubkey, resourcesComponentId, resourcesPubkey } from '../lib/adBlockRustUtils.js'

const outPath = path.join('build', 'ad-block-updater')

const defaultAdblockBase64PublicKey =
    'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAs0qzJmHSgIiw7IGFCxij' +
    '1NnB5hJ5ZQ1LKW9htL4EBOaMJvmqaDs/wfq0nw/goBHWsqqkMBynRTu2Hxxirvdb' +
    'cugn1Goys5QKPgAvKwDHJp9jlnADWm5xQvPQ4GE1mK1/I3ka9cEOCzPW6GI+wGLi' +
    'VPx9VZrxHHsSBIJRaEB5Tyi5bj0CZ+kcfMnRTsXIBw3C6xJgCVKISQUkd8mawVvG' +
    'vqOhBOogCdb9qza5eJ1Cgx8RWKucFfaWWxKLOelCiBMT1Hm1znAoVBHG/blhJJOD' +
    '5HcH/heRrB4MvrE1J76WF3fvZ03aHVcnlLtQeiNNOZ7VbBDXdie8Nomf/QswbBGa' +
    'VwIDAQAB'

const defaultPlaintextComponentId = 'iodkpdagapdfkphljnddpjlldadblomo'
const defaultPlaintextPubkey =
    'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsD/B/MGdz0gh7WkcFARn' +
    'ZTBX9KAw2fuGeogijoI+fET38IK0L+P/trCT2NshqhRNmrDpLzV2+Dmes6PvkA+O' +
    'dQkUV6VbChJG+baTfr3Oo5PdE0WxmP9Xh8XD7p85DQrk0jJilKuElxpK7Yq0JhcT' +
    'Sc3XNHeTwBVqCnHwWZZ+XysYQfjuDQ0MgQpS/s7U04OZ63NIPe/iCQm32stvS/pE' +
    'ya7KdBZXgRBQ59U6M1n1Ikkp3vfECShbBld6VrrmNrl59yKWlEPepJ9oqUc2Wf2M' +
    'q+SDNXROG554RnU4BnDJaNETTkDTZ0Pn+rmLmp1qY5Si0yGsfHkrv3FS3vdxVozO' +
    'PQIDAQAB'

const generateManifestFile = async (name, base64PublicKey, uuid) => {
  const manifest = '{\n' +
                 '  "description": "Brave Ad Block Updater extension",\n' +
                 '  "key": "' + base64PublicKey + '",\n' +
                 '  "manifest_version": 2,\n' +
                 '  "name": "Brave Ad Block Updater (' + name + ')",\n' +
                 '  "version": "0.0.0"\n' +
                 '}\n'

  const filePath = path.join(outPath, uuid, 'manifest.json')
  return fs.writeFile(filePath, manifest)
}

const generateManifestFileForDefaultAdblock =
  generateManifestFile.bind(null, 'Default', defaultAdblockBase64PublicKey, 'default')

const generateManifestFileForDefaultPlaintextAdblock =
  generateManifestFile.bind(null, 'Default (plaintext)', defaultPlaintextPubkey, defaultPlaintextComponentId)

const generateManifestFileForRegionalCatalog =
  generateManifestFile.bind(null, 'Regional Catalog', regionalCatalogPubkey, regionalCatalogComponentId)

const generateManifestFileForResources =
  generateManifestFile.bind(null, 'Resources', resourcesPubkey, resourcesComponentId)

const generateManifestFilesForAllRegions = async () => {
  const regionalLists = await getRegionalLists()
  return Promise.all(regionalLists.map(async region => {
    await generateManifestFile(region.title, region.base64_public_key, region.uuid, region)
    if (region.list_text_component) {
      await generateManifestFile(region.title + ' (plaintext)', region.list_text_component.base64_public_key, region.list_text_component.component_id)
    }
  }))
}

generateManifestFileForDefaultAdblock()
  .then(generateManifestFileForDefaultPlaintextAdblock)
  .then(generateManifestFileForRegionalCatalog)
  .then(generateManifestFileForResources)
  .then(generateManifestFilesForAllRegions)
  .then(() => {
    console.log('Thank you for updating the data files, don\'t forget to upload them too!')
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
