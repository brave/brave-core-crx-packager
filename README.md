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

## Uploading

After packaging a CRX file, you can upload it to Brave's S3 extensions
bucket (`brave-extensions`). For example, to upload the Ad Block
component extension use the following command:

```bash
yarn run upload-ad-block -- --crx <crx-file> --set-version <version-number>
```

where:

* `crx` is the path to the CRX file (as produced by running `package-ad-block`, for example)
* `version-number` is the version number that identifies this component extension

Uploading to S3 requires that you create appropriately provisioned AWS
credentials. Once provisioned, you can make your credentials
accessible to this script via environment variables or a credentials
file. Both methods are described below.

### Environment Variables

Set the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment
variables.

### Credentials File

Add the credentials to a credentials file. The default location for
this file is:

* `~/.aws/credentials` (Linux/Mac)
* `C:\Users\USERNAME\.aws\credentials` (Windows)

The format for the credentials file is:

```bash
[default]
aws_access_key_id = ACCESS_KEY
aws_secret_access_key = SECRET_KEY
```
