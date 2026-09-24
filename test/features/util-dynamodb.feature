Feature: DynamoDB version bookkeeping
  Business rule: the Extensions table is created only when missing; the
  next version is 1.0.0 for unseen components, the previous version
  incremented for known ones, and `undefined` (skip publish) when the
  content hash is unchanged; PutItem records id, hash, version, title,
  disabled flag, patch list and size.

  Scenario: createTableIfNotExists creates a missing table
    When the Extensions table does not exist
    And a table is created if not exists with endpoint "http://localhost:8000" and region "us-west-2"
    Then a CreateTable command was sent with table name "Extensions" and hash key "ID"

  Scenario: createTableIfNotExists skips an existing table
    When the Extensions table already exists
    And a table is created if not exists with endpoint "" and region "us-west-2"
    Then no CreateTable command was sent

  Scenario: getNextVersion returns 1.0.0 for an unknown component
    When the next version is queried for "newcomponent" with no stored item
    Then the next version is "1.0.0"

  Scenario: getNextVersion increments the stored version
    When the next version is queried for "knowncomponent" with stored version "2.3.4" and content hash "abc"
    And the queried content hash is "different-hash"
    Then the next version is "2.3.5"

  Scenario: getNextVersion skips publishing when the content hash is unchanged
    When the next version is queried for "knowncomponent" with stored version "2.3.4" and content hash "same-hash"
    And the queried content hash is "same-hash"
    Then no next version is returned