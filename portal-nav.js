(function () {
  function setupPortalNav() {
    var nav = document.querySelector('nav.top-nav');
    var toggle = document.getElementById('portal-nav-toggle');
    var links = document.getElementById('portal-nav-links');
    if (!nav || !toggle || !links) return;

    var closeMenu = function () {
      nav.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    };
    var openMenu = function () {
      nav.classList.add('nav-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
    };

    toggle.addEventListener('click', function (event) {
      event.stopPropagation();
      if (nav.classList.contains('nav-open')) closeMenu();
      else openMenu();
    });
    links.addEventListener('click', function (event) {
      if (event.target.closest('a')) closeMenu();
    });
    document.addEventListener('click', function (event) {
      if (!nav.contains(event.target)) closeMenu();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMenu();
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1300) closeMenu();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPortalNav);
  } else {
    setupPortalNav();
  }
})();
