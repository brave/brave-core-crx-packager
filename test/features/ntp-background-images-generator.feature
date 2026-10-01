Feature: NTP background images and ads resources generators
  Business rule: photo.json is validated against schema version 1 (each
  image needs name, source, author, link, originalUrl and license) before
  any download; image sources must not escape the staging dir; per-locale
  ads resources manifests require a schemaVersion and their listed
  resource files are fetched into the component dir.

  Scenario: the photo manifest and its images are staged
    Given a photo.json served at "https://ntp.invalid/data/photo.json" for image "bg.jpg" with content "bg-bytes"
    When the NTP background images are generated from "https://ntp.invalid/data"
    Then the staged "build/ntp-background-images/resources/photo.json" declares schema version 1
    And the file "build/ntp-background-images/resources/bg.jpg" contains "bg-bytes"

  Scenario: an unsupported schema version aborts the run
    Given a photo.json served at "https://ntp.invalid/data/photo.json" with schema version 2
    When the NTP background images are generated from "https://ntp.invalid/data"
    Then the process exited with code 1

  Scenario: an image with missing properties aborts the run
    Given a photo.json served at "https://ntp.invalid/data/photo.json" missing required image properties
    When the NTP background images are generated from "https://ntp.invalid/data"
    Then the process exited with code 1

  Scenario: a traversing image source is rejected
    Given a photo.json served at "https://ntp.invalid/data/photo.json" for image "../escape.jpg" with content "evil"
    When the NTP background images are generated from "https://ntp.invalid/data"
    Then the process exited with code 1

  Scenario: ads component input files are downloaded for every locale
    Given ads resources manifests served under "https://ads.invalid/data/"
    When the ads component input files are generated from "https://ads.invalid/data/"
    Then the file "build/user-model-installer/resources/iso_3166_1_us/resources.json" exists
    And the file "build/user-model-installer/resources/iso_639_1_de/data.bin" exists

  Scenario: ads resources without a schema version reject the generation
    Given ads resources manifests served under "https://ads.invalid/data/" without schema versions
    When the ads component input files are generated from "https://ads.invalid/data/"
    Then the generation rejects with "Error from https://ads.invalid/data/"