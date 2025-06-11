// Copyright (c) 2022 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// you can obtain one at http://mozilla.org/MPL/2.0/.

import test from 'node:test'
import assert from 'node:assert/strict'

import params from './params.js'
import allComponents from './region-platform-component-metadata.js'

test('ntp getTargetComponentsFromArrays', (t, done) => {
  // blank
  let actual = params.getTargetComponents(undefined, undefined)
  assert.deepStrictEqual(actual, allComponents)

  // single
  actual = params.getTargetComponents('US-android', '')
  assert.deepStrictEqual(actual, { 'US-android': allComponents['US-android'] })

  // multiple, exclude bad
  actual = params.getTargetComponents('US-android,IT,FR-desktop,asd', '')
  assert.deepStrictEqual(actual, {
    'US-android': allComponents['US-android'],
    'FR-desktop': allComponents['FR-desktop']
  })

  // strip bad chars but still include
  actual = params.getTargetComponents('"US-an;droid",')
  assert.deepStrictEqual(actual, { 'US-android': allComponents['US-android'] })

  // exclude
  actual = params.getTargetComponents('', 'US-android')
  const expectedExclude = { ...allComponents }
  delete expectedExclude['US-android']
  assert.deepStrictEqual(actual, expectedExclude)

  done()
})
