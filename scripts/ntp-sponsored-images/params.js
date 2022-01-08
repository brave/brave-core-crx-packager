// Copyright (c) 2022 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// you can obtain one at http://mozilla.org/MPL/2.0/.

const regionPlatformComponentMetadata = require('./region-platform-component-metadata')

/**
 *
 *
 * @param {string|undefined} incoming
 * @returns string[]
 */
function parseRegionListParam (incoming) {
  if (!incoming || typeof incoming !== 'string') {
    return []
  }
  const incomingClean = incoming.replace(/[^A-Za-z,-]/g, '')
  return incomingClean.split(',').map(i => i.trim()).filter(i => !!i)
}

/**
 *
 *
 * @param {string[]} includes
 * @param {string[]} excludes
 *
 * @typedef {{ locale: string, key: string, id: string }} ComponentMetadata
 *
 * @returns {typeof regionPlatformComponentMetadata}
 */
function getTargetComponentsFromArrays (includes, excludes) {
  /**
   * @type {typeof regionPlatformComponentMetadata}
   */
  const targetComponents = { }
  for (const platformRegion of Object.keys(regionPlatformComponentMetadata)) {
    // Include the component if it's in includes and not in excludes, or includes is empty
    if ((!includes.length || includes.includes(platformRegion)) && (
      !excludes.length || !excludes.includes(platformRegion)
    )) {
      targetComponents[platformRegion] = regionPlatformComponentMetadata[platformRegion]
    }
  }
  return targetComponents
}

/**
 *
 *
 * @param {string|undefined} includesParamValue
 * @param {string|undefined} excludesParamValue
 *
 * @returns {typeof regionPlatformComponentMetadata}
 */
function getTargetComponents (includesParamValue, excludesParamValue) {
  const includes = parseRegionListParam(includesParamValue)
  const excludes = parseRegionListParam(excludesParamValue)

  const targetComponents = getTargetComponentsFromArrays(includes, excludes)

  console.log('included keys: ', includes.join(', '))
  console.log('excluded keys: ', excludes.join(', '))
  console.log('resulting target keys:', Object.keys(targetComponents))

  return targetComponents
}

module.exports.getTargetComponents = getTargetComponents
