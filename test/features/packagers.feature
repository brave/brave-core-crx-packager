Feature: Simple component packagers
  Business rule: each packager derives its public key and component id
  from the signing key via openssl, asks DynamoDB for the next version,
  stages its committed resources with the stamped manifest, and signs a
  CRX through the chrome binary; --local-run stages version 1.0.0 with
  no signing and no remote calls; a missing key aborts the run.

  Scenario: the NTP background images component is packaged
    Given the NTP background images resources are staged
    And the DynamoDB table has version "2.0.0" stored for the component
    When the packager "packageNTPBackgroundImagesComponent.js" runs with "--binary chrome --key-file key.pem --endpoint http://e --region us-west-2 --publisher-proof-key proof.pem"
    Then the CRX file "build/ntp-background-images/output/ntp-background-images.crx" exists
    And the regenerated manifest "build/ntp-background-images/ntp-background-images-manifest.json" declares name "Brave NTP background images"

  Scenario: the brave-user-agent component is packaged
    Given a default manifest for "brave-user-agent" and resource file "brave-user-agent/brave-checks.txt"
    And the DynamoDB table has version "2.0.0" stored for the component
    When the packager "packageBraveUserAgentComponent.js" runs with "--binary chrome --key-file key.pem --endpoint http://e --region us-west-2 --publisher-proof-key proof.pem"
    Then the CRX file "build/brave-user-agent/brave-user-agent.crx" exists
    And the regenerated manifest "manifests/brave-user-agent/default-manifest.json" declares name "Brave User Agent"
    And the staged manifest "build/brave-user-agent/manifest.json" declares version "2.0.1"

  Scenario: the playlist-exclusions component is packaged
    Given a default manifest for "playlist-exclusions" and resource file "playlist-exclusions/data.txt"
    And the DynamoDB table has version "2.0.0" stored for the component
    When the packager "packagePlaylistExclusionsComponent.js" runs with "--binary chrome --key-file key.pem --endpoint http://e --region us-west-2 --publisher-proof-key proof.pem"
    Then the CRX file "build/playlist-exclusions/playlist-exclusions.crx" exists
    And the staged manifest "build/playlist-exclusions/manifest.json" declares version "2.0.1"

  Scenario: the query-filter component is packaged
    Given a default manifest for "query-filter" and resource file "query-filter/query-filter.json"
    And the DynamoDB table has version "2.0.0" stored for the component
    When the packager "packageQueryFilterComponent.js" runs with "--binary chrome --key-file key.pem --endpoint http://e --region us-west-2 --publisher-proof-key proof.pem"
    Then the CRX file "build/query-filter/query-filter.crx" exists
    And the regenerated manifest "manifests/query-filter/default-manifest.json" declares name "Query Filter"

  Scenario: the psst component is packaged
    Given a default manifest for "psst" and resource file "psst-component/out/bundle.js"
    And the DynamoDB table has version "2.0.0" stored for the component
    When the packager "packageBravePsstComponent.js" runs with "--binary chrome --key-file key.pem --endpoint http://e --region us-west-2 --publisher-proof-key proof.pem"
    Then the CRX file "build/psst/psst.crx" exists

  Scenario: the web-mcp component is packaged
    Given a default manifest for "web-mcp" and resource file "web-mcp/scripts/index.js"
    And the DynamoDB table has version "2.0.0" stored for the component
    When the packager "packageWebMcpComponent.js" runs with "--binary chrome --key-file key.pem --endpoint http://e --region us-west-2 --publisher-proof-key proof.pem"
    Then the CRX file "build/web-mcp/web-mcp.crx" exists

  Scenario: the youtube-script-injector component is packaged
    Given committed data for "youtube-script-injector" with manifest name "YouTube Script Injector"
    And the DynamoDB table has version "2.0.0" stored for the component
    When the packager "packageYouTubeScriptInjector.js" runs with "--binary chrome --key-file key.pem --endpoint http://e --region us-west-2 --publisher-proof-key proof.pem"
    Then the CRX file "build/youtube-script-injector/youtube-script-injector.crx" exists

  Scenario: the p3a-config component stages locally without signing
    Given a default manifest for "p3a-config" and p3a config files
    When the packager "packageP3AConfig.js" runs with "--local-run"
    Then the staged manifest "build/p3a-config/default/manifest.json" declares version "1.0.0"
    And the file "build/p3a-config/default/p3a_manifest.json" exists
    And no CRX file was generated at "build/p3a-config/p3a-config-default.crx"

  Scenario: the p3a-config component is signed remotely
    Given a default manifest for "p3a-config" and p3a config files
    And the DynamoDB table has version "2.0.0" stored for the component
    When the packager "packageP3AConfig.js" runs with "--binary chrome --key-file key.pem --endpoint http://e --region us-west-2 --publisher-proof-key proof.pem"
    Then the CRX file "build/p3a-config/p3a-config-default.crx" exists
    And the staged manifest "build/p3a-config/default/manifest.json" declares version "2.0.1"

  Scenario: the p3a-config staging config is used with --staging
    Given a default manifest for "p3a-config" and p3a config files
    When the packager "packageP3AConfig.js" runs with "--local-run --staging"
    Then the staged p3a manifest came from "p3a-config-staging"

  Scenario: the local-data-files component is staged locally
    Given a default manifest for "local-data-files-updater" and brave list files
    When the packager "packageLocalDataFiles.js" runs with "--local-run"
    Then the file "build/local-data-files-updater/default/1/debounce.json" exists
    And no CRX file was generated at "build/local-data-files-updater/local-data-files-updater-default.crx"

  Scenario: the local-data-files component is signed remotely
    Given a default manifest for "local-data-files-updater" and brave list files
    And the DynamoDB table has version "2.0.0" stored for the component
    When the packager "packageLocalDataFiles.js" runs with "--binary chrome --key-file key.pem --endpoint http://e --region us-west-2 --publisher-proof-key proof.pem"
    Then the CRX file "build/local-data-files-updater/local-data-files-updater-default.crx" exists
    And the staged manifest "build/local-data-files-updater/default/manifest.json" declares version "2.0.1"

  Scenario: a missing signing key aborts the packager
    And the DynamoDB table has version "2.0.0" stored for the component
    When the packager "packageNTPBackgroundImagesComponent.js" runs with "--binary chrome --endpoint http://e --region us-west-2"
    Then the packaging fails with "Missing or invalid private key"

  Scenario: the leo local models wrapper packages its component
    Given a default manifest for "leo-local-models-updater" and resource file "leo-local-models/embeddinggemma-300m/model.gguf"
    And the DynamoDB table has version "2.0.0" stored for the component
    When the packager "packageLeoLocalModels.js" runs with "--binary chrome --key-file key.pem --endpoint http://e --region us-west-2 --publisher-proof-key proof.pem"
    Then the CRX file "build/leo-local-models-updater/leo-local-models-updater-default.crx" exists

  Scenario: the asr local models wrapper packages its component
    Given a default manifest for "asr-local-models-updater" and resource file "asr-local-models/nemotron-speech-streaming-en-0.6b-int4-onnx/weights.bin"
    And the DynamoDB table has version "2.0.0" stored for the component
    When the packager "packageAsrLocalModels.js" runs with "--binary chrome --key-file key.pem --endpoint http://e --region us-west-2 --publisher-proof-key proof.pem"
    Then the CRX file "build/asr-local-models-updater/asr-local-models-updater-default.crx" exists