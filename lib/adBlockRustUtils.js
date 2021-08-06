const { uBlockResources } = require('adblock-rs')

const path = require('path')
const fs = require('fs')
const request = require('request')

const uBlockLocalRoot = 'submodules/uBlock'
const uBlockWebAccessibleResources = path.join(uBlockLocalRoot, 'src/web_accessible_resources')
const uBlockRedirectEngine = path.join(uBlockLocalRoot, 'src/js/redirect-engine.js')
const uBlockScriptlets = path.join(uBlockLocalRoot, 'assets/resources/scriptlets.js')

const braveResourcesUrl = 'https://github.com/brave/adblock-resources/blob/master/dist/resources.json?raw=true'

const defaultListsUrl = 'https://raw.githubusercontent.com/brave/adblock-resources/master/filter_lists/default.json'
const regionalListsUrl = 'https://raw.githubusercontent.com/brave/adblock-resources/master/filter_lists/regional.json'

/**
 * Returns a promise that which resolves with the body parsed as JSON
 *
 * @param url The URL to fetch from
 * @return a promise that resolves with the content of the list or rejects with an error message.
 */
const requestJSON = (url) => new Promise((resolve, reject) => {
  request.get(url, function (error, response, body) {
    if (error) {
      reject(new Error(`Request error: ${error}`))
      return
    }
    if (response.statusCode !== 200) {
      reject(new Error(`Error status code ${response.statusCode} returned for URL: ${url}`))
      return
    }
    resolve(JSON.parse(body))
  })
})

const getDefaultLists = requestJSON.bind(null, defaultListsUrl)
const getRegionalLists = requestJSON.bind(null, regionalListsUrl)

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
module.exports.getDefaultLists = getDefaultLists
module.exports.getRegionalLists = getRegionalLists
