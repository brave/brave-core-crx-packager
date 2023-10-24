/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import path from 'path'
import { mkdirp } from 'mkdirp'
import fs from 'fs-extra'
import commander from 'commander'
import util from '../lib/util.js'

const jsonSchemaVersion = 1

const createDataJsonFile = (path, body) => {
  fs.writeFileSync(path, body)
}

function downloadMappingTableJsonFile (jsonFileUrl, targetFilePath) {
  return new Promise(function (resolve, reject) {
    let jsonFileBody = '{}'

    fetch(jsonFileUrl).then(async function (response) {
      if (response.status === 200) {
        jsonFileBody = await response.text()
      }

      const data = JSON.parse(jsonFileBody)
      // Make sure the data has a schema version so that clients can opt to parse or not
      const incomingSchemaVersion = data.schemaVersion
      if (!incomingSchemaVersion) {
        // Source has no schema version, assume and set current version.
        // TODO(petemill): Don't allow this once the source is established to always
        // have a schema version.
        data.schemaVersion = jsonSchemaVersion
      } else if (incomingSchemaVersion !== jsonSchemaVersion) {
        // We don't support this file format
        const error = `Error: Cannot parse JSON data at ${jsonFileUrl} since it has a schema version of ${incomingSchemaVersion} but we expected ${jsonSchemaVersion}! This region will not be updated.`
        console.error(error)
        return reject(error)
      }

      createDataJsonFile(targetFilePath, JSON.stringify(data))

      resolve()
    }).catch(error => {
      throw new Error(`Error from ${jsonFileUrl}: ${error.cause}`)
    })
  })
}

async function generateNTPSuperReferrerMappingTable (dataUrl) {
  const rootResourceDir = path.join(path.resolve(), 'build', 'ntp-super-referrer', 'resources', 'mapping-table')
  mkdirp.sync(rootResourceDir)

  console.log(`Downloading ${dataUrl}...`)
  const targetFilePath = path.join(rootResourceDir, 'mapping-table.json')
  await downloadMappingTableJsonFile(dataUrl, targetFilePath)
}

util.installErrorHandlers()

commander
  .option('-d, --data-url <url>', 'url that refers to data that has ntp super referrer')
  .parse(process.argv)

generateNTPSuperReferrerMappingTable(commander.dataUrl)
