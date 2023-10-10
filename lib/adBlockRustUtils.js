import { uBlockResources } from 'adblock-rs'

import path from 'path'
import { promises as fs } from 'fs'

const uBlockLocalRoot = 'submodules/uBlock'
const uBlockWebAccessibleResources = path.join(uBlockLocalRoot, 'src/web_accessible_resources')
const uBlockRedirectEngine = path.join(uBlockLocalRoot, 'src/js/redirect-resources.js')
const uBlockScriptlets = path.join(uBlockLocalRoot, 'assets/resources/scriptlets.js')

const braveResourcesUrl = 'https://raw.githubusercontent.com/brave/adblock-resources/master/dist/resources.json'

const listCatalogUrl = 'https://raw.githubusercontent.com/brave/adblock-resources/master/filter_lists/list_catalog.json'

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
const requestJSON = (url) => {
  return fetch(url).then(response => {
    if (response.status !== 200) {
      throw new Error(`Error status ${response.status} ${response.statusText} returned for URL: ${url}`)
    }
    return response.json()
  }).catch(error => {
    throw new Error(`Error when fetching ${url}: ${error.message}`)
  })
}

const lazyInit = (fn) => {
  let prom
  return () => {
    prom = prom || fn()
    return prom
  }
}

const getListCatalog = lazyInit(async () => {
  return requestJSON(listCatalogUrl)
})

// Legacy logic requires a distinction between default and regional lists.
// This can be removed once DAT support is no longer needed by iOS.
const isDefaultList = entry => entry.default_enabled && entry.hidden
const getDefaultLists = () => getListCatalog().then(catalog => {
  return catalog.filter(isDefaultList)
})
const getRegionalLists = () => getListCatalog().then(catalog => {
  return catalog.filter(entry => !isDefaultList(entry))
})

// Wraps new template scriptlets with the older "numbered template arg" format and any required dependency code
const wrapScriptletArgFormat = (fnString, dependencyPrelude) => `{
  const args = ['{{1}}', '{{2}}', '{{3}}', '{{4}}', '{{5}}', '{{6}}', '{{7}}', '{{8}}', '{{9}}'];
  let last_arg_index = 0;
  for (const arg_index in args) {
    if (args[arg_index] === '{{' + (Number(arg_index) + 1) + '}}') {
      break;
    }
    last_arg_index += 1;
  }
  ${dependencyPrelude}
  (${fnString})(...args.slice(0, last_arg_index))
}`

const generateResources = lazyInit(async () => {
  const { builtinScriptlets } = await import(path.join('..', uBlockScriptlets).toString())

  const dependencyFns = builtinScriptlets.filter(s => s.name.endsWith('.fn'))
  const dependencyMap = dependencyFns.reduce((map, entry) => {
    map[entry.name] = entry
    return map
  }, {})

  const transformedUboBuiltins = builtinScriptlets.filter(s => !s.name.endsWith('.fn')).map(s => {
    // Bundle dependencies wherever needed. This causes some small duplication but makes each scriptlet fully self-contained.
    let dependencyPrelude = ''
    const requiredDependencies = s.dependencies ?? []
    for (const dep of requiredDependencies) {
      for (const recursiveDep of dependencyMap[dep].dependencies ?? []) {
        if (!requiredDependencies.includes(recursiveDep)) {
          requiredDependencies.push(recursiveDep)
        }
      }
    }
    for (const dep of requiredDependencies.reverse()) {
      const thisDepCode = dependencyMap[dep].fn.toString()
      if (thisDepCode === undefined) {
        throw new Error(`Couldn't find dependency ${dep}`)
      }
      dependencyPrelude += thisDepCode + '\n'
    }
    const content = Buffer.from(wrapScriptletArgFormat(s.fn.toString(), dependencyPrelude)).toString('base64')
    // in Brave Browser, bit 0 (i.e. 1 << 0) signifies uBO resource permission.
    return {
      name: s.name,
      aliases: s.aliases ?? [],
      kind: { mime: 'application/javascript' },
      content,
    }
  })

  const resourceData = uBlockResources(
    uBlockWebAccessibleResources,
    uBlockRedirectEngine
  )

  const braveResources = await requestJSON(braveResourcesUrl)
  resourceData.push(...braveResources)
  resourceData.push(...transformedUboBuiltins)
  return JSON.stringify(resourceData)
})

/**
 * Returns a promise that generates a resources file from the uBlock Origin
 * repo hosted on GitHub
 */
const generateResourcesFile = async (outLocation) => {
  return fs.writeFile(outLocation, await generateResources(), 'utf8')
}

export {
  regionalCatalogComponentId,
  regionalCatalogPubkey,
  resourcesComponentId,
  resourcesPubkey,
  generateResourcesFile,
  getListCatalog,
  getDefaultLists,
  getRegionalLists
}
