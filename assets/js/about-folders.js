(function (root) {
  function createFolderMessages(document) {
    const buttons = [...document.querySelectorAll('.folder-platform')];
    const visited = new Set();
    const message = button => document.getElementById(button.getAttribute('aria-controls'));

    function close() {
      for (const button of buttons) {
        button.setAttribute('aria-expanded', 'false');
        message(button).hidden = true;
      }
    }

    function open(button) {
      close();
      button.setAttribute('aria-expanded', 'true');
      message(button).hidden = false;
    }

    function land(platform) {
      close();
      if (!buttons.includes(platform) || visited.has(platform)) return;
      // Only completed landings count; clicks and resizes never restart the first-pass tour.
      visited.add(platform);
      open(platform);
    }

    for (const button of buttons) {
      button.addEventListener('click', () => {
        if (button.getAttribute('aria-expanded') === 'true') close();
        else open(button);
      });
    }
    document.addEventListener('pointerdown', event => {
      if (!event.target.closest('.about-folder')) close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' || event.code === 'Escape') close();
    });
    return { land, close };
  }
  const api = { createFolderMessages };
  if (typeof module !== 'undefined') module.exports = api;
  else root.AboutFolders = api;
})(typeof window === 'undefined' ? globalThis : window);
