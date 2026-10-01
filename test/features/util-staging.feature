Feature: Manifest parsing and staging
  Business rule: manifests may carry `//#` comments which are stripped
  before parsing; staging copies resources into an output dir and stamps
  the placeholder version 0.0.0 with the target version; staged file
  sets must contain a manifest.json.

  Scenario: parseManifest strips //# comments
    Given a manifest file containing:
      """
      {
        //# schema comment
        "name": "component",
        "version": "0.0.0" //# trailing comment
      }
      """
    When the manifest is parsed
    Then the parsed name is "component"
    And the parsed version is "0.0.0"

  Scenario: copyManifestWithVersion stamps the placeholder version
    Given a manifest file with version "0.0.0"
    When the manifest is copied to an output dir with version "1.2.3"
    Then the copied manifest declares version "1.2.3"

  Scenario: stageDir copies resources and stamps the manifest version
    Given a resource directory with files "data.json" and "sub/nested.txt"
    When the resource directory is staged with version "2.0.0"
    Then the staging output contains the files:
      """
      data.json
      sub/nested.txt
      manifest.json
      """
    And the staged manifest declares version "2.0.0"

  Scenario: stageFiles copies files under their output names
    Given a staged file set of "a.js" as "renamed.js" plus "manifest.json"
    When the files are staged with version "3.0.0"
    Then the staging output contains the files:
      """
      renamed.js
      manifest.json
      """
    And the staged manifest declares version "3.0.0"

  Scenario: stageFiles without a manifest is rejected
    Given a lone staged file "a.js" without a manifest
    When staging is attempted with version "3.0.0"
    Then the staging fails with "Missing manifest.json in output files"

  Scenario: escapeStringForJSON escapes quotes and control characters
    When a string with quotes, backslashes and newlines is escaped for JSON
    Then the escaped output round-trips through JSON.parse

  Scenario: escapeStringForJSON rejects non-strings
    When the number 42 is escaped for JSON
    Then the escaping fails with "Not a string"

  Scenario: addCommonScriptOptions wires the common CLI flags
    When the common script options are parsed from "--binary chrome --publisher-proof-key proof.pem --publisher-proof-key-alt alt.pem --verified-contents-key vc.pem --endpoint http://endpoint --region eu-west-1"
    Then the parsed binary is "chrome"
    And the parsed publisher proof key is "proof.pem"
    And the parsed alt publisher proof key is "alt.pem"
    And the parsed verified contents key is "vc.pem"
    And the parsed endpoint is "http://endpoint"
    And the parsed region is "eu-west-1"

  Scenario: addCommonScriptOptions provides endpoint and region defaults
    When the common script options are parsed from no arguments
    Then the parsed endpoint is ""
    And the parsed region is "us-west-2"