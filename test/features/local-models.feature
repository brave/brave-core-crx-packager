Feature: Local models downloader
  Business rule: model directories are cloned with a sparse checkout and
  an LFS pull, moved into the target directory with optional renames, and
  any git failure exits with code 1 after removing the temp clone.

  Background:
    Given a fresh working directory for model downloads

  Scenario: downloadLocalModels clones, checks out and moves the model dir
    When "model-dir" is downloaded with sparse checkout path "embeddinggemma-300m"
    Then git was invoked as "clone --depth 1 --filter=blob:none --sparse https://github.com/brave/leo-local-models.git model-dir-tmp"
    And git was invoked as "sparse-checkout set embeddinggemma-300m"
    And git was invoked as "lfs pull --include=embeddinggemma-300m/*"
    And the file "model-dir/embeddinggemma-300m/model.gguf" contains "model-gguf-bytes"

  Scenario: renames are applied inside the model dir
    When "model-dir" is downloaded with renames model.gguf: weights-renamed.gguf
    Then the file "model-dir/embeddinggemma-300m/weights-renamed.gguf" exists
    And the file "model-dir/embeddinggemma-300m/model.gguf" does not exist

  Scenario: a git failure exits with code 1 and cleans up
    Given the git shim fails for "clone"
    When the model download is attempted for "model-dir"
    Then the process exited with code 1
    And the temp directory "model-dir-tmp" no longer exists