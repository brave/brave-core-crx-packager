import { Engine, FilterSet, uBlockResources } from 'adblock-rs'

import path from 'path'
import { promises as fs } from 'fs'

import { compress } from '@mongodb-js/zstd'

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
  const args = ["{{1}}", "{{2}}", "{{3}}", "{{4}}", "{{5}}", "{{6}}", "{{7}}", "{{8}}", "{{9}}"];
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

  const dependencyMap = builtinScriptlets.reduce((map, entry) => {
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
      content
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

/**
 * A list of requests that should not be blocked unless the list has some serious issue.
 *
 * Each element is [requestUrl, sourceUrl, requestType].
 */
const sampleUnblockedNetworkRequests = [
  // real resources from a personal website which will never ship ads/trackers
  ['https://antonok.com', 'https://antonok.com', 'document'],
  ['https://antonok.com/style.css?h=9aba43f4dd864e1e4f3a', 'https://antonok.com', 'stylesheet'],
  ['https://antonok.com/res/font/icons.woff2?h=598bc5b2aa7cdaf390d9', 'https://antonok.com', 'font'],
  ['https://antonok.com/res/antonok-logo.svg', 'https://antonok.com', 'image'],
  ['https://antonok.com/processed_images/profile-2021-05-03.14f955fe3ab1a230.webp', 'https://antonok.com', 'image'],
  // real resources from brave.com
  ['https://brave.com', 'https://brave.com', 'document'],
  ['https://brave.com/js/navigation.js', 'https://brave.com', 'script'],
  ['https://brave.com/static-assets/css-old/main.min.css', 'https://brave.com', 'stylesheet'],
  ['https://brave.com/static-assets/images/brave-logo-sans-text.svg', 'https://brave.com', 'image'],
  // real resources from Brave's QA testing pages
  ['https://dev-pages.brave.software/filtering/index.html', 'https://dev-pages.brave.software/filtering/index.html', 'document'],
  ['https://dev-pages.brave.software/static/css/bootstrap.min.css', 'https://dev-pages.brave.software/filtering/index.html', 'stylesheet'],
  ['https://dev-pages.brave.software/static/css/site.css', 'https://dev-pages.brave.software/filtering/index.html', 'stylesheet'],
  ['https://dev-pages.brave.software/static/js/site.js', 'https://dev-pages.brave.software/filtering/index.html', 'script'],
  ['https://dev-pages.bravesoftware.com/filtering/index.html', 'https://dev-pages.bravesoftware.com/filtering/index.html', 'document'],
  ['https://dev-pages.bravesoftware.com/static/images/test.jpg', 'https://dev-pages.bravesoftware.com/filtering/additional-lists.html', 'image'],
  // real resources from wikipedia.org
  ['https://en.wikipedia.org/wiki/Ad_blocking', 'https://en.wikipedia.org/wiki/Ad_blocking', 'document'],
  ['https://en.wikipedia.org/w/load.php?lang=en&modules=codex-search-styles%7Cext.cite.styles%7Cext.pygments%2CwikimediaBadges%7Cext.uls.interlanguage%7Cext.visualEditor.desktopArticleTarget.noscript%7Cskins.vector.icons%2Cstyles%7Cskins.vector.zebra.styles%7Cwikibase.client.init&only=styles&skin=vector-2022', 'https://en.wikipedia.org/wiki/Ad_blocking', 'stylesheet'],
  ['https://en.wikipedia.org/w/load.php?lang=en&modules=startup&only=scripts&raw=1&skin=vector-202', 'https://en.wikipedia.org/wiki/Ad_blocking', 'script'],
  ['https://en.wikipedia.org/static/images/mobile/copyright/wikipedia-wordmark-en.svg', 'https://en.wikipedia.org/wiki/Ad_blocking', 'image'],
  ['https://en.wikipedia.org/static/images/icons/wikipedia.png', 'https://en.wikipedia.org/wiki/Ad_blocking', 'image'],
  // hypothetical embeddings on example.com
  ['https://antonok.com', 'https://example.com', 'subdocument'],
  ['https://brave.com', 'https://example.com', 'subdocument'],
  ['https://en.wikipedia.org/wiki/Ad_blocking', 'https://example.com', 'subdocument']
]

/*
 * Throw an error if the list is blocking any of the resources from `sampleNetworkRequests`.
 */
const sanityCheckList = async ({ title, format, data }) => {
  const dataSplit = data.split('\n')
  {
    const filterSet = new FilterSet()
    filterSet.addFilters(dataSplit, { format })
    const engine = new Engine(filterSet)
    for (const request of sampleUnblockedNetworkRequests) {
      const result = engine.check(request[0], request[1], request[2])
      if (result) {
        throw new Error(title + ' failed sanity check for ' + request + '. Check for corrupted list contents.')
      }
    }
  }

  // Also, attempt to convert the rules to iOS content blocking syntax via adblock-rust and see if they are valid as per webkit-content-filter-validator.
  {
    const filterSet = new FilterSet(true)
    filterSet.addFilters(dataSplit, { format })
    const { contentBlockingRules } = filterSet.intoContentBlocking()
    let body = JSON.stringify(contentBlockingRules)
    const contentType = 'application/json'
    const headers = {
      'Content-Type': contentType
    }

    // The AWS lambda payload size limit is listed as 6291456 bytes,
    // although it appears to fail even at some lower values.
    if (body.length >= 5000000) {
      body = await compress(Buffer.from(body))
      headers['Content-Encoding'] = 'application/zstd'
    }

    const response = await fetch('https://2sq625b43mykl2tqumoue7j4k40vkupj.lambda-url.us-west-2.on.aws', {
      body,
      headers,
      method: 'POST'
    })
    if (response.status === 400) {
      const reason = await response.text()
      if (reason === '') {
        throw new Error(title + ' could not be converted to iOS content blocking syntax. Reason: out of memory or other lambda-specific issue.')
      } else if (reason === 'Empty extension.\n') {
        // Some sublists are no-op when converted individually; this is fine.
      } else if (reason === 'Too many rules in JSON array.\n') {
        // We might eventually want to do something here if a list grows to become too large,
        // but for lists that are already past the threshold, there's not much we can do.
      } else {
        throw new Error(title + ' could not be converted to iOS content blocking syntax. Reason: ' + reason)
      }
    } else if (response.status === 413) {
      // AWS error: payload is too large for the RequestResponse invocation type (limit 6291456 bytes)
      throw new Error(title + ' could not be converted to iOS content blocking syntax. Reason: payload too large for AWS Lambda request.')
    } else if (response.status !== 200) {
      throw new Error(title + ' encountered unexpected error (' + response.status + ') during conversion.')
    }
  }
}

const IF_CONDITIONS = new Map([
  ['ext_ublock', true],
  // [ 'ext_ubol', 'ubol' ],
  // [ 'ext_devbuild', 'devbuild' ],
  ['env_chromium', true],
  ['env_edge', false],
  ['env_firefox', false],
  ['env_legacy', false],
  // [ 'env_mobile', 'mobile' ],
  // [ 'env_mv3', 'mv3' ],
  ['env_safari', false],
  ['cap_html_filtering', false],
  ['cap_user_stylesheet', true],
  ['false', false],
  ['ext_abp', false],
  ['adguard', false],
  ['adguard_app_android', false],
  ['adguard_app_ios', false],
  ['adguard_app_mac', false],
  ['adguard_app_windows', false],
  ['adguard_ext_android_cb', false],
  ['adguard_ext_chromium', true],
  ['adguard_ext_edge', false],
  ['adguard_ext_firefox', false],
  ['adguard_ext_opera', true],
  ['adguard_ext_safari', false]
])

const preprocess = (listBuffer) => {
  const [NORMAL, IF_BRAVE, IF_NOT_BRAVE, IF_WHATEVER] = [0, 1, 2, 3]
  const negateIfState = (currentState) => {
    if (currentState === IF_WHATEVER) return currentState
    return currentState === IF_BRAVE
      ? IF_NOT_BRAVE
      : IF_BRAVE
  }
  const stack = []
  const ifRegex = /^!#if (!?)(.*)$/
  const popStack = () => {
    if (stack.length === 0) {
      throw new Error(listBuffer.title + ' preprocessor error. Check for corrupted list contents.')
    }
    return stack.pop()
  }

  listBuffer.data = listBuffer.data.split('\n').filter(line => {
    line = line.trim()
    const currentIfStatePeek = stack.length === 0 ? NORMAL : stack[stack.length - 1]
    const ifMatch = line.match(ifRegex)
    if (ifMatch !== null) {
      if (currentIfStatePeek === IF_NOT_BRAVE) {
        // We are in falsey land, maintain falsey but record if-depth on stack
        stack.push(IF_NOT_BRAVE)
        return false
      }
      // eslint-disable-next-line no-unused-vars
      const [_, negate, variable] = ifMatch
      const variableValue = IF_CONDITIONS.get(variable)
      if (variableValue === undefined) {
        stack.push(IF_WHATEVER)
        return false
      }
      const conditionValue = negate === '!' ? !variableValue : variableValue
      stack.push(conditionValue ? IF_BRAVE : IF_NOT_BRAVE)
      return false
    }
    if (line === '!#else') {
      stack.push(negateIfState(popStack()))
      return false
    }
    if (line === '!#endif') {
      popStack()
      return false
    }
    return currentIfStatePeek !== IF_NOT_BRAVE
  }).join('\n')
  if (stack.length !== 0) {
    throw new Error(listBuffer.title + ' preprocessor stack not empty at end. Check for corrupted list contents.')
  }
  return listBuffer
}

export {
  preprocess,
  regionalCatalogComponentId,
  regionalCatalogPubkey,
  resourcesComponentId,
  resourcesPubkey,
  sanityCheckList,
  generateResourcesFile,
  getListCatalog,
  getDefaultLists,
  getRegionalLists
}
