(function() {
  const script = document.createElement('script');
  script.textContent = `
  function enterPictureInPicture() {
    brave?.nativePipMode();
  }
  `;

  document.head.appendChild(script);
  script.remove();
}());

const pipObserver = new MutationObserver((_mutationsList) => {
  addPipButton();
});

function addPipButton() {
  const fullscreenButton = document.querySelector("button.fullscreen-icon");
  if (!fullscreenButton) {
    return;
  }

  const fullscreenButtonParent = fullscreenButton.closest("div");
  if (!fullscreenButtonParent) {
    return;
  }

  if (fullscreenButtonParent.querySelector("button.pip-icon")) {
    return;
  }

  fullscreenButtonParent.style.display = "flex";
  const pipButtonHTML = `
  <button class="icon-button pip-icon" aria-label="Enter picture-in-picture mode" onclick="enterPictureInPicture()">
  <c3-icon style="">
    <span class="yt-icon-shape yt-spec-icon-shape">
      <div style="width: 100%; height: 100%; display: block; fill: currentcolor;">
        <svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24" viewBox="0 0 24 24" width="24" focusable="false" aria-hidden="true" style="pointer-events: none; display: inherit; width: 100%; height: 100%;">
          <path d="M6,6h12v12H6V6z M15,9h-4v4h4V9z"></path>
        </svg>
      </div>
    </span>
  </c3-icon>
  </button>
  `;
  fullscreenButtonParent.insertAdjacentHTML("afterbegin", pipButtonHTML);
  return true;
}

window.addEventListener("load", () => {
  addPipButton();
  pipObserver.observe(document.body, { childList: true, subtree: true });
});

(function() {
  const script = document.createElement('script');
  script.textContent = `
    // Function to modify the flags if the target object exists
    function modifyYtcfgFlags() {

      if (!window.ytcfg) {
          return;
      }
      const config = window.ytcfg.get("WEB_PLAYER_CONTEXT_CONFIGS")?.WEB_PLAYER_CONTEXT_CONFIG_ID_MWEB_WATCH

      if (config && config.serializedExperimentFlags) {
          let flags = config.serializedExperimentFlags;

          // Replace target flags
          flags = flags
              .replace("html5_picture_in_picture_blocking_ontimeupdate=true", "html5_picture_in_picture_blocking_ontimeupdate=false")
              .replace("html5_picture_in_picture_blocking_onresize=true", "html5_picture_in_picture_blocking_onresize=false")
              .replace("html5_picture_in_picture_blocking_document_fullscreen=true", "html5_picture_in_picture_blocking_document_fullscreen=false")
              .replace("html5_picture_in_picture_blocking_standard_api=true", "html5_picture_in_picture_blocking_standard_api=false")
              .replace("html5_picture_in_picture_logging_onresize=true", "html5_picture_in_picture_logging_onresize=false");

          // Assign updated flags back to the config
          config.serializedExperimentFlags = flags;

          if (observer) {
              observer.disconnect();
          }
      }
  }

  // MutationObserver to watch for new <script> elements
  const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
              mutation.addedNodes.forEach((node) => {
                  if (node.tagName === "SCRIPT") {
                      // Check and modify flags when a new script is added
                      modifyYtcfgFlags();
                  }
              });
          }
      }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  `;

  document.head.appendChild(script);
  script.remove();
}());
