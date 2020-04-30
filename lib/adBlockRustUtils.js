const { uBlockResources } = require('adblock-rs')

const path = require('path')
const fs = require('fs')

const uBlockLocalRoot = 'submodules/uBlock'
const uBlockWebAccessibleResources = path.join(uBlockLocalRoot, 'src/web_accessible_resources')
const uBlockRedirectEngine = path.join(uBlockLocalRoot, 'src/js/redirect-engine.js')
const uBlockScriptlets = path.join(uBlockLocalRoot, 'assets/resources/scriptlets.js')

/**
 * Returns a promise that generates a resources file from the uBlock Origin
 * repo hosted on GitHub
 */
const generateResourcesFile = (outLocation) => {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(uBlockResources(
      uBlockWebAccessibleResources,
      uBlockRedirectEngine,
      uBlockScriptlets
    ))
    fs.writeFileSync(outLocation, jsonData, 'utf8')
    resolve()
  })
}

module.exports.generateResourcesFile = generateResourcesFile
