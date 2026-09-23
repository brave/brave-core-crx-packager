import { When, Then } from '@cucumber/cucumber'
import { expect } from 'chai'

let params
let allComponents
let selection

When('the target components are selected with no includes and no excludes', async function () {
  params = (await import('../../scripts/ntp-sponsored-images/params.js')).default
  allComponents = (await import('../../scripts/ntp-sponsored-images/region-platform-component-metadata.js')).default
  selection = params.getTargetComponents(undefined, undefined)
})

When('the target components are selected for includes {string} and excludes {string}', async function (includes, excludes) {
  params = (await import('../../scripts/ntp-sponsored-images/params.js')).default
  allComponents = (await import('../../scripts/ntp-sponsored-images/region-platform-component-metadata.js')).default
  selection = params.getTargetComponents(includes, excludes)
})

When('the target components are selected with no includes and excludes {string}', async function (excludes) {
  params = (await import('../../scripts/ntp-sponsored-images/params.js')).default
  allComponents = (await import('../../scripts/ntp-sponsored-images/region-platform-component-metadata.js')).default
  selection = params.getTargetComponents('', excludes)
})

Then('every known component is selected', function () {
  expect(selection).to.deep.equal(allComponents)
})

Then('every known component is selected except {string}', function (name) {
  const expected = { ...allComponents }
  delete expected[name]
  expect(selection).to.deep.equal(expected)
})

Then('exactly these components are selected: {string}', function (names) {
  const expected = {}
  for (const name of names.split(', ')) {
    expected[name] = allComponents[name]
  }
  expect(selection).to.deep.equal(expected)
})
