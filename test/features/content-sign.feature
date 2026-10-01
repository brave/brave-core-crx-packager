Feature: Verified contents signing
  Business rule: each component file is hashed in 4096-byte blocks and
  reduced to a Merkle root; the payload lists per-file roots plus the
  component id/version and is signed RS256 JWS-style with the component
  key (kid "webstore").

  Background:
    Given a component directory with a private key and an id

  Scenario: an empty file hashes to the empty-tree root
    When verified contents are created with pattern "empty.txt" over an empty file "empty.txt"
    Then the payload lists 1 file
    And the file "empty.txt" has root hash equal to sha256 of the empty buffer

  Scenario: block boundaries are respected when hashing files
    When verified contents are created over the boundary files "tiny.txt" of 1 byte, "full.bin" of 4096 bytes and "spill.bin" of 4097 bytes
    Then the root hash of "tiny.txt" equals sha256 of its content
    And the root hash of "full.bin" equals sha256 of its content
    And the root hash of "spill.bin" equals sha256 of the concatenation of its block hashes

  Scenario: the payload carries id, version and protocol version
    When verified contents are created over the file "data.txt"
    Then the payload item id is the component id
    And the payload item version is "1.2.3"
    And the payload protocol version is 1

  Scenario: the payload is signed with RS256 and the kid webstore
    When verified contents are created over the file "data.txt"
    Then the single signature has protected header alg "RS256" and kid "webstore"
    And the signature verifies against the payload with the component public key

  Scenario: a modified payload breaks the signature
    When verified contents are created over the file "data.txt"
    And the payload is modified
    Then the signature no longer verifies

  Scenario: file patterns restrict the signed file set
    Given the component directory also contains "extra/ignored.txt"
    When verified contents are created with pattern "*.txt"
    Then exactly the files "empty.txt, tiny.txt" are listed in the payload