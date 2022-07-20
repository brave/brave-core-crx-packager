# Brave Core CRX Packager

The CRX Packager creates and packages CRX files for the components and extensions included with the Brave browser.

## Development

When developing a new component extension, you must generate a new unique extension ID and public/private key pair. You can do that by

1. Generating a new keypair with `openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem`
2. Storing the new PEM in 1Password for Teams
3. Generating the public key for the `manifest.json` with `openssl rsa -in key.pem -pubout -outform DER | openssl base64 -A`
4. Generating the component ID with `openssl rsa -in key.pem -pubout -outform DER | shasum -a 256 | head -c32 | tr 0-9a-f a-p`
5. Updating https://github.com/brave/adblock-resources/blob/master/filter_lists/regional.json with the right component_id and base64_public_key (if this is for AdBlock)
5. Updating the CRX packager to use the new PEM

## Cloning and Installation

Clone the repository and install Node dependencies:

```bash
git clone git@github.com:brave/brave-core-crx-packager.git
cd brave-core-crx-packager
CXXFLAGS="--std=c++17" npm install
```

Currently
* Node 14.x is required.
* Python is required.
* Rust is required. (for ad-block)

## Packaging

### Component Extensions

To package a component extension, first generate the appropriate DAT file(s) if any. For example, to generate all of the DAT files used by the Ad Block component extension use the following command:

```bash
npm run data-files-ad-block
```

Then package the component extension(s) into one or more CRX files. For example, to package all of the Ad Block component extensions use the following command:

```bash
npm run package-ad-block -- --keys-directory <keys-dir> --binary <binary> --endpoint <endpoint>
```

where:

* `keys-dir` is the directory containing the associated private keys used to sign the CRX files
* `binary` is the full path to the Chrome web browser binary, used for packing the CRX files
* `endpoint` is the DynamoDB endpoint (use http://localhost:8000 if setup locally)

The currently supported component extension types are:

* `ad-block`
* `https-everywhere`
* `tor-client`
* `local-data-files` (formerly `tracking-protection`)

### NTP Sponsored Images(SI) component

To pacakge NTP SI components, download assets from passed url at first. It will download assets to `./build/ntp-sponsored-images/resources/`

```bash
npm run generate-ntp-sponsored-images -- --data-url <s3 buckets url>
```

Then, package assets to crx files per region. It will generate component crx files for each region at `./build/ntp-sponsored-images/output`. Passed args to `--keys-directory` should include all PEM files that has private key for supported regions.

```bash
npm run package-ntp-sponsored-images -- --binary "/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome" --keys-directory keys/
```

### NTP Super Referrer(SR) component

Generate private key file as ntp-super-referrer-{super-referrer-code}.pem and add it as secret file to Builder. See above instruction how to generate private key file.

To pacakge NTP SR components, download assets from passed url at first. It will download assets to `./build/ntp-super-referrer/resources/{super-referrer-code}`

```bash
npm run generate-ntp-super-referrer -- --data-url <s3 buckets url> --super-referrer-name <super-referrer-code>
```

Then, package assets to crx file for specific super referrer. It will generate component crx file at `./build/ntp-super-referrer/output`.

```bash
npm run package-ntp-super-referrer -- --binary "/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome" --key ntp-super-referrer-{super-referrer-code}.pem --super-referrer-name <super-referrer-code>
```

## Uploading

After packaging a CRX file, you can upload it to Brave's S3 extensions bucket (`brave-extensions`).

### Component Extensions

To upload a component extension, use the appropriate upload command. For example, to upload all of the Ad Block component extensions use the following command:

```bash
aws-vault exec extensions-dev-role -- npm run upload-ad-block -- --crx-directory <crx-dir> --endpoint <endpoint>
```

where:

* `crx-dir` is the directory containing the CRX files to upload (as produced by running `package-ad-block`, for example)
* `endpoint` is the DynamoDB endpoint (use http://localhost:8000 if setup locally)

### NTP SI component
To upload NTP SI components, pass crx directory that has all generated crx files and endpoint as arguments.
```bash
aws-vault exec extensions-dev-role -- npm run upload-ntp-sponsored-images-components -- --crx-directory ./build/ntp-sponsored-images/output
```

### NTP SR component
To upload NTP SR components, pass crx directory that has generated crx file and endpoint as arguments.
```bash
aws-vault exec extensions-dev-role -- npm run upload-ntp-super-referrer-component -- --crx-directory ./build/ntp-super-referrer/output
```

### User Model Installer component
Upload data file to bucket brave-user-model-installer-input(-dev) using AWS console or setting up AWS credential in [`aws-vault`](https://github.com/brave/devops/wiki/Developing-With-AWS-Access-Keys#aws-access-key-management) and use AWS CLI directly:

```
[profile dev]
region = us-west-2

[profile extensions-dev-role]
source_profile = dev
role_arn = arn:aws:iam::XXXXXXXXXXXX:role/extensions-dev-developer-role
mfa_serial = arn:aws:iam::XXXXXXXXXXXX:mfa/dev
```
```
aws-vault exec extensions-dev-role -- aws s3 cp --recursive iso_3166_1_gb s3://brave-user-model-installer-input-dev/iso_3166_1_gb/ 
```
or update the AWS CLI config file to use [`credential_process`](https://docs.aws.amazon.com/cli/latest/topic/config-vars.html#sourcing-credentials-from-external-processes) attribute to reference [`aws-vault` profile](https://github.com/99designs/aws-vault/blob/master/USAGE.md#using-credential_process):
```
[profile dev]
region = us-west-2
credential_process = aws-vault exec --no-session --json dev

[profile extensions-dev-role]
source_profile = dev
role_arn = arn:aws:iam::XXXXXXXXXXXX:role/extensions-dev-developer-role
mfa_serial = arn:aws:iam::XXXXXXXXXXXX:mfa/dev
```
```
aws s3 cp --recursive iso_3166_1_gb s3://brave-user-model-installer-input-dev/iso_3166_1_gb/ --profile extensions-dev-role
```

To upload the component, pass crx directory that has generated crx file and endpoint as arguments.
```bash
aws exec extensions-dev-role -- npm run upload-user-model-installer-updates -- --crx-directory ./build/user-model-installer/output
```

### Importing Chrome Web Store extensions

To import the current list of supported Chrome Web Store extensions, use the following command:

```bash
npm run import-cws-components -- --endpoint <endpoint>
```

where:

* `endpoint` is the DynamoDB endpoint (use http://localhost:8000 if setup locally)

This will download the supported extensions from the Chrome Web Store and upload them to S3.

## Versioning

Versioning occurs automatically. The first time an extension is packaged, it receives the version number `1.0.0`. When uploaded, that version number along with other metadata is stored in DynamoDB. Subsequent packagings increment the last component of the version number by one.

## S3 Credentials

Uploading to S3 requires that you create appropriately provisioned AWS credentials. Once provisioned, you can make your credentials accessible to this script via [`aws-vault`](https://github.com/brave/devops/wiki/Developing-With-AWS-Access-Keys#aws-access-key-management).


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
