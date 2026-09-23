Feature: Identity derivation and hashing
  Business rule: component IDs are the SHA-256 of the base64-decoded
  public key, hex-encoded then remapped from 0-9a-f to a-p (32 chars);
  hashes exist for strings, files and version-prefixed file contents;
  the process error handlers exit with code 1.

  Scenario: getIDFromBase64PublicKey derives the a-p component id
    When the component id is derived from a generated base64 public key
    Then the id is 32 characters from the a-p alphabet
    And deriving it again yields the same id
    And deriving from a different key yields a different id

  Scenario: generateSHA256Hash matches the known empty-string vector
    When the empty string is hashed with SHA-256
    Then the hash is "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

  Scenario: generateSHA256HashOfFile and the versioned variant
    Given a file containing "payload"
    When the file is hashed and hashed with version "1.0.0"
    Then the versioned hash equals sha256 of "1.0.0payload" and differs from the unversioned hash

  Scenario: installErrorHandlers registers handlers that exit with code 1
    When the error handlers are installed
    Then an uncaughtException handler is registered
    And an unhandledRejection handler is registered
    And invoking the uncaughtException handler exits with code 1
    And invoking the unhandledRejection handler exits with code 1