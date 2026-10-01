Feature: NTP asset utilities
  Business rule: asset target paths must never escape the staging root,
  including sibling directories that merely share the root as a string
  prefix, while filesystem-root roots stay usable.

  Scenario: paths inside the root are accepted
    When the target root is a fresh temp directory
    Then the root itself is a valid target
    And "<root>/file.json" is a valid target
    And "<root>/subdir/file.json" is a valid target
    And "<root>/./file.json" is a valid target

  Scenario: a parent traversal is rejected
    When the target root is a fresh temp directory
    Then the target "<root>/../file.json" is rejected with "file.json traverses outside of root"

  Scenario: a sibling directory sharing the root prefix is rejected
    When the target root is a fresh temp directory
    Then the target "<root>-evil/payload" is rejected with "traverses outside of root"

  Scenario: targets under a filesystem root stay valid
    When the target root is the filesystem root
    Then the root itself is a valid target

  Scenario: the public key and component id are derived via openssl
    Given a fresh working directory with a private key "key.pem"
    When the public key and id are derived from "key.pem"
    Then the derived public key matches the base64 of the generated public key
    And the derived id matches the component id of that public key
    And the openssl shim received "-pubout" and "-out public.pub"
    And "public.pub" exists in the working directory

  Scenario: prepareAssets downloads assets and verifies hashes
    Given an assets manifest at "https://assets.invalid/assets.json" listing "images/bg.jpg" with content "bg-bytes"
    When the assets are prepared into a target resource directory
    Then the file "images/bg.jpg" exists under the target directory
    And no preparation error was raised

  Scenario: prepareAssets rejects a hash mismatch
    Given an assets manifest at "https://assets.invalid/assets.json" listing "images/bg.jpg" with content "bg-bytes" but sha256 "deadbeef"
    When the assets are prepared
    Then the preparation fails with "hash does not match"

  Scenario: prepareAssets rejects path traversal
    Given an assets manifest at "https://assets.invalid/assets.json" with asset path "../escape.json"
    When the assets are prepared
    Then the preparation fails with "traverses outside of root"