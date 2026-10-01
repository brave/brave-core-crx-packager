Feature: NTP sponsored-images target component selection
  Business rule: comma-separated include and exclude lists select regions
  and platforms from the component metadata table; invalid characters are
  stripped, unknown entries are dropped, and blank inputs mean "all".

  Scenario: blank parameters select every component
    When the target components are selected with no includes and no excludes
    Then every known component is selected

  Scenario: a single include selects only that component
    When the target components are selected for includes "US-android" and excludes ""
    Then exactly these components are selected: "US-android"

  Scenario: unknown entries are dropped from the selection
    When the target components are selected for includes "US-android,IT,FR-desktop,asd" and excludes ""
    Then exactly these components are selected: "US-android, FR-desktop"

  Scenario: invalid characters are stripped but the component is kept
    When the target components are selected for includes "'US-an;droid'," and excludes ""
    Then exactly these components are selected: "US-android"

  Scenario: an excluded component is removed from the selection
    When the target components are selected with no includes and excludes "US-android"
    Then every known component is selected except "US-android"