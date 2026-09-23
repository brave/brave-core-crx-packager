Feature: BDD toolchain smoke checks
  Business rule: the cucumber harness must intercept the AWS SDKs with
  hermetic fakes, deny all real network traffic, and expose executable
  shims for external CLIs before any feature relies on them.

  Scenario: quibble replaces the AWS S3 client for freshly imported modules
    When the AWS S3 probe constructs a client
    Then the S3 client constructor received "signatureVersion" "v4"

  Scenario: quibble replaces the AWS DynamoDB client with named exports
    When the AWS probe constructs both clients
    Then a DynamoDB client was constructed with region "us-east-1"
    And a sent DynamoDB command is recorded with its input

  Scenario: fetch is hermetic and denies unrouted requests by default
    When a request is made to "https://example.invalid/data.json"
    Then the request fails with "hermetic fetch: unexpected request https://example.invalid/data.json"
    And the failed request was recorded in the fetch log

  Scenario: the chrome shim is reachable on the PATH
    When the chrome shim runs with "--version"
    Then it exits with code 1 complaining about "--pack-extension"

  Scenario: the openssl and puffin shims are reachable on the PATH
    When the puffin shim runs with "-puffdiff" and records its invocation
    Then the puffin record contains "puffin"