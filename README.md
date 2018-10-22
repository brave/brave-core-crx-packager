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
yarn run upload-ad-block --crx-directory <crx-dir> --endpoint <endpoint>
```

where:

* `crx-dir` is the directory containing the CRX files to upload (as produced by running `package-ad-block`, for example)
* `endpoint` is the DynamoDB endpoint (use http://localhost:8000 if setup locally)

### Theme Extensions

To upload all packaged theme extensions, use the following command:

```bash
yarn run upload-themes --crx-directory <dir> --endpoint <endpoint>
```

where:

* `dir` is the directory containing the CRX files to upload
* `endpoint` is the DynamoDB endpoint (use http://localhost:8000 if setup locally)

### Importing Chrome Web Store extensions

To import the current list of supported Chrome Web Store extensions, use the following command:

```bash
yarn run import-cws-components --endpoint <endpoint>
```

where:

* `endpoint` is the DynamoDB endpoint (use http://localhost:8000 if setup locally)

This will download the supported extensions from the Chrome Web Store and upload them to S3.

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

## Troubleshooting

Since the packager uses Chrome to pack the extensions, make sure you're not currently running Chrome when you perform the packaging step. If you don't quit Chrome before running the packaging scripts, you may see errors like the following (which are harmless, but may obscure actual problems):

```
[2400:12692:1019/161515.198:ERROR:cache_util_win.cc(19)] Unable to move the cache: 5
[2400:12692:1019/161515.198:ERROR:cache_util.cc(140)] Unable to move cache folder C:\Users\emerick\AppData\Local\Google\Chrome\User Data\ShaderCache\GPUCache to C:\Users\emerick\AppData\Local\Google\Chrome\User Data\ShaderCache\old_GPUCache_000
[2400:12692:1019/161515.198:ERROR:disk_cache.cc(168)] Unable to create cache
[2400:12692:1019/161515.198:ERROR:shader_disk_cache.cc(620)] Shader Cache Creation failed: -2
```

When specifying the path for the `--binary` option on Windows, it can be tricky to get the quoting just right without confusing your shell. This syntax works correctly:

```
--binary \""C:\Program Files (x86)\Google\Chrome\Application\chrome.exe\""
```
