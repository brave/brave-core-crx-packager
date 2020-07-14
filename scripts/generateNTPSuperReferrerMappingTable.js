/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const path = require('path')
const mkdirp = require('mkdirp')
const fs = require('fs-extra')
const request = require('request')
const commander = require('commander')
const util = require('../lib/util')

const jsonSchemaVersion = 1

const createDataJsonFile = (path, body) => {
  fs.writeFileSync(path, body)
}

function downloadMappingTableJsonFile (jsonFileUrl, targetFilePath) {
  return new Promise(function (resolve, reject) {
    let jsonFileBody = '{}'

    request(jsonFileUrl, async function (error, response, body) {
      if (error) {
        console.error(`Error from ${jsonFileUrl}:`, error)
        return reject(error)
      }
      if (response && response.statusCode === 200) {
        jsonFileBody = body
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
        console.error(`Error: Cannot parse JSON data at ${jsonFileUrl} since it has a schema version of ${incomingSchemaVersion} but we expected ${jsonSchemaVersion}! This region will not be updated.`)
        return reject(error)
      }

      createDataJsonFile(targetFilePath, JSON.stringify(data))

      resolve()
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
