Feature: Local models component packaging
  Business rule: the shared packager stages the model directory plus the
  committed default manifest, asks DynamoDB for the next version, and
  signs a CRX with the chrome binary; `--local-run` skips all remote
  interaction and stages version 1.0.0 without signing.

  Background:
    Given a sandbox with manifests and a resource dir for component type "test-local-models-updater"

  Scenario: a local run stages version 1.0.0 without signing
    When the local models component is packaged with "--local-run"
    Then the staged manifest "build/test-local-models-updater/default/manifest.json" declares version "1.0.0"
    And no CRX file was generated at "build/test-local-models-updater/test-local-models-updater-default.crx"

  Scenario: a remote run signs the CRX with the next version
    Given the DynamoDB table has version "2.0.0" stored for the component
    When the local models component is packaged with "--binary chrome --publisher-proof-key proof.pem --key-file key.pem --endpoint http://e --region us-west-2"
    Then the CRX file "build/test-local-models-updater/test-local-models-updater-default.crx" exists
    And the staged manifest "build/test-local-models-updater/default/manifest.json" declares version "2.0.1"
    And chrome was invoked with "--pack-extension" for the staged dir "build/test-local-models-updater/default"
    And the signing key was passed to chrome

  Scenario: a missing key file fails the run
    When the local models component is packaged with "--binary chrome --publisher-proof-key proof.pem --key-file missing.pem --endpoint http://e --region us-west-2"
    Then the packaging fails with "Missing or invalid private key file/directory"