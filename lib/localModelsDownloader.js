/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Shared logic for downloading model files from the leo-local-models
// repository (https://github.com/brave/leo-local-models). The repository
// stores each model in its own top-level directory and keeps large weights in
// Git LFS, so we clone with a sparse checkout + blob filtering and only pull
// the LFS objects for the requested directory.

import { execSync } from 'child_process'
import fs from 'fs-extra'
import path from 'path'

const defaultRepoUrl = 'https://github.com/brave/leo-local-models.git'

/**
 * Downloads a single model directory from the leo-local-models repository.
 *
 * @param {Object} options
 * @param {string} options.targetDir - Local directory the model is moved into.
 * @param {string} options.sparseCheckoutPath - Directory within the repository
 *   to check out (e.g. 'embeddinggemma-300m').
 * @param {string} [options.repoUrl] - Repository to clone from.
 * @param {Object<string, string>} [options.renames] - Optional map of
 *   { sourceName: destName } applied to files inside
 *   `${targetDir}/${sparseCheckoutPath}` after download.
 */
export const downloadLocalModels = ({
  targetDir,
  sparseCheckoutPath,
  repoUrl = defaultRepoUrl,
  renames = {}
}) => {
  const tempDir = `${targetDir}-tmp`

  console.log(`Downloading ${targetDir} data files...`)

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
    console.log(`Moving ${sparseCheckoutPath} into ${targetDir}/...`)
    fs.ensureDirSync(targetDir)
    fs.moveSync(
      path.join(tempDir, sparseCheckoutPath),
      path.join(targetDir, sparseCheckoutPath)
    )

    // Apply any file renames
    for (const [srcName, destName] of Object.entries(renames)) {
      const modelSrcPath = path.join(targetDir, sparseCheckoutPath, srcName)
      const modelDestPath = path.join(targetDir, sparseCheckoutPath, destName)
      if (fs.existsSync(modelSrcPath)) {
        console.log(`Renaming ${sparseCheckoutPath}/${srcName} to ${sparseCheckoutPath}/${destName}...`)
        fs.moveSync(modelSrcPath, modelDestPath)
      }
    }

    // Clean up temp directory
    console.log('Cleaning up...')
    fs.removeSync(tempDir)

    console.log(`Successfully downloaded ${targetDir} data files!`)
  } catch (error) {
    console.error(`Error downloading ${targetDir} data files:`, error)
    // Clean up on error
    if (fs.existsSync(tempDir)) {
      fs.removeSync(tempDir)
    }
    process.exit(1)
  }
}

export default { downloadLocalModels }
