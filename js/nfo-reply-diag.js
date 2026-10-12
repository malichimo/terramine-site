/*
 * TEMPORARY nfoGuides-only diagnostic (nfoguides branch / mars only, Oct 12, 2026).
 * Loaded by visitors.html. On page load for uid 8HnXWZjRYQZrYPZi5NGdRsWRCvd2 only:
 *  1) reads checkIns where propertyOwnerId == uid, logs every field name seen and
 *     the full reply-related fields of docs that have a reply;
 *  2) harmless write test: on ONE of those docs, update() the reply field with its
 *     identical current value (no content change), log success / error code, then
 *     re-read and confirm the value is unchanged.
 * Runs once per browser tab session. Remove after the test.
 */
(function () {
  // DISABLED Oct 12, 2026 after test (fields: ownerReply string, ownerReplyAt Timestamp; owner update ALLOWED).
  var NFO_REPLY_DIAG_ENABLED = false;
  if (!NFO_REPLY_DIAG_ENABLED) return;
  var NFO_UID = '8HnXWZjRYQZrYPZi5NGdRsWRCvd2';
  var TAG = '[nfo-reply-diag]';
  var REPLYISH = /reply|response|answer|replied/i;
  if (!window.firebase || !firebase.auth) return;

  function ser(v) {
    try {
      if (v && typeof v.toDate === 'function') return { __timestamp: v.toDate().toISOString() };
      if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = ser(v[k]); }); return o; }
    } catch (e) {}
    return v;
  }
  function same(a, b) { return JSON.stringify(ser(a)) === JSON.stringify(ser(b)); }

  async function run(user) {
    var db = firebase.firestore();
    console.log(TAG, 'start', { uid: user.uid, email: user.email || null });
    var snap;
    try {
      snap = await db.collection('checkIns').where('propertyOwnerId', '==', user.uid)
        .orderBy('timestamp', 'desc').limit(500).get();
    } catch (e) { console.error(TAG, 'query FAILED', e.code, e.message); return; }
    var allKeys = {}, withReply = [];
    snap.docs.forEach(function (d) {
      var data = d.data() || {};
      Object.keys(data).forEach(function (k) { allKeys[k] = (allKeys[k] || 0) + 1; });
      var rk = Object.keys(data).filter(function (k) { return REPLYISH.test(k); });
      if (rk.length) withReply.push({ id: d.id, ref: d.ref, data: data, replyKeys: rk });
    });
    console.log(TAG, 'docs scanned:', snap.size, '| docs with reply-ish keys:', withReply.length);
    console.log(TAG, 'ALL FIELD NAMES (count of docs):', JSON.stringify(allKeys, null, 1));
    withReply.slice(0, 5).forEach(function (r, i) {
      var sub = {};
      r.replyKeys.forEach(function (k) { sub[k] = ser(r.data[k]); });
      console.log(TAG, 'reply doc #' + (i + 1), r.id, 'reply fields:', JSON.stringify(sub, null, 1),
        '\nFULL DOC:', JSON.stringify(ser(r.data), null, 1));
    });
    if (!withReply.length) { console.warn(TAG, 'No checkIn with a reply found — write test skipped.'); return; }

    // Harmless write test on the newest reply doc: write the identical current value back.
    var t = withReply[0];
    var key = t.replyKeys.filter(function (k) { return typeof t.data[k] === 'string'; })[0] || t.replyKeys[0];
    var cur = t.data[key];
    console.log(TAG, 'WRITE TEST (same value) on checkIns/' + t.id + ' field "' + key + '"', ser(cur));
    try {
      var payload = {}; payload[key] = cur;
      await t.ref.update(payload);
      console.log(TAG, 'WRITE ALLOWED ✅ (rules permitted owner update of "' + key + '")');
    } catch (e) {
      console.error(TAG, 'WRITE DENIED ❌', { code: e.code, message: e.message });
    }
    try {
      var after = await t.ref.get({ source: 'server' });
      var v2 = (after.data() || {})[key];
      console.log(TAG, 'post-check: value unchanged =', same(cur, v2), ser(v2));
    } catch (e) { console.error(TAG, 'post-check read FAILED', e.code, e.message); }
    console.log(TAG, 'done');
  }

  var started = false;
  firebase.auth().onAuthStateChanged(function (user) {
    if (started || !user || user.uid !== NFO_UID) return;
    try { if (sessionStorage.getItem('nfoReplyDiagRan') === '1') { console.log(TAG, 'already ran this tab session; open a new tab to re-run'); return; } sessionStorage.setItem('nfoReplyDiagRan', '1'); } catch (e) {}
    started = true;
    setTimeout(function () { run(user); }, 1500);
  });
})();
