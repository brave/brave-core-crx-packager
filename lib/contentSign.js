/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import fs from 'fs-extra'
import path from 'path'
import crypto from 'crypto'
import glob from 'glob'

const getComponentFiles = (dir, patterns) => {
  const options = {
    cwd: dir,
    posix: true
  }
  let files = []

  patterns.forEach((pattern) => {
    const pfiles = glob.sync('./' + pattern, options)
    files = files.concat(pfiles)
  })
  files = [
    ...new Set(
      files
        .map((f) => {
          return path.join(dir, f)
        })
        .filter((f) => {
          return !fs.statSync(f).isDirectory()
        })
    )
  ]
  return files.sort()
}

const computeBlockHashes = (filePath) => {
  const buffer = Buffer.alloc(4096)

  const file = fs.openSync(filePath, 'r')
  const hashes = []

  while (true) {
    const bytesRead = fs.readSync(file, buffer, 0, buffer.length)
    if (bytesRead <= 0) {
      break
    }
    const hash = crypto.createHash('sha256')
    hash.update(buffer.subarray(0, bytesRead))
    hashes.push(hash.digest())
  }

  if (hashes.length === 0) {
    const hash = crypto.createHash('sha256')
    hash.update('')
    hashes.push(hash.digest())
  }

  return hashes
}

const computeRootHash = (file) => {
  let blockHashes = computeBlockHashes(file)
  if (!blockHashes) {
    return ''
  }

  const branchFactor = 4096 / 32

  while (blockHashes.length > 1) {
    let i = 0
    const parentNodes = []
    while (i !== blockHashes.length) {
      const hash = crypto.createHash('sha256')
      for (let j = 0; j < branchFactor && i !== blockHashes.length; j++, i++) {
        hash.update(blockHashes[i])
      }
      parentNodes.push(hash.digest())
    }
    blockHashes = parentNodes
  }
  return blockHashes[0]
}

const createPayload = (component, files) => {
  const payload = {
    content_hashes: [
      {
        block_size: 4096,
        digest: 'sha256',
        files: [],
        format: 'treehash',
        hash_block_size: 4096
      }
    ],
    item_id: component.id,
    item_version: component.version,
    protocol_version: 1
  }

  for (const file of files) {
    const rootHash = computeRootHash(file)
    payload.content_hashes[0].files.push({
      path: file.replace(component.dir, ''),
      root_hash: Buffer.from(rootHash).toString('base64Url')
    })
  }

  return payload
}

const signPayload = (protectedBy, payload, privateKey) => {
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(protectedBy)
  signer.update('.')
  signer.update(payload)

  return signer.sign(privateKey, 'base64url')
}

const ensureTrailingSlash = (aPath) => {
  return path.join(aPath, '/')
}

const createVerifiedContents = (
  inputDir,
  patterns,
  id,
  version,
  privateKey
) => {
  if (!privateKey) {
    throw new Error('Missing private key')
  }

  privateKey = fs.readFileSync(privateKey, 'utf-8')
  if (!privateKey) {
    throw new Error('Cannot read private key')
  }

  inputDir = ensureTrailingSlash(inputDir)

  const componentFiles = getComponentFiles(inputDir, patterns)
  if (!componentFiles) {
    throw new Error(
      'No files matching the specified patterns were found in the component directory.'
    )
  }

  const component = {
    dir: inputDir,
    id,
    version
  }

  const payload = createPayload(component, componentFiles)

  const protection = {
    alg: 'RS256'
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url'
  )
  const encodedProtection = Buffer.from(JSON.stringify(protection)).toString(
    'base64url'
  )

  const result = {
    description: 'treehash per file',
    signed_content: {
      payload: encodedPayload,
      signatures: []
    }
  }

  const signature = signPayload(encodedProtection, encodedPayload, privateKey)
  result.signed_content.signatures.push({
    protected: encodedProtection,
    header: {
      kid: 'webstore'
    },
    signature
  })
  return [result]
}
export default {
  createVerifiedContents
}
