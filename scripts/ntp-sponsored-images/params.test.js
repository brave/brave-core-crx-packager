// Copyright (c) 2022 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// you can obtain one at http://mozilla.org/MPL/2.0/.

import tap from 'tap'
import params from './params.js'
import allComponents from './region-platform-component-metadata.js'

tap.test('ntp getTargetComponentsFromArrays', (t) => {
  // blank
  let actual = params.getTargetComponents(undefined, undefined)
  t.strictSame(actual, allComponents)

  // single
  actual = params.getTargetComponents('US-android', '')
  t.strictSame(actual, { 'US-android': allComponents['US-android'] })

  // multiple, exclude bad
  actual = params.getTargetComponents('US-android,IT,FR-desktop,asd', '')
  t.strictSame(actual, { 'US-android': allComponents['US-android'], 'FR-desktop': allComponents['FR-desktop'] })

  // strip bad chars but still include
  actual = params.getTargetComponents('"US-an;droid",')
  t.strictSame(actual, { 'US-android': allComponents['US-android'] })

  // exclude
  actual = params.getTargetComponents('', 'US-android')
  const expectedExclude = { ...allComponents }
  delete expectedExclude['US-android']
  t.strictSame(actual, expectedExclude)

  t.end()
})
