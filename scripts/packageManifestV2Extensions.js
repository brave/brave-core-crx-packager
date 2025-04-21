import fs from 'fs'
import unzip from 'unzip-crx-3'
import path from 'path'
import crypto from 'crypto'
import commander from 'commander'
import util from '../lib/util.js'
import crx from '../lib/crx.js'

const verifyChecksum = (data, sha512) => {
  return sha512 === crypto.createHash('sha512').update(data).digest('hex')
}

const downloadExtension = async (manifest) => {
  const buildPath = path.join('build', manifest.name)
  const download = path.join(buildPath, 'download')
  const unpacked = path.join(buildPath, 'unpacked')

  fs.mkdirSync(download, { recursive: true })
  fs.mkdirSync(unpacked, { recursive: true })

  const response = await fetch(manifest.url)
  const data = Buffer.from(await response.arrayBuffer())
  if (!verifyChecksum(data, manifest.sha512)) {
    console.error(`${manifest.name} checksum verification failed`)
    process.exit(1)
  }
  const sources = path.join(download, 'sources.zip')
  fs.writeFileSync(sources, Buffer.from(data))

  await unzip(sources, unpacked)
  return unpacked
}

const getOriginalManifest = (extensionName) => {
  return path.join('manifests', extensionName, 'default-manifest.json')
}

const packageV2Extension = (
  extensionName,
  endpoint,
  region,
  keysDir,
  publisherProofKey,
  publisherProofKeyAlt,
  verifiedContentsKey,
  localRun
) => {
  const manifest = util.parseManifest(getOriginalManifest(extensionName))
  const id = util.getIDFromBase64PublicKey(manifest.key)

  const processExtension = async () => {
    const stagingDir = await downloadExtension(manifest)
    const extensionKeyFile = path.join(keysDir, `${extensionName}-key.pem`)
    crx
      .generateCrx(
        stagingDir,
        extensionKeyFile,
        [publisherProofKey, publisherProofKeyAlt],
        verifiedContentsKey
      )
      .then((crx) => {
        if (id !== util.getIDFromBase64PublicKey(crx.manifest.key)) {
          console.log(`${extensionName} invalid extension key used.`)
          process.exit(1)
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
        util.generateSHA256HashOfFile(getOriginalManifest())
      )
      .then((version) => {
        if (version !== undefined) {
          processExtension()
        } else {
          console.log(`${manifest.name} extension: no updates detected!`)
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

const ExtensionsV2 = ['no-script-v2', 'adguard-v2']

if (!commander.localRun) {
  util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
    ExtensionsV2.forEach((extensionName) => {
      packageV2Extension(
        extensionName,
        commander.endpoint,
        commander.region,
        keysDir,
        commander.publisherProofKey,
        commander.publisherProofKeyAlt,
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
      commander.publisherProofKey,
      commander.publisherProofKeyAlt,
      commander.verifiedContentsKey,
      commander.localRun
    )
  })
}
