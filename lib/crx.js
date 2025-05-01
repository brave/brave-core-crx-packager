/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import * as crxpb from './crx3.pb.js'
import fs from 'fs-extra'
import crypto from 'crypto'
import JSZip from 'jszip'
import glob from 'glob'
import path from 'path'
import util from './util.js'
import zlib from 'zlib'
import Pbf from 'pbf'

const CRX_ID_SIZE = 16
const CRX_FILE_MAGIC = 'Cr24'
const CRX_VERSION = 3
const CRX_SIGNED_DATA_HEADER = Buffer.from('CRX3 SignedData\x00', 'utf-8')

const toLE32 = (num) => {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32LE(num)
  return buffer
}

const createCrxId = (signingKey) => {
  const hash = crypto.createHash('sha256')
  const publicKey = crypto.createPublicKey(signingKey)
  hash.update(
    publicKey.export({
      type: 'spki',
      format: 'der'
    })
  )
  return hash.digest().subarray(0, CRX_ID_SIZE)
}

const createSignedData = (id) => {
  const pbf = new Pbf()
  crxpb.writeSignedData({ crx_id: id }, pbf)
  return pbf.finish()
}

const signContentAndCreateHeader = (content, extensionKey, publisherKeys) => {
  const crxId = createCrxId(extensionKey)

  const header = {
    sha256_with_rsa: [],
    signed_header_data: createSignedData(crxId)
  }

  for (const signingKey of [extensionKey, ...publisherKeys]) {
    const signer = crypto.createSign('sha256')

    // Assemble SignedData section.
    signer.update(CRX_SIGNED_DATA_HEADER)
    signer.update(toLE32(header.signed_header_data.length))
    signer.update(header.signed_header_data)
    signer.update(content)

    const publicKey = crypto.createPublicKey(signingKey)
    const proof = {
      public_key: publicKey.export({ type: 'spki', format: 'der' }),
      signature: signer.sign(signingKey)
    }
    // Add signature.
    header.sha256_with_rsa.push(proof)
  }
  return header
}

const zipContent = async (stagingDir) => {
  const processFiles = (dir, callback) => {
    const files = glob.sync('**/*', {
      nodir: true,
      absolute: false,
      cwd: dir
    })

    for (const relativePath of files) {
      callback(relativePath)
    }
  }

  const zip = new JSZip()
  processFiles(stagingDir, (file) => {
    zip.file(file, fs.readFileSync(path.join(stagingDir, file)))
  })

  return await zip.generateAsync({
    type: 'Uint8Array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  })
}

const updateManifest = (stagingDir, extensionKey) => {
  const manifestFile = path.join(stagingDir, 'manifest.json')
  const manifest = util.parseManifest(manifestFile)
  const publicKey = crypto.createPublicKey(extensionKey)

  // Public key which used to generate the extension/crx id.
  manifest.key = publicKey
    .export({
      type: 'spki',
      format: 'der'
    })
    .toString('base64')

  // The WebStore update URL makes the browser think that the extension is from the Web Store.
  manifest.update_url = 'https://clients2.google.com/service/update2/crx'

  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2))
  return manifest
}

// Generates
const generateCrx = async (
  stagingDir,
  extensionKeyFile,
  publisherKeyFiles,
  verifiedContentsKeyFile
) => {
  const extensionKey = crypto.createPrivateKey(
    fs.readFileSync(extensionKeyFile, 'utf-8')
  )

  const publisherKeys = publisherKeyFiles
    .filter((file) => file)
    .map((file) => {
      return crypto.createPrivateKey(fs.readFileSync(file))
    })

  const manifest = updateManifest(stagingDir, extensionKey)

  const zip = await zipContent(stagingDir)
  const header = signContentAndCreateHeader(zip, extensionKey, publisherKeys)
  if (verifiedContentsKeyFile) {
    header.verified_contents = zlib.gzipSync(
      util.generateVerifiedContents(stagingDir, ['**'], verifiedContentsKeyFile)
    )
  }

  const pbf = new Pbf()
  crxpb.writeCrxFileHeader(header, pbf)
  const headerData = pbf.finish()

  const crx = Buffer.alloc(
    CRX_FILE_MAGIC.length + 4 /* LE32 version */ + 4 /* LE32 header length */
  )

  let pos = crx.write(CRX_FILE_MAGIC, 0, 'utf-8')
  pos = crx.writeUint32LE(CRX_VERSION, pos)
  crx.writeUint32LE(headerData.length, pos)

  return {
    crx: Buffer.concat([crx, headerData, zip]),
    zip,
    manifest
  }
}

export default {
  generateCrx
}
