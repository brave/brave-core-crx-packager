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