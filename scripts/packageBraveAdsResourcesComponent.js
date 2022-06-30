/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const childProcess = require('child_process')
const commander = require('commander')
const fs = require('fs-extra')
const mkdirp = require('mkdirp')
const path = require('path')
const replace = require('replace-in-file')
const util = require('../lib/util')

const getComponentDataList = () => {
  return [
    {
      locale: 'iso_3166_1_ca',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwSGYa6ZpRmQQNSXZDZCMRZYyUXKqyCaDkHb8mucgKbNCNkwOTgqMKv1dqi1fZrniIIR/dLHb9YwX+gfWb8ZaO5Xhm9H5iqTpo9qk5g0zM7Ba9+2h0nJVPjSuPen84rvzuKqx17I+6GTIc8j/E1O7uRWaqBqLAOHfMAusJNtVSpXlFAvn8iPO3oIxzPwkATVEzc1jLQgxkdVkBZ67Ivp6jRkLd9T5Q2XtcJ6wr0CEzO9ypimyu2NM5Xkfzza0xE54LddrNbFcATg/wpx5B5Mw7zMgEDIhTkaOnv+pHgpKwMamlazH9ivmXvxfR/ToX3uRY+STapbJ4dkd7UBH3XqGWQIDAQAB',
      id: 'lgejdiamednlaeiknhnnjnkofmapfbbf'
    },
    {
      locale: 'iso_3166_1_pt',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwBwlUQPOENLpI4J0hiO2xCIwVQRMEoM0Eqsf1YZ4kUV2QzhLmZ3ScHw/YtEh2Uz7hE/bLRwkENY/OdJ6/gqL9NxirXKuTt1kF3ejxYAxh1lwicUb15W4S+8wSWaal3CGVOqCih/oXXI+0SLETBplLhPSfMWMwBB0jxj6axEGGYexDnIrXXibSaKc+7U/wYB/I7PhojLWvVOqEMU6aPfE01F+5b/8XCcgjixUFkpwCO3MLH5zbSfh0dCDYWGTVdF/np0hvMfksb8HBNR8V76TIbBimrCCaVLW5wbAxezBBOfkWkhzUt4Qn2WDwoAIFY9U/aK4huV7uzHx2nNN3nozIQIDAQAB',
      id: 'gchnahcajhccobheiedkgdpfboljkhge'
    },
    {
      locale: 'iso_3166_1_de',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsem6Ih5+e6dxLjuak9R9hrx/XShs8N+pLqnvoYSqj5XT8d64kC24u7/QOUNvn9lcawT4wikmmHjRB0yDO9VU+Gltm52jFBVlpBaCKAT+cd56D+seIo6IaFnb42tv5wDQ1yQqvEFr2BOTdd5DX8lRmdQLWGZ2zm294xsih8ZjDZtO8CDtlFpUTwv0iGo30aOF6TcWrZ988h0zolO1xMh5MYIJs54+GYqF1cNjk+p4WJl4q/aWdgTxbzIAVvaJUavxYhYwQ0SzlFHDAa24diExS+VC/R+W5ymi7J/V5QPwXpld9sBfRW9/LFIdyzbeGkYtgNCsQPw5J1/FREfD/YZmowIDAQAB',
      id: 'jcncoheihebhhiemmbmpfhkceomfipbj'
    },
    {
      locale: 'iso_3166_1_at',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwtjBxtziOYDWsMtySX36Wl1K+4mrCpr+EPYHSee1IN0VVHeWRxYfbjWUiCQKBOg5Rc2bdyu1lbkjEyYvsEgZQjg9dtA6i6DfXWGmpm6+JTGx6horNiyHBT00yb+i0M915zh1S9zxus7Xj9sa2EdJefvl+Sd6wcCpVb9kJveAKUtHqcTReUkXkEw0o50/E3UaPs0619APiTFbnOSdOGhu3atBsPV2x7wIlygpdIYpB4fP4Z1C6MQHaWJ7qxsVylWZpidblCeC3X/pF4GGA7M+CmsaJfDu6O4PTftAaqIPAba2dDYPa/f6/NCI+5NlQHULdIRkCWkkWtBhvJvoavsdqwIDAQAB',
      id: 'jmneklmcodckmpipiekkfaokobhkflep'
    },
    {
      locale: 'iso_3166_1_ch',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3Uiy25uPXaFMtJF5+tB4Y7eXB0fpCXeTI3gx19W5hjneipXUIOzLZ0d4KKbeLAckYmwlaMsq4H9EQMfRKnQTGvncAlteAOMZyVCcVN6LpfeJlT9hYOyg/NMfudxrKBoE+KAAudPMHTN8TWJ4abOCGcAGAIzXX574nth2aqm7bBQu2R5ulAg+W2M4D+4GIJNk7VMa9AJWLwiioIypObieWrf0gtvGnceqjM+QT2tMweWgNmUwHhoDKht+e7ssufpQHLWBzLPrRKhu6jTLODrreXdwFGZ5RgZWoFsI8J9wmRHGYUBfE/ARq5lVYXxTzwou1LwxwaZfOB3mkRseorGD0wIDAQAB',
      id: 'gnamhdlealpfbanappoephfdjeoehggd'
    },
    {
      locale: 'iso_3166_1_be',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtH3+qC/78pPp89oDElZclPvbQdukfG36kOPleQZU/MVDDWvnRj7S6Ax70QzoYbkKRn0fKpfshXB9/ew6oHm685ixje3zwhSFLzNWjYT9GMm/ISxOAaiomlVAshX2oUI//ZB7+SMxf7WCojFpfJ03M+ECGVquNZvUh81fKkN5a0pgEGFNLlP5aCOjLYO4O9xAaAFRUPIYkjLuyC3sQptz6YEjNHTHZdgjV+i02I3MbZexAAzsQRny4SZ+OtNzAOPzfl9KgAo89cdEpxYtd2GNc6Fbe4KjM3nat0ExNzKfONhPWt0HmoNV5gyhAiqu0XUuHvA4EBg6gsOETZOrSUi5nwIDAQAB',
      id: 'lnbdfmpjjckjhnmahgdojnfnmdmpebfn'
    },
    {
      locale: 'iso_3166_1_fr',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1CVf+LPIqWzGBD2sAXjaUvM8oYMRqosWNeiseX2dfLJ5H+Bz9JgtaiYfFGGOiq2D/44c8ona+K/j8F4Ta0WbDFUCJTCFMoYLQgxNjsDiYhTSCCxX8wQwbOOFdNJppiqVLfp9Up6tb/KiKpMqZoJLqx8hT0uOvVD08d4yy+HMLXBbSPG8Vp11pCWcADmc+KZHORZHN1rwh5sSQ6iCgfQKxVH7P/2o762216Wtsswjg1TQtoYt6w3d8VUSXR3012R51CWi69YW9UFh0rDoD0FYKRGFo3YFbHrWmvU4UpR8MYX1ZJ5x9q81nRtb5F1bRjQ8uo1p4gbcqtQTj2CTbEospwIDAQAB',
      id: 'bgifagoclclhhoflocdefiklgodpihog'
    },
    {
      locale: 'iso_3166_1_nl',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAx2O6QI9v3dyu6TnZuRdETciQUm5rITTKYd4IuHLB0OWd8lwzQOYEpfZ5SSwlW3pDZ/e8SJENAs6h/u+G/ih9xRjxEhhMQ5wfuQW7dyDIS3eA/6d4zUUAPaZzJtuZaM8HYMjUGZ+qf2oWsZLCEDkynR+Fy8/6hsV54FtaKhI39iIhovPd+7UzggCTPi3dSYrDPN93udESK/ssRhguU+85tm/EbrTXLFP+jgtvRd+igT+hxYcCDjcsXqMF4Oo5hSwH1Qr9I1MNmjnR7hmyW7ABv4Soq6/E2GIPAoohNjWsTi3UtAcKohoxAFsVbJ4udEUx2r/tLZ6JKxfKnEyNdLv6NQIDAQAB',
      id: 'choggjlbfndjppfiidbhmefapnlhcdhe'
    },
    {
      locale: 'iso_3166_1_jp',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3SIk4j5tQcE9rzhvy2yZovJm5eMF38O1epzXtYGN/kNzQ5VoZy5c+2uUnEcVa/VVsqSZKuWXkqz//OlJ5tDbWKH2bMVYvOXU9QuBqK6ZKrmvsAziO+fxd8LeW/wV6WLLxE8lZKOQ/JCGfj5lYh0cqeLDfWsZcb+odDW7ecKfrfqKZFI+wJeGBLv8nbMmvFApqxP0o33pMihX0McQ62A+pjzB8QbBADu0/+lKb9LkNi34FrTp0AQhSoOWHFYAaqW3/jYIG47/EvmsEiJYwp0/HN5XhHWrdTBTLlLkG9672PslNJYqv57CbOB0yPGKAELTXZzxDNEkPQ2CNV/t4kDlNQIDAQAB',
      id: 'ikolbkmkinegpoedjeklhfnaidmloifj'
    },
    {
      locale: 'iso_3166_1_gb',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAttE8dno9TryntLQd2qNsHfmEJDzC2owHBcaPk6j0CEliD+NWiPAD0YmRZc+ckeXsahc5Bwh/Xz1WOzQJLXre8K8qPQhTh+uICNZ88VAWDiyXZQD20BeBZc3qhvHuKE1i1lsEbZzv3KocLCkPloP1Aihvdit8Chia/0KPxgMR1W6gZutg4gQiGVHu3fy99PC+0OVrC0HbHK+8UnNSAdi/oLuovXIfiYWJPCeK4HaeRJRfsWPBr6tWULz9Yz14g4DlujviLAJQwpOrstnFKZNkL4d++q7t3oLN7TSBf84iwimJCcR8sssmFUCOnd183s2PRCJCT9/jgTziUNTROeS/eQIDAQAB',
      id: 'cmdlemldhabgmejfognbhdejendfeikd'
    },
    {
      locale: 'iso_3166_1_us',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7xPk/eeslWG0VSSjMExUQtvn+8Ww8wCuluf97ACxiAoSspSrU1ftrjGw7U72YCKgPk1EdNKyOYpP1jQT0idxrhpTqihJQLlHm5EN3MiLDVf6MK8dqyG4PVAALMTGW6+4c77QhqnVWIRnfep96WBnJo0x5QieMWDZY79k4QMqJ2/NXMbGxyLWrNyXNy7zEnu5O/lLn68dM2it2KaQnXwCWj9DUoeaP6HTbBAgFYFE85b3nuSNX4RJfuEAod4lqdOgGsUuF/99AyCPVijuveYPrKxiBzvTcHb5GWoeKqjLi9rrqEwgxHgHZEANtIvORNQT40Q5OX+WntI1rkhn9UgMiwIDAQAB',
      id: 'iblokdlgekdjophgeonmanpnjihcjkjj'
    },
    {
      locale: 'iso_3166_1_au',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAk5hzzDC2Iq6oGC2CEhZixqq3V62xuReBQphzi0mnEYugQK4Ai0ZCF2LQ2iUKRiKJlm8Ul/hqD4p5lmNXCfcCH/IZ1OBWXSkY+mxemuXbBEJNR7XRY99Y11vldH+Q8ZZmv0tTe7Me2L9Faw7d1EK+RW0s46l8dnRSChw2Nxwt99tHYiEk+iIE8F/WiUAkOQ+cvQwlaLvsL2G3W0kqgvXoWCAIBL1Uwo9fx9Jj7HNLSPTjoOCbOTwowmWb+16KU5ufJk7kMg+ApYJwh8fwrBL+Tw1OotIHDe99kQujsWjL2k6RrG7yCJKi+mozQVDmrd6MLZFguMWC51d1jHkPK0dhQwIDAQAB',
      id: 'kklfafolbojbonkjgifmmkdmaaimminj'
    },
    {
      locale: 'iso_3166_1_nz',
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvcyuC5PcR1HRdtVGjmC2FT7mY50SkMrpYtaXNI/L7TDZk0/CBp1Zxc+DGqEbzo3avCnVX56zMAyAEfkvYZFst/NwepP9lBWsfN+nN+8+gXmCN93ATPu/2UNnyh7QnfE92DKt61+7DNpimhzv+7exzYPPj1HDe6RVgpTxT31b9XzLgBQadS6lNyZ7l58yFGb/b3I7nEEKPwop2M3oxn8uKLYituODG5Naj1aVJsFv3HgbPSkdauoIog5gcxA3lA0k3yIRiWJiQs0TkusE4Wq9sIBNts071AZ77U0EIMgplcV+Vuh6Zh9/iVKXWUdUcY5eEVFPrD6ElTu7h0MC8gln7wIDAQAB',
      id: 'dlbokjgcdlhkgfeklggoncjhihaebnai'
    }
  ]
}

const stageFiles = (locale, version, outputDir) => {
  // Copy resources and manifest file to outputDir.
  // Copy resource files
  const resourceDir = path.join(path.resolve(), 'build', 'user-model-installer', 'resources', locale, '/')
  console.log('copy dir:', resourceDir, ' to:', outputDir)
  fs.copySync(resourceDir, outputDir)

  // Fix up the manifest version
  const originalManifest = getOriginalManifest(locale)
  const outputManifest = path.join(outputDir, 'manifest.json')
  console.log('copy manifest file: ', originalManifest, ' to: ', outputManifest)
  const replaceOptions = {
    files: outputManifest,
    from: /0\.0\.0/,
    to: version
  }
  fs.copyFileSync(originalManifest, outputManifest)
  replace.sync(replaceOptions)
}

const generateManifestFile = (componentData) => {
  const manifestFile = getOriginalManifest(componentData.locale)
  const manifestContent = {
    description: 'Brave Ads Resources Component',
    key: componentData.key,
    manifest_version: 2,
    name: 'Brave Ads Resources',
    version: '0.0.0'
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifestContent))
}

const generateManifestFiles = () => {
  getComponentDataList().forEach(generateManifestFile)
}

const getManifestsDir = () => {
  const targetResourceDir = path.join(path.resolve(), 'build', 'user-model-installer', 'manifiest-files')
  mkdirp.sync(targetResourceDir)
  return targetResourceDir
}

const getOriginalManifest = (locale) => {
  return path.join(getManifestsDir(), `${locale}-manifest.json`)
}

const generateCRXFile = (binary, endpoint, region, keyDir, publisherProofKey,
  componentData) => {
  const originalManifest = getOriginalManifest(componentData.locale)
  const locale = componentData.locale
  const rootBuildDir = path.join(path.resolve(), 'build', 'user-model-installer')
  const stagingDir = path.join(rootBuildDir, 'staging', locale)
  const crxOutputDir = path.join(rootBuildDir, 'output')
  mkdirp.sync(stagingDir)
  mkdirp.sync(crxOutputDir)
  util.getNextVersion(endpoint, region, componentData.id).then((version) => {
    const crxFile = path.join(crxOutputDir, `user-model-installer-${locale}.crx`)
    const privateKeyFile = path.join(keyDir, `user-model-installer-${locale}.pem`)
    stageFiles(locale, version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
      stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

util.installErrorHandlers()

util.addCommonScriptOptions(
  commander
    .option('-d, --keys-directory <dir>', 'directory containing private keys for signing crx files'))
  .parse(process.argv)

let keyDir = ''
if (fs.existsSync(commander.keysDirectory)) {
  keyDir = commander.keysDirectory
} else {
  throw new Error('Missing or invalid private key directory')
}

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  generateManifestFiles()
  getComponentDataList().forEach(
    generateCRXFile.bind(null, commander.binary, commander.endpoint,
      commander.region, keyDir,
      commander.publisherProofKey))
})
