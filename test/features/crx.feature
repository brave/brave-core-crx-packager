Feature: Pure-JS CRX3 packaging
  Business rule: staging content is zipped in memory, signed with the
  extension key using CRX3 SignedData framing, publisher proofs are
  attached when provided, and optional verified contents are embedded and
  gzipped. The result is a Cr24 version-3 buffer whose signatures verify
  against its exact bytes, so any tampering is detectable.

  Background:
    Given RSA signing keys and a staged extension directory

  Scenario: the CRX buffer starts with a valid Cr24 version-3 header
    When the extension is packaged with publisher keys and verified contents
    Then the CRX buffer starts with magic "Cr24" and version 3

  Scenario: the CRX buffer contains a valid ZIP payload
    When the extension is packaged with publisher keys and verified contents
    Then the zip payload contains "file1.js" with content "file1"
    And the zip payload contains "file2.html" with content "file2"
    And the zipped manifest declares update url "https://clients2.google.com/service/update2/crx"
    And the manifest key resolves to the signed CRX id

  Scenario: verified contents are embedded with the component id
    When the extension is packaged with publisher keys and verified contents
    Then the header embeds verified contents described as "treehash per file"
    And the verified contents payload item id matches the signed CRX id
    And the verified contents carry exactly 1 signature

  Scenario: all signatures verify against the CRX3 signed data
    When the extension is packaged with publisher keys and verified contents
    Then every sha256-with-rsa proof in the header verifies

  Scenario: a modified zip payload fails signature verification
    When the extension is packaged with publisher keys and verified contents
    And the zip payload is corrupted
    Then signature verification fails

  Scenario: a modified header length fails signature verification
    When the extension is packaged with publisher keys and verified contents
    And the header length byte is corrupted
    Then signature verification fails

  Scenario: a modified header body fails signature verification
    When the extension is packaged with publisher keys and verified contents
    And the header body is corrupted
    Then signature verification fails

  Scenario: a CRX without verified contents omits the verified contents field
    When the extension is packaged with publisher keys but no verified contents key
    Then the header has no verified contents

  Scenario: a CRX without publisher keys keeps only the extension proof
    When the extension is packaged without publisher keys and without verified contents
    Then every sha256-with-rsa proof in the header verifies
    And the header has no verified contents