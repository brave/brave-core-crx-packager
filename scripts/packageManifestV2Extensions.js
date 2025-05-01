import fs from 'fs'
import unzip from 'unzip-crx-3'
import path from 'path'
import crypto from 'crypto'
import commander from 'commander'
import glob from 'glob'
import util from '../lib/util.js'
import crx from '../lib/crx.js'

const verifyChecksum = (data, config) => {
  const checksum = crypto.createHash('sha512').update(data).digest('hex')
  if (config.sha512 !== checksum) {
    throw new Error(
      `${config.name} checksum verification failed: computed ${checksum}`
    )
  }
}

const downloadExtension = async (config) => {
  const buildPath = path.join('build', config.name)
  const download = path.join(buildPath, 'download')
  const unpacked = path.join(buildPath, 'unpacked')

  fs.mkdirSync(download, { recursive: true })
  fs.mkdirSync(unpacked, { recursive: true })

  const response = await fetch(config.url)
  const data = Buffer.from(await response.arrayBuffer())
  verifyChecksum(data, config)
  const sources = path.join(download, 'sources.zip')
  fs.writeFileSync(sources, Buffer.from(data))

  await unzip(sources, unpacked)

  const findRoot = (root, file) => {
    const manifestFile = glob.sync(`**/manifest.json`, {
      cwd: root,
      absolute: true,
      nodir: true
    })
    if (!manifestFile) {
      throw new Error(`${config.name} can not find manifest`)
    }

    return path.dirname(manifestFile[0])
  }

  return findRoot(unpacked)
}

const getExtensionConfig = (extensionName) => {
  return path.join('manifests', extensionName, 'config.json')
}

const packageV2Extension = (
  extensionName,
  endpoint,
  region,
  keysDir,
  verifiedContentsKey,
  localRun
) => {
  const config = util.parseManifest(getExtensionConfig(extensionName))
  const id = util.getIDFromBase64PublicKey(config.key)

  const processExtension = async () => {
    const stagingDir = await downloadExtension(config)
    const extensionKeyFile = path.join(keysDir, `${extensionName}-key.pem`)
    crx
      .generateCrx(stagingDir, extensionKeyFile, [], verifiedContentsKey)
      .then((crx) => {
        if (id !== util.getIDFromBase64PublicKey(crx.manifest.key)) {
          throw new Error(`${extensionName} invalid extension key used.`)
        }
        fs.mkdirSync(path.join('build', 'extensions-v2'), { recursive: true })
        fs.writeFileSync(
          path.join('build', 'extensions-v2', `${id}.crx`),
          crx.crx
        )
        fs.writeFileSync(
          path.join('build', 'extensions-v2', `${id}.zip`),
          crx.zip
        )
      })
  }

  if (!localRun) {
    util
      .getNextVersion(
        endpoint,
        region,
        id,
        util.generateSHA256HashOfFile(getExtensionConfig())
      )
      .then((version) => {
        if (version !== undefined) {
          processExtension()
        } else {
          console.log(`${config.name} extension: no updates detected!`)
        }
      })
  } else {
    processExtension()
  }
}

util.installErrorHandlers()

util
  .addCommonScriptOptions(
    commander
      .option(
        '-d, --keys-directory <dir>',
        'directory containing private keys for signing crx files'
      )
      .option(
        '-l, --local-run',
        'Runs updater job without connecting anywhere remotely'
      )
  )
  .parse(process.argv)

let keysDir = ''
if (fs.existsSync(commander.keysDirectory)) {
  keysDir = commander.keysDirectory
} else {
  throw new Error('Missing or invalid private key file/directory')
}

const ExtensionsV2 = ['no-script-v2', 'adguard-v2', 'umatrix-v2', 'ublock-v2']

if (!commander.localRun) {
  util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
    ExtensionsV2.forEach((extensionName) => {
      packageV2Extension(
        extensionName,
        commander.endpoint,
        commander.region,
        keysDir,
        commander.verifiedContentsKey
      )
    })
  })
} else {
  ExtensionsV2.forEach((extensionName) => {
    packageV2Extension(
      extensionName,
      commander.endpoint,
      commander.region,
      keysDir,
      commander.verifiedContentsKey,
      commander.localRun
    )
  })
}
