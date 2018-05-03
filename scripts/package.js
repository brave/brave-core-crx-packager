/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const commander = require('commander');
const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const replace = require('replace-in-file');

function stageFiles(commander, outputDir, datFile) {
  const baseDatFile = path.parse(datFile).base;

  const originalManifest = path.join('manifests', commander.type + '-manifest.json');
  const updatedManifest = path.join(outputDir, 'manifest.json');

  const replaceOptions = {
    files: updatedManifest,
    from: /0\.0\.0/g,
    to: commander.setVersion,
  };

  mkdirp.sync(outputDir);

  fs.copyFileSync(originalManifest, updatedManifest);
  fs.copyFileSync(datFile, path.join(outputDir, baseDatFile));

  replace.sync(replaceOptions);
}

function generateCRX(commander, outputDir, datFile) {
  const ChromeExtension = require('crx');
  const crx = new ChromeExtension({
    privateKey: fs.readFileSync(commander.key)
  });

  const crxFile = commander.type + '.crx';

  crx.load(path.resolve(outputDir))
    .then(() => crx.loadContents())
    .then((archiveBuffer) => {
      crx.pack(archiveBuffer).then((crxBuffer) => {
        fs.writeFileSync(crxFile, crxBuffer);
        console.log('Generated ' + crxFile);
      });
    })
    .catch((err) => {
      console.error(err.stack);
    });
}

commander
  .option('-k, --key <key>', 'private key file path', 'key.pem')
  .option('-t, --type <type>', 'component extension type', /^(ad-block-updater|https-everywhere-updater|tracking-protection-updater)$/i, 'ad-block-updater')
  .option('-s, --set-version <x.x.x>', 'component extension version number')
  .parse(process.argv);

if (!fs.existsSync(commander.key)) {
  throw new Error('Missing private key file: ' + commander.key);
}

if (!commander.setVersion) {
  throw new Error('Missing required option: --set-version');
}

if (!commander.setVersion.match(/^(\d+\.\d+\.\d+)$/)) {
  throw new Error('Missing or invalid option: --set-version');
}

let datFile;

switch (commander.type) {
case 'ad-block-updater':
  datFile = 'node_modules/ad-block/out/ABPFilterParserData.dat';
  break;
case 'tracking-protection-updater':
  datFile = 'node_modules/tracking-protection/data/TrackingProtection.dat';
  break;
default:
  throw new Error('Unrecognized component extension type: ' + commander.type);
}

const outputDir = path.join('build', commander.type);

stageFiles(commander, outputDir, datFile);
generateCRX(commander, outputDir, datFile);
