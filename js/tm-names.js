/* Oct 15, 2026: one shared player-name resolver for profile-like docs
 * (publicProfiles/{uid}, users/{uid}, check-in/property denormalized fields).
 * Order: nickname variants -> displayName / username -> first + last -> '' (callers show 'Unknown').
 * TMName.resolve(obj, tag?) logs the doc's KEY NAMES only (never values) when nothing resolves. */
(function () {
  var NICK = ['nickname', 'nickName', 'Nickname', 'userNickname', 'user_nickname', 'nick', 'gamerTag', 'handle'];
  var DISP = ['displayName', 'display_name', 'username', 'userName', 'name'];
  function s(v) { return typeof v === 'string' ? v.trim().replace(/^@+/, '') : ''; }
  function pick(o, keys) { for (var i = 0; i < keys.length; i++) { var v = s(o[keys[i]]); if (v) return v; } return ''; }
  var logged = {};
  function resolve(o, tag) {
    if (!o || typeof o !== 'object') return '';
    var n = pick(o, NICK) || pick(o, DISP);
    if (!n) {
      var f = s(o.firstName || o.first_name || o.givenName), l = s(o.lastName || o.last_name || o.familyName);
      n = (f + ' ' + l).trim();
    }
    if (!n) {
      var k = (tag || '') + '|' + Object.keys(o).sort().join(',');
      if (!logged[k]) { logged[k] = 1; try { console.debug('[names] no name resolved' + (tag ? ' (' + tag + ')' : '') + '; keys:', Object.keys(o).sort()); } catch (e) {} }
    }
    return n;
  }
  window.TMName = { resolve: resolve };
})();
