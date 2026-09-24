Feature: Data file generators (psst, web-mcp, local models)
  Business rule: repository data generators are import-safe modules whose
  main() clones or reuses the source repo, records every external
  command, and assembles the resource directory the packager stages;
  invalid inputs exit with code 1 without touching the repo.

  Scenario: psst data files clone, install and bundle for prod
    Given a fresh sandbox for data file generators
    When the psst data files are generated for "prod"
    Then git was invoked as "clone --branch main --depth 1 git@github.com:brave/psst-component.git ./psst-component"
    And npm was invoked as "install --prefix ./psst-component"
    And npm was invoked as "run --prefix ./psst-component bundle:prod"

  Scenario: psst data files reuse an existing checkout
    Given a fresh sandbox for data file generators
    And the directory "psst-component" already exists
    When the psst data files are generated
    Then git was invoked as "-C ./psst-component fetch origin main"
    And git was invoked as "-C ./psst-component reset --hard origin/main"

  Scenario: psst data files reject an invalid mode
    Given a fresh sandbox for data file generators
    When the psst data files are generated for "staging"
    Then the process exited with code 1

  Scenario: web-mcp data files clone and assemble the resource dir
    Given a fresh sandbox for data file generators
    And the git shim seeds the cloned repo with a "scripts" directory
    When the web-mcp data files are generated
    Then the file "web-mcp/scripts/index.js" exists
    And git was invoked as "clone --branch master --depth 1 git@github.com:brave/brave-webmcp.git ./brave-webmcp"

  Scenario: web-mcp data files reuse an existing checkout
    Given a fresh sandbox for data file generators
    And the directory "brave-webmcp" already exists with a "scripts" directory
    When the web-mcp data files are generated
    Then git was invoked as "-C ./brave-webmcp fetch origin master"
    And the file "web-mcp/scripts/index.js" exists

  Scenario: leo local models data files use the shared downloader
    Given a fresh sandbox for data file generators
    When the leo local models data files are generated
    Then git was invoked as "sparse-checkout set embeddinggemma-300m"
    And the file "leo-local-models/embeddinggemma-300m/model.gguf" exists

  Scenario: asr local models data files use their sparse path
    Given a fresh sandbox for data file generators
    When the asr local models data files are generated
    Then git was invoked as "sparse-checkout set nemotron-speech-streaming-en-0.6b-int4-onnx"
    And the file "asr-local-models/nemotron-speech-streaming-en-0.6b-int4-onnx/weights.bin" exists