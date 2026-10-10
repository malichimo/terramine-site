/*
 * nfoGuides-only diagnostic (nfoguides branch / mars, Oct 10, 2026):
 * clicking the nav profile (avatar + nickname → /account.html) adds +100 TB
 * to users/{uid}.tbBalance via FieldValue.increment(100), logs before/after,
 * updates #sb-tb, then continues to the link's normal navigation.
 * Hard-gated to uid 8HnXWZjRYQZrYPZi5NGdRsWRCvd2 (same gate as the removed
 * Oct 5 TB-pill diag). Everyone else: no handler side effects at all.
 * Load after the page's firebase.initializeApp().
 */
(function () {
  var NFO_UID = '8HnXWZjRYQZrYPZi5NGdRsWRCvd2';
  var AMOUNT = 100;
  var TAG = '[nfo-tb-diag]';
  var busy = false;

  function fmt(n) {
    var x = Number(n);
    return isFinite(x) ? Math.round(x).toLocaleString('en-US') : '0';
  }
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (_, rej) {
      setTimeout(function () { rej(new Error('timeout after ' + ms + 'ms')); }, ms);
    })]);
  }

  async function runIncrement() {
    var user = firebase.auth().currentUser;
    var ref = firebase.firestore().collection('users').doc(user.uid);
    var path = 'users/' + user.uid + '.tbBalance';
    var before = null, after = null;
    try {
      var s0 = await ref.get();
      before = s0.exists ? (s0.data().tbBalance != null ? s0.data().tbBalance : null) : null;
      console.log(TAG, 'before', { path: path, tbBalance: before });
      await ref.update({ tbBalance: firebase.firestore.FieldValue.increment(AMOUNT) });
      var s1 = await ref.get({ source: 'server' });
      after = s1.exists ? s1.data().tbBalance : null;
      var delta = (typeof before === 'number' && typeof after === 'number') ? after - before : null;
      console.log(TAG, 'OK +' + AMOUNT, { path: path, before: before, after: after, delta: delta });
      var el = document.getElementById('sb-tb');
      if (el && after != null) el.textContent = fmt(after);
      return true;
    } catch (err) {
      console.error(TAG, 'FAILED', { path: path, before: before, code: err && err.code, message: err && err.message, err: err });
      return false;
    }
  }

  function bind() {
    var link = document.querySelector('.nav-account-link');
    if (!link || link.dataset.nfoTbDiagBound === '1') return;
    link.dataset.nfoTbDiagBound = '1';
    link.addEventListener('click', function (e) {
      var user = (window.firebase && firebase.auth) ? firebase.auth().currentUser : null;
      if (!user || user.uid !== NFO_UID) return;            // not nfoGuides → untouched
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new-tab clicks untouched
      e.preventDefault();
      if (busy) return;
      busy = true;
      var href = link.getAttribute('href') || '/account.html';
      console.log(TAG, 'click → +' + AMOUNT + ' TB for', { uid: user.uid, email: user.email || null, displayName: user.displayName || null });
      withTimeout(runIncrement(), 6000).catch(function (err) {
        console.error(TAG, 'FAILED', err);
      }).then(function () {
        busy = false;
        // Continue the normal profile navigation (short pause so logs/balance are visible)
        setTimeout(function () { window.location.href = href; }, 600);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
