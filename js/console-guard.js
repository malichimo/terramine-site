/*
 * Console guard — load first in <head>, before any other script.
 * Live site (any host other than mars.baronstoolbox.com / localhost): console.log, debug, info,
 * table, warn, group, groupCollapsed, groupEnd, dir, dirxml, trace, time*, count* become no-ops.
 * console.error is never touched, so real errors still show.
 * Troubleshooting on the live site: add ?debug=1 to the URL (that page load only), or run
 * localStorage.setItem('tmDebug','1') once (sticks until localStorage.removeItem('tmDebug')).
 */
(function () {
  try {
    var h = String(location.hostname || '').toLowerCase();
    if (h === 'mars.baronstoolbox.com' || h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '') return;
    if (/[?&]debug=1(&|#|$)/.test(location.search || '')) return;
    try { if (localStorage.getItem('tmDebug') === '1') return; } catch (e) {}
    var c = window.console;
    if (!c) return;
    var noop = function () {};
    ['log', 'debug', 'info', 'table', 'warn', 'group', 'groupCollapsed', 'groupEnd', 'dir', 'dirxml',
     'trace', 'time', 'timeEnd', 'timeLog', 'count', 'countReset'].forEach(function (k) {
      try { c[k] = noop; } catch (e) {}
    });
  } catch (e) {}
})();
