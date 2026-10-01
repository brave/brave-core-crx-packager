Feature: Ad-block data file generators
  Business rule: lists are mirrored from brave/adblock-lists-mirror by
  md5-of-url, preprocessed, stripped of incompatible rules, sanity
  checked and serialized per component; non-Brave lists must not carry
  brave-specific +js() directives; the regional and list catalogs are
  copied into the regional catalog component dir; manifest generation
  writes a template manifest per component.

  Scenario: the default and regional lists are generated with resources and catalogs
    When the ad block data files are generated
    Then the default list file contains "brave-default-rule" and keeps "+js(brave-shield)"
    And the regional list file contains "regional-rule" but drops "+js(brave-hide)"
    And the regional catalog file lists "Regional List"
    And the list catalog file lists "Brave Default"
    And the resources file exists in the resources component dir

  Scenario: a failing source download skips publishing that list
    Given the mirrored list for "https://example.invalid/default-list.txt" fails with status 500
    When the ad block data files are generated
    Then no list.txt was written for "bbbbbbbbbbbbbbbbbbbbbbbbbbbbaaaad"
    And the run logged "Not publishing a new version of Brave Default"

  Scenario: a commit hash pins the mirror URL
    When the ad block data files are generated with commit hash "abc123"
    Then every mirror request used commit "abc123"

  Scenario: manifest generation covers all components
    When the ad block manifests are generated
    Then the regional catalog manifest declares the name "Brave Ad Block Updater (Regional Catalog)"
    And the regional list manifest declares the name "Brave Ad Block Updater (Regional List (plaintext))"