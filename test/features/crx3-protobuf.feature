Feature: CRX3 protobuf codec
  Business rule: the hand-generated pbf codec must round-trip CRX3 header
  structures byte-exactly: asymmetric key proofs, signed header data with
  the CRX id, and the full file header including verified contents.

  Scenario: a signed data message round-trips its CRX id
    When signed data with crx id "abcdef1234567890" is written and read back
    Then the crx id reads back as "abcdef1234567890"

  Scenario: an asymmetric key proof round-trips public key and signature
    When a proof with public key "pk-bytes" and signature "sig-bytes" is written and read back
    Then the proof reads back public key "pk-bytes" and signature "sig-bytes"

  Scenario: a CRX file header round-trips rsa proofs, signed data and verified contents
    When a CRX file header is written with 2 rsa proofs, signed header data "shd" and verified contents "vc"
    Then the header reads back 2 identical rsa proofs
    And the header signed header data reads back "shd"
    And the header verified contents read back "vc"

  Scenario: a CRX file header round-trips ecdsa proofs
    When a CRX file header is written with 1 ecdsa proof and no signed data
    Then the header reads back 1 identical ecdsa proof
    And the header has no signed header data