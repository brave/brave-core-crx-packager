const { uBlockResources } = require('adblock-rust')

const path = require('path')
const fs = require('fs')
const request = require('request')

const uBlockLocalRoot = 'submodules/uBlock'
const uBlockWebAccessibleResources = path.join(uBlockLocalRoot, 'src/web_accessible_resources')
const uBlockRedirectEngine = path.join(uBlockLocalRoot, 'src/js/redirect-engine.js')
const uBlockScriptlets = path.join(uBlockLocalRoot, 'assets/resources/scriptlets.js')

const braveResourcesUrl = 'https://raw.githubusercontent.com/brave/adblock-resources/master/dist/resources.json'

/**
 * Returns a promise that generates a resources file from the uBlock Origin
 * repo hosted on GitHub
 */
const generateResourcesFile = (outLocation) => {
  return new Promise((resolve, reject) => {
    let resourceData = uBlockResources(
      uBlockWebAccessibleResources,
      uBlockRedirectEngine,
      uBlockScriptlets
    )
    request.get(braveResourcesUrl, function (error, response, body) {
      if (error) {
        reject(new Error(`Request error: ${error}`))
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Error status code ${response.statusCode} returned for URL: ${braveResourcesUrl}`))
      }
      const braveResources = JSON.parse(body)
      resourceData.push(...braveResources)
      fs.writeFileSync(outLocation, JSON.stringify(resourceData), 'utf8')
      resolve()
    })
  })
}

module.exports.generateResourcesFile = generateResourcesFile
