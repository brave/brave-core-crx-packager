Feature: Upload component and puff patch generation
  Business rule: upload-component uploads every CRX (single file or
  directory, concurrency 5) to S3, then records each in DynamoDB
  including optional `<name>.contentHash` sidecar files; puff patches
  are deferred puffin jobs over the previously downloaded versions with
  a configurable concurrency (invalid values fall back to 1).

  Scenario: a single CRX is uploaded and recorded in DynamoDB
    Given an uploadable CRX fixture "extension.crx" with version "2.0.0"
    And the S3 GetObject serves the previous version body
    When the infra upload runs with crx file "extension.crx"
    Then the upload PutObject targeted "release/<id>/extension_2_0_0.crx" with content type "application/x-chrome-extension"
    And the DynamoDB records version "2.0.0" for the uploaded component

  Scenario: a CRX directory uploads every file with its content hash
    Given a crx directory "crx-dir" with "a.crx" and its "a.contentHash" content "hash-abc" plus "notes.txt"
    When the infra upload runs with "--crx-directory crx-dir"
    Then the DynamoDB records content hash "hash-abc" for component "a"
    And no .txt files were uploaded

  Scenario: a missing CRX aborts the upload
    When the infra upload runs with "--crx-file missing.crx"
    Then the infra run fails with "Missing or invalid crx file/directory"

  Scenario: puff patches are generated for the previous version
    Given an uploadable CRX fixture "component.crx" with version "2.0.1"
    And the S3 GetObject serves the previous version body
    When the puff patches are generated with "-f component.crx -p 1"
    Then a .puff patch exists for the fixture component
    And the run logged "All patches generated."

  Scenario: an invalid concurrency falls back to one
    Given an uploadable CRX fixture "component.crx" with version "2.0.0"
    When the puff patches are generated with "-f component.crx -c zero"
    Then the run logged "Invalid concurrency value 'NaN'. Falling back to 1."
    And the run logged "Using puffin concurrency limit of 1"