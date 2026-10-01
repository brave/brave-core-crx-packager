Feature: URL fetching and S3-capable fetch
  Business rule: list downloads retry up to 5 attempts with a 3-second
  backoff and surface the failing URL; `s3://` URLs are only honoured for
  an explicit permit list of theme buckets, anything else must come over
  https, and unknown protocols are rejected.

  Scenario: fetchTextFromURL returns the body on success
    When "https://example.invalid/list.txt" is served with body:
      """
      line1
      line2
      """
    And the list is fetched from "https://example.invalid/list.txt"
    Then the fetched text is:
      """
      line1
      line2
      """

  Scenario: fetchTextFromURL retries after a server error
    When "https://example.invalid/flaky.txt" fails its first attempt with status 500 and then serves "ok"
    And the list is fetched from "https://example.invalid/flaky.txt"
    Then the fetched text is "ok"
    And exactly 2 fetch calls were recorded

  Scenario: fetchTextFromURL gives up after 5 attempts
    When "https://example.invalid/down.txt" always fails with status 503
    And the list is fetched from "https://example.invalid/down.txt"
    Then the fetch fails mentioning "https://example.invalid/down.txt"

  Scenario: s3capableFetch passes https URLs through to fetch
    When "https://example.invalid/asset.json" is served with body "{}"
    And an s3-capable fetch is made for "https://example.invalid/asset.json"
    Then the response body is "{}"

  Scenario: s3-capable fetch rejects a failed https download
    When "https://example.invalid/missing.json" is served with status 404
    Then an s3-capable fetch for "https://example.invalid/missing.json" fails with "failed with code 404"

  Scenario: s3-capable fetch downloads from a permitted bucket
    When the S3 object "brave-theme-customizations/background.png" serves body "image-bytes"
    And an s3-capable fetch is made for "s3://brave-theme-customizations/background"
    Then the response body is "image-bytes"
    And the S3 GetObject targeted bucket "brave-theme-customizations" key "background"

  Scenario: s3-capable fetch rejects a non-permitted bucket
    Then an s3-capable fetch for "s3://evil-bucket/secret" fails with "not a permitted bucket"

  Scenario: s3-capable fetch rejects unsupported protocols
    Then an s3-capable fetch for "gopher://example.invalid/asset" fails with "unsupported protocol"