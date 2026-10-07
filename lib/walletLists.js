/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Fetches the wallet data files from the latest brave/wallet-lists GitHub
// release and verifies them before packaging.
// See https://github.com/brave/wallet-lists/issues/369.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import ntpUtil from './ntpUtil.js'
import util from './util.js'

const REPO = 'brave/wallet-lists'
const ASSET = 'wallet-lists.zip'

// Where `pnpm data-files-wallet-lists` puts the files to package.
export const WALLET_LISTS_DIR = 'wallet-lists'

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'] }).trim()

/**
 * Extracts the zip into `outputDir`, rejecting entries that would escape it.
 */
export const extractZip = async (data, outputDir) => {
  const zip = await JSZip.loadAsync(data)
  for (const entry of Object.values(zip.files)) {
    const target = path.join(outputDir, entry.name)
    ntpUtil.validateTargetPath(outputDir, target)
    if (entry.dir) {
      continue
    }
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, await entry.async('nodebuffer'))
  }
}

/**
 * Sanity-checks the extracted files and returns how many prohibited addresses
 * they contain.
 */
export const checkContents = (dir, tag) => {
  const read = (name) => fs.readFileSync(path.join(dir, name), 'utf-8')
  if (!util.parseManifest(path.join(dir, 'manifest.json')).key) {
    throw new Error('manifest.json has no key')
  }
  const version = read('VERSION').trim()
  if (version !== tag) {
    throw new Error(`VERSION ${version} does not match release ${tag}`)
  }
  const { addresses } = JSON.parse(read('prohibited-addresses.json'))
  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error('prohibited-addresses.json has no addresses')
  }
  return addresses.length
}

/**
 * Downloads the latest release's zip, verifies that it belongs to that
 * (immutable) release and was built by wallet-lists' auto-release workflow on
 * main, then extracts it into `outputDir`.
 */
export const fetchWalletLists = async (outputDir) => {
  const tag = gh('release', 'view', '--repo', REPO, '--json', 'tagName', '--jq', '.tagName')
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-lists-'))
  try {
    const zipPath = path.join(tmpDir, ASSET)
    gh('release', 'download', tag, '--repo', REPO, '--pattern', ASSET, '--dir', tmpDir)
    gh('release', 'verify-asset', tag, zipPath, '--repo', REPO)
    gh('attestation', 'verify', zipPath, '--repo', REPO,
      '--signer-workflow', `${REPO}/.github/workflows/auto-release.yml`,
      '--source-ref', 'refs/heads/main',
      '--deny-self-hosted-runners')

    fs.rmSync(outputDir, { recursive: true, force: true })
    await extractZip(fs.readFileSync(zipPath), outputDir)
    return { tag, addressCount: checkContents(outputDir, tag) }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}
