Feature: CRX generation, upload and differential patches
  Business rule: a Chrome binary packs the staging directory and the
  result is renamed into place; CRX uploads land in
  `release/<id>/extension_<version>.crx` with ACL grants, component tags,
  patch objects, and the previous version's latest tag is removed;
  DynamoDB records hash, size and patch list; puffin diffs are deferred
  jobs over previously downloaded CRX versions.

  Background:
    Given a staged extension directory with a generated key

  Scenario: generateCRXFile packs via the chrome binary and renames the output
    When the CRX file is generated with binary "chrome" into "<tmp>/out.crx" with alt key
    Then chrome received a "--pack-extension" argument for the staging dir
    And chrome received "--pack-extension-key" and "--brave-extension-publisher-key"
    And chrome received "--brave-extension-publisher-key-alt"
    And the CRX output exists at "<tmp>/out.crx" containing the staged manifest

  Scenario: generateCRXFile omits the alt flag when no alt key is given
    When the CRX file is generated with binary "chrome" into "<tmp>/out.crx" without alt key
    Then chrome never received "--brave-extension-publisher-key-alt"

  Scenario: generateCRXFile rejects a missing binary
    When the CRX file is generated with binary "" into "<tmp>/out.crx"
    Then the generation fails with "Missing Brave binary: --binary"

  Scenario: generateCRXFile rejects a missing publisher proof key
    When the CRX file is generated with binary "chrome" without a publisher proof key
    Then the generation fails with "Missing --publisher-proof-key"

  Scenario: generateCRXFile rejects a missing private key file
    When the CRX file is generated with binary "chrome" and a nonexistent private key
    Then the generation fails with "Private key file"

  Scenario: generateCRXFile rejects a nonexistent alt key file
    When the CRX file is generated with binary "chrome" and a nonexistent alt key
    Then the generation fails with "does not exist"

  Scenario: uploadCRXFile uploads the CRX and tags the latest version
    When the CRX file "2.3.4" is uploaded with endpoint "http://e" region "us-west-2" and no patches on S3
    Then the S3 PutObject targeted "release/<id>/extension_2_3_4.crx" with content type "application/x-chrome-extension"
    And the PutObjectTagging tagged the component with version "2.3.4" and latest tag
    And the S3 HeadObject targeted "release/<id>/extension_2_3_3.crx"
    And only 1 PutObjectTagging command was sent

  Scenario: uploadCRXFile removes the latest tag from the previous version
    When the CRX file "2.3.4" is uploaded with the previous version "2.3.3" present
    Then the S3 HeadObject targeted "release/<id>/extension_2_3_3.crx"
    And the previous version was re-tagged with its own version

  Scenario: uploadCRXFile uploads pending puff patches
    Given two puff patches exist for the fixture hash
    When the CRX file "2.3.4" is uploaded
    Then the S3 PutObject uploaded 3 objects including 2 patches as "application/octet-stream"

  Scenario: uploadCRXFile fails when the S3 upload fails
    When the S3 PutObject rejects with "AccessDenied"
    And the CRX file "2.3.4" is uploaded
    Then the upload fails with "Failed to upload extension to S3"

  Scenario: uploadCRXFile resolves the i18n manifest name
    Given the staged extension uses the localized name placeholder "__MSG_extName__" with locale "en" message "Localized Component"
    When the CRX file "2.3.4" is uploaded
    Then the tagging recorded the component name "Localized-Component"

  Scenario: updateDBForCRXFile records the item with the patch list
    Given two puff patch files exist under the fixture patch dir
    When the DB is updated for the CRX file "2.3.4" with content hash "content-1"
    Then the PutItem stored the component id with hash, size and 2 patch entries

  Scenario: fetchPreviousVersions downloads prior versions named by hash
    When the previous 2 versions of the CRX file "2.3.4" are fetched
    Then 2 GetObject commands targeted "release/<id>/extension_2_3_3.crx" and "release/<id>/extension_2_3_2.crx"
    And 2 hash-named .crx files exist under "build/previous/<id>"

  Scenario: fetchPreviousVersions tolerates missing previous objects
    When the S3 GetObject rejects with "NoSuchKey"
    And the previous 1 versions of the CRX file "2.3.4" are fetched
    Then the fetch of previous versions succeeds

  Scenario: generatePuffPatches defers one puffin job per previous CRX
    Given a previous CRX file "extension_2_3_3.crx" under "build/previous/<id>"
    When the puff patches are generated
    Then 1 patch job is returned
    And running the job invokes puffin with "-puffdiff" for the previous CRX and the fixture CRX

  Scenario: generateAndWriteVerifiedContents writes the metadata file
    When verified contents are generated and written for the fixture staging dir
    Then "brave_metadata/verified_contents.json" exists with the component item id