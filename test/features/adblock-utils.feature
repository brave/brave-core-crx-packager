Feature: Ad-block list utilities
  Business rule: uBO-style `!#if` preprocessor directives are evaluated
  against Brave's condition table with a stack machine; oversized iOS
  validator payloads are zstd-compressed; corrupted lists that would block
  known-good requests are rejected before any network call; and the
  resources file merges uBO resources with Brave's own resources.

  Background:
    Given the adblock-rust engine is available

  Scenario: the preprocessor keeps only Brave-visible rules
    When the following list is preprocessed:
      """
      x##x:remove()
      !#if cap_html_filtering
      a##cap-filtering:remove()
      !#else
      b##no-cap-filtering:remove()
      !#endif
      c##c:remove()
      !#if whatever
      d##whatever:remove()
      !#if !env_firefox
      e##not-firefox:remove()
      !#else
      !#if !false
      f##firefox:remove()
      !#endif
      !#endif
      g##whatever:remove()
      !#endif
      h##h:remove()
      """
    Then the preprocessed output is exactly:
      """
      x##x:remove()
      b##no-cap-filtering:remove()
      c##c:remove()
      d##whatever:remove()
      e##not-firefox:remove()
      g##whatever:remove()
      h##h:remove()
      """

  Scenario: small iOS validator payloads stay uncompressed
    When a payload of IOS_VALIDATOR_ZSTD_THRESHOLD minus 1 characters is prepared for the iOS validator
    Then the body is returned unchanged as a string
    And no "Content-Encoding" header is set

  Scenario: payloads at the size threshold are zstd-compressed
    When a payload of exactly IOS_VALIDATOR_ZSTD_THRESHOLD characters is prepared for the iOS validator
    Then the body is a buffer starting with the zstd magic bytes
    And the "Content-Encoding" header is "application/zstd"
    And the body decompresses back to the original payload

  Scenario: payloads above the size threshold are zstd-compressed
    When a payload larger than IOS_VALIDATOR_ZSTD_THRESHOLD is prepared for the iOS validator
    Then the body is a buffer starting with the zstd magic bytes
    And the "Content-Encoding" header is "application/zstd"
    And the body decompresses back to the original payload

  Scenario: a corrupted list fails the sanity check before any network call
    When the corrupted elc-1.0.3814 list is sanity checked
    Then the check fails with "corrupted list failed sanity check for"
    And no network request was made

  Scenario: oversized iOS validator payloads are zstd-compressed in transit
    When a 70000-rule list is sanity checked
    Then exactly 1 network request was made to the iOS validator
    And the request body is zstd-compressed JSON with rules at least IOS_VALIDATOR_ZSTD_THRESHOLD bytes long

  Scenario: the resources file merges uBlock and Brave resources
    When a Brave resources JSON is served from "https://raw.githubusercontent.com/brave/adblock-resources/master/dist/resources.json" as:
      """
      [{"name": "brave-extra", "kind": {"mime": "application/javascript"}, "content": "Y29uc29sZS5sb2coJ2hpJyk="}]
      """
    And the resources file is generated
    Then the resources file is a JSON array with at least 10 entries
    And every JavaScript entry base64-decodes to syntactically valid JS

  @property
  Scenario: balanced preprocessor input never throws and drops all directives
    When the preprocessor property holds for 50 runs
    Then the property holds