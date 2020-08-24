/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const request = require('request')

const GLOBAL_REGIONS_CHANGED_TAG_FILE = 'global-regions-changed-tag-file.json'

function getTargetRegionFromTagFile (dataUrl) {
  const tagFileUrl = `${dataUrl}${GLOBAL_REGIONS_CHANGED_TAG_FILE}`
  return new Promise(function (resolve, reject) {
    request(tagFileUrl, async function (error, response, body) {
      if (error) {
        return reject(new Error(`Request error: ${error}`))
      }

      // 404 is not an error. If there is no target to update crx, tag file is
      // not existed.
      if (response.statusCode === 404) {
        resolve({ regions: []})
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`Error status code ${response.statusCode} returned for URL: ${tagFileUrl}`))
      }

      resolve(JSON.parse(body))
    })
  })
}

module.exports = {
  getTargetRegionFromTagFile
}
