/* Oct 15, 2026: shared Pioneer Pass check.
 * Real membership = users/{uid}.isPioneerMember === true.
 * Test override: on mars.baronstoolbox.com ONLY, the nicknames 'nfoGuides' and 'FoggyTick'
 * (case-sensitive exact, after trim and dropping a leading '@') are treated as members.
 * The nickname is the one the portal header shows: users.nickname || auth displayName || email local part.
 * terramine.app (and any other host) never gets the override. */
(function () {
  var HOST = 'mars.baronstoolbox.com';
  var TESTERS = ['nfoGuides', 'FoggyTick'];
  function nickOf(ud, user) {
    var n = (ud && ud.nickname) || (user && user.displayName) || (user && user.email && String(user.email).split('@')[0]) || '';
    return String(n).trim().replace(/^@+/, '');
  }
  function isTester(ud, user) {
    return location.hostname === HOST && TESTERS.indexOf(nickOf(ud, user)) !== -1;
  }
  function isMember(ud, user) {
    if (!!ud && ud.isPioneerMember === true) return true;
    if (isTester(ud, user)) { try { console.info('[pioneer] mars test override: Pioneer Pass forced on for ' + nickOf(ud, user)); } catch (e) {} return true; }
    return false;
  }
  window.TMPioneer = { isMember: isMember, isTester: isTester, nickOf: nickOf, HOST: HOST, TESTERS: TESTERS.slice() };
})();
