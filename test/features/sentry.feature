Feature: Optional Sentry initialization
  Business rule: Sentry is only initialized when the `sentry` env var is
  set; when unset the default export stays null so callers can skip
  reporting.

  Scenario: without the sentry env var the module stays null
    When the sentry module is freshly imported
    Then Sentry is null

  Scenario: with the sentry env var the module initializes with the dsn
    Given the sentry env var is set to "https://key@sentry.invalid/1"
    When the sentry module is freshly imported
    Then Sentry was initialized with dsn "https://key@sentry.invalid/1"
    And the initialized Sentry exports captureException