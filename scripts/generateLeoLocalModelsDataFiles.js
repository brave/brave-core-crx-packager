/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Downloads leo-local-models data files from the leo-local-models repository

import { execSync } from 'child_process'
import fs from 'fs-extra'
import path from 'path'

const targetDir = 'leo-local-models'
const tempDir = 'leo-local-models-tmp'
const repoUrl = 'https://github.com/brave/leo-local-models.git'
const sparseCheckoutPath = 'embeddinggemma-300m'

console.log('Downloading leo-local-models data files...')

// Clean up existing directories
if (fs.existsSync(targetDir)) {
  console.log(`Removing existing ${targetDir} directory...`)
  fs.removeSync(targetDir)
}

if (fs.existsSync(tempDir)) {
  console.log(`Removing existing ${tempDir} directory...`)
  fs.removeSync(tempDir)
}

try {
  // Clone with sparse checkout and LFS filtering
  console.log('Cloning repository with sparse checkout...')
  execSync(
    `git clone --depth 1 --filter=blob:none --sparse ${repoUrl} ${tempDir}`,
    { stdio: 'inherit' }
  )

  // Set sparse checkout path
  console.log(`Setting sparse checkout to ${sparseCheckoutPath}...`)
  execSync(`git sparse-checkout set ${sparseCheckoutPath}`, {
    cwd: tempDir,
    stdio: 'inherit'
  })

  // Pull LFS files
  console.log('Pulling LFS files...')
  execSync(`git lfs pull --include='${sparseCheckoutPath}/*'`, {
    cwd: tempDir,
    stdio: 'inherit'
  })

  // Create target directory and move files
  console.log('Moving files to target directory...')
  fs.ensureDirSync(targetDir)
  fs.moveSync(
    path.join(tempDir, sparseCheckoutPath),
    path.join(targetDir, sparseCheckoutPath)
  )

  // Rename the model file to a more generic name
  const modelSrcPath = path.join(
    targetDir,
    sparseCheckoutPath,
    'embeddinggemma-300m-Q4_0.gguf'
  )
  const modelDestPath = path.join(targetDir, sparseCheckoutPath, 'model.gguf')

  if (fs.existsSync(modelSrcPath)) {
    console.log('Renaming model file to model.gguf...')
    fs.moveSync(modelSrcPath, modelDestPath)
  }

  // Clean up temp directory
  console.log('Cleaning up...')
  fs.removeSync(tempDir)

  console.log('Successfully downloaded leo-local-models data files!')
} catch (error) {
  console.error('Error downloading leo-local-models data files:', error)
  // Clean up on error
  if (fs.existsSync(tempDir)) {
    fs.removeSync(tempDir)
  }
  process.exit(1)
}
