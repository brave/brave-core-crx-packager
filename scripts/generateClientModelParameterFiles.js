/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

 const path = require('path')
 const mkdirp = require('mkdirp')
 const fs = require('fs-extra')
 const request = require('request')
 const commander = require('commander')
 
 const jsonFileName = 'models.json'
 const jsonSchemaVersion = 1
 
 const getRegionList = () => {
   return [ 'US', 'GB' ]
 }
 
 const createParameterUpdateJsonFile = (path, body) => {
   fs.writeFileSync(path, body)
 }
 
 const getModelFileNameListFrom = (modelsJsonObj) => {
   let fileList = []
 
   if (modelsJsonObj.models) {
    modelsJsonObj.models.forEach((model) => {
       fileList.push(model.filename)
     })
   }
   return fileList
 }
 
 function downloadForRegion (jsonFileUrl, targetResourceDir) {
   return new Promise(function (resolve, reject) {
     const jsonFilePath = path.join(targetResourceDir, jsonFileName)
     let jsonFileBody = '{}'
 
     // Download and parse models.json.
     // If it doesn't exist, create with empty object.
     request(jsonFileUrl, async function (error, response, body) {
       if (error) {
         console.error(`Error from ${jsonFileUrl}:`, error)
         return reject(error)
       }
       if (response && response.statusCode === 200) {
         jsonFileBody = body
       }
 
       const modelsData = JSON.parse(jsonFileBody)
       // Make sure the data has a schema version so that clients can opt to parse or not
       const incomingSchemaVersion = modelsData.schemaVersion
       if (!incomingSchemaVersion) {
         // Source has no schema version, assume and set current version.
         // TODO(Moritz Haller): see petemills comment in `generateNTPSponsoredImages.js`:
         // Don't allow this once the source is established to always have a schema version.
         modelsData.schemaVersion = jsonSchemaVersion
       } else if (incomingSchemaVersion !== jsonSchemaVersion) {
         // We don't support this file format
         console.error(`Error: Cannot parse JSON data at ${jsonFileUrl} since it has a schema version of ${incomingSchemaVersion} but we expected ${jsonSchemaVersion}! This region will not be updated.`)
         return reject(error)
       }
 
       createParameterUpdateJsonFile(jsonFilePath, JSON.stringify(modelsData))
 
       // Download parameter files that specified in models.json
       const modelFileNameList = getModelFileNameListFrom(modelsData)
       const downloadOps = modelFileNameList.map((modelFileName) => new Promise(resolve => {
         const targetModelFilePath = path.join(targetResourceDir, modelFileName)
         const targetModelFileUrl = new URL(modelFileName, jsonFileUrl).href
         request(targetModelFileUrl)
           .pipe(fs.createWriteStream(targetModelFilePath))
           .on('finish', () => {
             console.log(targetModelFileUrl)
             resolve()
           })
       }))
       await Promise.all(downloadOps)
       resolve()
     })
   })
 }
 
 async function generateClientModelParameterUpdates (dataUrl) {
   const rootResourceDir = path.join(path.resolve(), 'build', 'user-model-installer', 'resources')
   mkdirp.sync(rootResourceDir)
 
   for (const region of getRegionList()) {
     console.log(`Downloading ${region}...`)
     const targetResourceDir = path.join(rootResourceDir, region)
     mkdirp.sync(targetResourceDir)
     const jsonFileUrl = `${dataUrl}${region}/${jsonFileName}`
     await downloadForRegion(jsonFileUrl, targetResourceDir)
   }
 }
 
 commander
   .option('-d, --data-url <url>', 'url referring to client model parameter updates')
   .parse(process.argv)
 
 generateClientModelParameterUpdates(commander.dataUrl)
