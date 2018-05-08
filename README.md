# Brave Core CRX Packager

The CRX Packager creates and packages CRX files for the Brave
component extensions included with the Brave browser.

## Cloning and Installation

Clone the repository and install Node dependencies:

```bash
git clone git@github.com:brave/brave-core-crx-packager.git
cd brave-core-crx-packager
yarn install
```

## Packaging

To package a component extension, first generate the appropriate DAT
file. For example, to generate the DAT file used by the Ad Block
component extension use the following command:

```bash
yarn run data-files-ad-block
```

Then package the component extension into a CRX file. For example, to
package the Ad Block component extension use the following command:

```bash
yarn run package-ad-block -- --key <key> --set-version <version-number>
```

where:

* `key` is the path to the private key file used to sign the CRX file
* `version-number` is the version number that identifies this component extension

The currently supported component extension types are:

* `ad-block`
* `tracking-protection`
