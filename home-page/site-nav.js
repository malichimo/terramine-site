(function () {
  function setupMobileNav() {
    var nav = document.querySelector('nav.site-nav') || document.querySelector('nav');
    var toggle = document.getElementById('nav-menu-toggle');
    var links = document.getElementById('nav-links-menu');
    if (!nav || !toggle || !links) return;

    var closeMenu = function () {
      nav.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
    };
    var openMenu = function () {
      nav.classList.add('nav-open');
      toggle.setAttribute('aria-expanded', 'true');
    };

    toggle.addEventListener('click', function () {
      if (nav.classList.contains('nav-open')) closeMenu();
      else openMenu();
    });
    links.addEventListener('click', function (event) {
      if (event.target.closest('a')) closeMenu();
    });
    document.addEventListener('click', function (event) {
      if (!nav.contains(event.target)) closeMenu();
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1024) closeMenu();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMobileNav);
  } else {
    setupMobileNav();
  }
})();
