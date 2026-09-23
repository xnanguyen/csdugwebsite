(function (root) {
  function setupNavigation(nav, document, mobile) {
    const button = nav.querySelector('.nav-toggle');
    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    }
    button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', event => {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        button.focus();
      }
    });
    document.addEventListener('pointerdown', event => {
      if (!nav.contains(event.target)) setOpen(false);
    });
    mobile.addEventListener('change', () => setOpen(false));
  }
  if (typeof module !== 'undefined') module.exports = { setupNavigation };
  if (root.document) setupNavigation(root.document.querySelector('.site-nav'), root.document, root.matchMedia('(max-width: 640px)'));
})(typeof window === 'undefined' ? globalThis : window);
