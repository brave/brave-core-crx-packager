Feature: Complex component packagers
  Business rule: ad-block components package pre-generated outputs with
  in-place manifest versioning, verified contents and content-hash skip
  bookkeeping; tor clients are downloaded from S3 and checksum-verified
  against pinned sha512 values; pluggable transports are copied from
  pre-staged local paths; wallet data files come from the @brave/wallet-lists
  package (with a node_modules fallback); manifest-v2 extensions are
  downloaded, unzipped, re-signed with the pure-JS packager and skipped
  when the content hash is unchanged; the brave ads resources packager
  derives manifests from its component table and aborts without keys.

  Scenario: the ad-block packager stages locally without signing
    Given the ad-block updater outputs and catalog are staged
    When the complex packager "packageAdBlock.js" runs with "--local-run"
    Then a contentHash file exists for each ad-block component
    And no CRX file was generated at "build/ad-block-updater/ad-block-updater-gkboaolpopklhgplhaaiboijnklogmbc.crx"

  Scenario: the ad-block packager signs remotely with verified contents
    Given the ad-block updater outputs and catalog are staged
    And a keys directory with per-component pem files
    And the DynamoDB table has version "2.0.0" stored for the component
    When the complex packager "packageAdBlock.js" runs with "--binary chrome --keys-directory keys --verified-contents-key vc.pem --endpoint http://e --region us-west-2 --publisher-proof-key proof.pem"
    Then the CRX file "build/ad-block-updater/ad-block-updater-gkboaolpopklhgplhaaiboijnklogmbc.crx" exists
    And the CRX file "build/ad-block-updater/ad-block-updater-mfddibmblmbccpadfndgakiopmmhebop.crx" exists
    And each ad-block staging dir contains "brave_metadata/verified_contents.json"

  Scenario: unchanged ad-block content skips publishing
    Given the ad-block updater outputs and catalog are staged
    And a keys directory with per-component pem files
    And the DynamoDB stored the current content hash for the ad-block components
    When the complex packager "packageAdBlock.js" runs with "--binary chrome --keys-directory keys --endpoint http://e --region us-west-2"
    Then the run logged "was not updated, skipping"
    And no contentHash files were written

  Scenario: a missing ad-block manifest is skipped
    Given the ad-block updater outputs and catalog are staged
    And the manifest for "mfddibmblmbccpadfndgakiopmmhebop" is removed
    When the complex packager "packageAdBlock.js" runs with "--local-run"
    Then the run logged "Missing manifest for mfddibmblmbccpadfndgakiopmmhebop. Skipping."

  Scenario: the tor client download fails checksum verification
    Given tor client manifests and a sha512 mismatching tor binary from the aws shim
    When the complex packager "packageTorClient.js" runs with "--binary chrome --key-file key.pem --endpoint http://e --region us-west-2 --publisher-proof-key proof.pem"
    Then the run logged "Tor client checksum verification failed on darwin"
    And the run exited with code 1

  Scenario: the tor pluggable transports are staged per platform
    Given pluggable transport sources for all platforms
    When the complex packager "packageTorPluggableTransports.js" runs with "--binary chrome --key-file key.pem --endpoint http://e --region us-west-2 --publisher-proof-key proof.pem"
    Then the CRX file "build/tor-pluggable-transports-updater/tor-pluggable-transports-updater-darwin.crx" exists
    And the CRX file "build/tor-pluggable-transports-updater/tor-pluggable-transports-updater-win32.crx" exists

  Scenario: the wallet data files come from the fallback package dir
    Given a wallet-lists package dir with manifest and data
    When the complex packager "packageWalletDataFiles.js" runs with "--binary chrome --key-file key.pem --endpoint http://e --region us-west-2 --publisher-proof-key proof.pem"
    Then the CRX file "build/wallet-data-files-updater/wallet-data-files-updater.crx" exists
    And the staged wallet manifest declares version "2.0.1"
    And the staged wallet dir has no "package.json"

  Scenario: manifest v2 extensions are re-signed locally
    Given manifest v2 extension configs with served sources archives
    When the complex packager "packageManifestV2Extensions.js" runs with "--local-run --keys-directory keys --publisher-proof-key proof.pem"
    Then every manifest v2 extension output exists
    And the run logged "Sources hash:"

  Scenario: manifest v2 extensions without keys are rejected
    When the complex packager "packageManifestV2Extensions.js" runs with "--local-run"
    Then the packaging fails with "Missing or invalid private key file/directory"

  Scenario: the brave ads resources packager rejects a missing keys directory
    When the complex packager "packageBraveAdsResourcesComponent.js" runs with "--binary chrome --endpoint http://e --region us-west-2"
    Then the packaging fails with "Missing or invalid private key directory"

  Scenario: the brave ads resources packager stages manifests and aborts on missing keys
    Given brave ads resources for every locale
    And a keys directory without per-locale pem files
    When the complex packager "packageBraveAdsResourcesComponent.js" runs with "--binary chrome --keys-directory keys --endpoint http://e --region us-west-2"
    Then the file "build/user-model-installer/manifiest-files/iso_3166_1_gb-manifest.json" exists
    And the run exited with code 1