# Brave Core CRX Packager

The CRX Packager creates and packages CRX files for the component and theme extensions included with the Brave browser.

## Cloning and Installation

Clone the repository and install Node dependencies:

```bash
git clone git@github.com:brave/brave-core-crx-packager.git
cd brave-core-crx-packager
yarn install
```

## Packaging

### Component Extensions

To package a component extension, first generate the appropriate DAT file(s) if any. For example, to generate all of the DAT files used by the Ad Block component extension use the following command:

```bash
yarn run data-files-ad-block
```

Then package the component extension(s) into one or more CRX files. For example, to package all of the Ad Block component extensions use the following command:

```bash
yarn run package-ad-block --keys-directory <keys-dir> --binary <binary> --endpoint <endpoint>
```

where:

* `keys-dir` is the directory containing the associated private keys used to sign the CRX files
* `binary` is the full path to the Chrome web browser binary, used for packing the CRX files
* `endpoint` is the DynamoDB endpoint (use http://localhost:8000 if setup locally)

The currently supported component extension types are:

* `ad-block`
* `https-everywhere`
* `tor-client`
* `tracking-protection`

### Theme Extensions

To package all available theme extensions into CRX files, use the following command:

```bash
yarn run package-themes --keys-directory <keys-dir> --binary <binary> --endpoint <endpoint>
```

where:

* `keys-dir` is the directory containing the associated private keys used to sign the CRX files
* `binary` is the full path to the Chrome web browser binary, used for packing the CRX files
* `endpoint` is the DynamoDB endpoint (use http://localhost:8000 if setup locally)

## Uploading

After packaging a CRX file, you can upload it to Brave's S3 extensions bucket (`brave-extensions`).

### Component Extensions

To upload a component extension, use the appropriate upload command. For example, to upload all of the Ad Block component extensions use the following command:

```bash
yarn run upload-ad-block --crx-directory <crx-dir> --vault-updater-path <vu-dir>
```

where:

* `crx-dir` is the directory containing the CRX files to upload (as produced by running `package-ad-block`, for example)
* `vu-dir` is the full path to the local vault-updater

### Theme Extensions

To upload all packaged theme extensions, use the following command:

```bash
yarn run upload-themes --crx-directory <dir> --vault-updater-path <vu-dir>
```

where:

* `dir` is the directory containing the CRX files to upload
* `vu-dir` is the full path to the local vault-updater

## Versioning

Versioning occurs automatically. The first time an extension is packaged, it receives the version number `1.0.0`. When uploaded, that version number along with other metadata is stored in DynamoDB. Subsequent packagings increment the last component of the version number by one.

## S3 Credentials

Uploading to S3 requires that you create appropriately provisioned AWS credentials. Once provisioned, you can make your credentials accessible to this script via environment variables or a credentials file. Both methods are described below.

### Environment Variables

Set the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables.

### Credentials File

Add the credentials to a credentials file. The default location for this file is:

* `~/.aws/credentials` (Linux/Mac)
* `C:\Users\USERNAME\.aws\credentials` (Windows)

The format for the credentials file is:

```bash
[default]
aws_access_key_id = ACCESS_KEY
aws_secret_access_key = SECRET_KEY
```
