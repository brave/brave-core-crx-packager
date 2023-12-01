new Promise(resolve => {
  const mutationCallback = (mutationList, observer) => {
    const finish = () => {
      observer.disconnect();
      resolve(true);
    }
    for (const mutation of mutationList) {
      if (mutation.type === 'characterData' && mutation.target.textContent === "You're offline. Check your connection.") {
        finish();
      }
    }
  };

  const observer = new MutationObserver(mutationCallback);

  observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true });
})
