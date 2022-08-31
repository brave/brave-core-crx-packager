const { uBlockResources } = require('adblock-rs')

const path = require('path')
const fs = require('fs').promises
const request = require('request')

const uBlockLocalRoot = 'submodules/uBlock'
const uBlockWebAccessibleResources = path.join(uBlockLocalRoot, 'src/web_accessible_resources')
const uBlockRedirectEngine = path.join(uBlockLocalRoot, 'src/js/redirect-engine.js')
const uBlockScriptlets = path.join(uBlockLocalRoot, 'assets/resources/scriptlets.js')

const braveResourcesUrl = 'https://raw.githubusercontent.com/brave/adblock-resources/master/dist/resources.json'

const defaultListsUrl = 'https://raw.githubusercontent.com/brave/adblock-resources/master/filter_lists/default.json'
const regionalListsUrl = 'https://raw.githubusercontent.com/brave/adblock-resources/master/filter_lists/regional.json'

const defaultPlaintextComponentId = 'iodkpdagapdfkphljnddpjlldadblomo'
const defaultPlaintextPubkey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsD/B/MGdz0gh7WkcFARnZTBX9KAw2fuGeogijoI+fET38IK0L+P/trCT2NshqhRNmrDpLzV2+Dmes6PvkA+OdQkUV6VbChJG+baTfr3Oo5PdE0WxmP9Xh8XD7p85DQrk0jJilKuElxpK7Yq0JhcTSc3XNHeTwBVqCnHwWZZ+XysYQfjuDQ0MgQpS/s7U04OZ63NIPe/iCQm32stvS/pEya7KdBZXgRBQ59U6M1n1Ikkp3vfECShbBld6VrrmNrl59yKWlEPepJ9oqUc2Wf2Mq+SDNXROG554RnU4BnDJaNETTkDTZ0Pn+rmLmp1qY5Si0yGsfHkrv3FS3vdxVozOPQIDAQAB'

const regionalCatalogComponentId = 'gkboaolpopklhgplhaaiboijnklogmbc'
const regionalCatalogPubkey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsAnb1lw5UA1Ww4JIVE8PjKNlPogAdFoie+Aczk6ppQ4OrHANxz6oAk1xFuT2W3uhGOc3b/1ydIUMqOIdRFvMdEDUvKVeFyNAVXNSouFF7EBLEzcZfFtqoxeIbwEplVISUm+WUbsdVB9MInY3a4O3kNNuUijY7bmHzAqWMTrBfenw0Lqv38OfREXCiNq/+Jm/gt7FhyBd2oviXWEGp6asUwNavFnj8gQDGVvCf+dse8HRMJn00QH0MOypsZSWFZRmF08ybOu/jTiUo/TuIaHL1H8y9SR970LqsUMozu3ioSHtFh/IVgq7Nqy4TljaKsTE+3AdtjiOyHpW9ZaOkA7j2QIDAQAB'

const resourcesComponentId = 'mfddibmblmbccpadfndgakiopmmhebop'
const resourcesPubkey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7Qk6xtml8Siq8RD6cCbdJpArt0kMci82W/KYw3KR96y67MZAsKJa8rOV2WC1BIpW539Qgl5b5lMS04cjw+sSB7f2ZKM1WOqKNij24nvEKVubunP32u8tbjtzQk9VYNcM2MZMs330eqk7iuBRTvRViSMSeE3ymqp03HFpUGsdtjEBh1A5lroCg41eVnMn1I4GKPvuhT/Qc9Yem5gzXT/3n7H6vOGQ2dVBHz44mhgwtiDcsduh+Det6lCE2TgHOhHPdCewklgcoiNXP4zfXxfpPy1jbwb4w5KUnHSRelhfDnt+jI3jgHsD4IXdVNE5H5ZAnmcOJttbkRiT8kOVS0rJXwIDAQAB'

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

const lazyInit = (fn) => {
  let prom
  return () => {
    prom = prom || fn()
    return prom
  }
}

const generateResources = lazyInit(() => new Promise((resolve, reject) => {
  const resourceData = uBlockResources(
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
    resolve(JSON.stringify(resourceData))
  })
}))

/**
 * Returns a promise that generates a resources file from the uBlock Origin
 * repo hosted on GitHub
 */
const generateResourcesFile = async (outLocation) => {
  return fs.writeFile(outLocation, await generateResources(), 'utf8')
}

module.exports.defaultPlaintextComponentId = defaultPlaintextComponentId
module.exports.defaultPlaintextPubkey = defaultPlaintextPubkey
module.exports.regionalCatalogComponentId = regionalCatalogComponentId
module.exports.regionalCatalogPubkey = regionalCatalogPubkey
module.exports.resourcesComponentId = resourcesComponentId
module.exports.resourcesPubkey = resourcesPubkey
module.exports.generateResourcesFile = generateResourcesFile
module.exports.getDefaultLists = getDefaultLists
module.exports.getRegionalLists = getRegionalLists
