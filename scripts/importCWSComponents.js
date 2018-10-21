/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const commander = require('commander')
const mkdirp = require('mkdirp')
const path = require('path')
const util = require('../lib/util')

util.installErrorHandlers()

commander
  .option('-e, --endpoint <endpoint>', 'DynamoDB endpoint to connect to', '')// If setup locally, use http://localhost:8000
  .option('-r, --region <region>', 'The AWS region to use', 'us-east-2')
  .parse(process.argv)

// The list of components to import from the Chrome Web Store
const components = [ [ 'oemmndcbldboiebfnladdacbdfmadadm', '70.0.3538.54' ] ]

const outputDir = path.join('build', 'cws')

mkdirp.sync(outputDir)

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  components.map((component) => {
    const componentId = component[0]
    const chromiumVersion = component[1]
    const crxFile = path.join(outputDir, `${componentId}.crx`)
    util.downloadExtensionFromCWS(componentId, chromiumVersion, crxFile)
      .then(() => {
        console.log(`Downloaded component ${componentId} from Chrome Web Store`)
        util.uploadCRXFile(commander.endpoint, commander.region, crxFile, componentId)
      })
  })
})
