/*
 * TEMPORARY nfoGuides-only READ-ONLY diagnostic (nfoguides branch / mars only, Oct 12, 2026).
 * Loaded by portal.html. Looks for mine-maintenance + reward data. NO WRITES.
 * Gate: uid 8HnXWZjRYQZrYPZi5NGdRsWRCvd2 only; once per tab session.
 */
(function () {
  // DISABLED Oct 12, 2026 after test (see notes: dailyActivities readable by userId).
  var NFO_MAINT_DIAG_ENABLED = false;
  if (!NFO_MAINT_DIAG_ENABLED) return;
  var NFO_UID = '8HnXWZjRYQZrYPZi5NGdRsWRCvd2';
  var TAG = '[nfo-maint-diag]';
  var MAINTISH = /maint|daily|activit|reward|repair|upkeep|condition|durab|lastUpdated|lastReset|streak|bonus|earn|claim|collect|harvest/i;
  if (!window.firebase || !firebase.auth) return;

  function ser(v, depth) {
    depth = depth || 0;
    try {
      if (v && typeof v.toDate === 'function') return { __ts: v.toDate().toISOString() };
      if (v && typeof v.path === 'string' && typeof v.id === 'string' && v.firestore) return { __ref: v.path };
      if (Array.isArray(v)) return depth > 3 ? '[array ' + v.length + ']' : v.slice(0, 10).map(function (x) { return ser(x, depth + 1); });
      if (v && typeof v === 'object') {
        if (depth > 3) return '{…}';
        var o = {}; Object.keys(v).forEach(function (k) { o[k] = ser(v[k], depth + 1); }); return o;
      }
    } catch (e) {}
    return v;
  }
  function j(x) { try { return JSON.stringify(ser(x), null, 1); } catch (e) { return String(x); } }
  function keyCounts(docs) {
    var c = {}; docs.forEach(function (d) { Object.keys(d.data() || {}).forEach(function (k) { c[k] = (c[k] || 0) + 1; }); }); return c;
  }
  function maintFields(data) {
    var o = {}; Object.keys(data || {}).forEach(function (k) { if (MAINTISH.test(k)) o[k] = data[k]; }); return o;
  }
  async function tryQuery(label, q) {
    try {
      var s = await q.get();
      if (!s.size) { console.log(TAG, label, '→ EMPTY (allowed, 0 docs)'); return; }
      console.log(TAG, label, '→ FOUND', s.size, 'docs; fields:', j(keyCounts(s.docs)));
      s.docs.slice(0, 3).forEach(function (d, i) { console.log(TAG, label, 'sample #' + (i + 1), d.id, j(d.data())); });
    } catch (e) {
      console.log(TAG, label, '→', (e && e.code) || 'error', (e && e.message) || '');
    }
  }

  async function run(user) {
    var db = firebase.firestore();
    var uid = user.uid;
    console.log(TAG, 'start (read-only)', { uid: uid });

    // users/{uid}
    try {
      var us = await db.collection('users').doc(uid).get();
      var ud = us.data() || {};
      console.log(TAG, 'users/{uid} field names:', Object.keys(ud).sort().join(', '));
      console.log(TAG, 'users/{uid} maintenance/reward-ish fields:', j(maintFields(ud)));
    } catch (e) { console.log(TAG, 'users/{uid} →', e.code, e.message); }

    // properties (owner) — all docs for field counts, first few full
    var props = [];
    try {
      var ps = await db.collection('properties').where('ownerId', '==', uid).limit(300).get();
      props = ps.docs;
      console.log(TAG, 'properties (ownerId==uid):', ps.size, 'docs; field counts:', j(keyCounts(ps.docs)));
      ps.docs.slice(0, 3).forEach(function (d, i) { console.log(TAG, 'properties sample #' + (i + 1), d.id, j(d.data())); });
      var mf = {}; ps.docs.forEach(function (d) { var m = maintFields(d.data()); Object.keys(m).forEach(function (k) { if (!(k in mf)) mf[k] = m[k]; }); });
      console.log(TAG, 'properties maintenance-ish fields (first value seen):', j(mf));
    } catch (e) { console.log(TAG, 'properties →', e.code, e.message); }

    // propertyDetails for a few (prefer recently maintained)
    var details = [];
    for (var i = 0; i < Math.min(props.length, 40); i++) {
      try { var ds = await db.collection('propertyDetails').doc(props[i].id).get(); if (ds.exists) details.push(ds); } catch (e) { console.log(TAG, 'propertyDetails/' + props[i].id, '→', e.code); break; }
    }
    if (details.length) {
      console.log(TAG, 'propertyDetails:', details.length, 'docs; field counts:', j(keyCounts(details)));
      details.sort(function (a, b) {
        function ms(d) { var v = (d.data() || {}).lastDailyReset || (d.data() || {}).lastUpdated; try { return v && v.toMillis ? v.toMillis() : Date.parse(v) || 0; } catch (e) { return 0; } }
        return ms(b) - ms(a);
      });
      details.slice(0, 3).forEach(function (d, k) { console.log(TAG, 'propertyDetails sample #' + (k + 1) + ' (most recent activity first)', d.id, j(d.data())); });
      var dmf = {}; details.forEach(function (d) { var m = maintFields(d.data()); Object.keys(m).forEach(function (k) { if (!(k in dmf)) dmf[k] = m[k]; }); });
      console.log(TAG, 'propertyDetails maintenance-ish fields (first value seen):', j(dmf));
    }

    // Candidate top-level collections
    var tops = ['maintenance', 'mineMaintenance', 'maintenanceLogs', 'maintenanceHistory', 'propertyMaintenance',
      'dailyActivities', 'dailyActivity', 'activities', 'activityLog', 'activityLogs', 'mineActivities',
      'transactions', 'tbTransactions', 'tbHistory', 'rewards', 'rewardHistory', 'rewardLogs', 'earnings',
      'notifications', 'inventoryLogs', 'resourceLogs'];
    var fields = ['userId', 'ownerId', 'uid'];
    for (var t = 0; t < tops.length; t++) {
      for (var f = 0; f < fields.length; f++) {
        await tryQuery(tops[t] + ' where ' + fields[f] + '==uid', db.collection(tops[t]).where(fields[f], '==', uid).limit(20));
      }
    }
    // users/{uid} subcollections
    var subs = ['maintenance', 'maintenanceHistory', 'maintenanceLogs', 'dailyActivities', 'activities', 'activityLog',
      'history', 'transactions', 'tbTransactions', 'rewards', 'rewardHistory', 'earnings', 'notifications', 'inventory', 'logs'];
    for (var s2 = 0; s2 < subs.length; s2++) {
      await tryQuery('users/{uid}/' + subs[s2], db.collection('users').doc(uid).collection(subs[s2]).limit(20));
    }
    // propertyDetails/{id} subcollections on the most recently active mine
    if (details.length) {
      var pid = details[0].id;
      var psubs = ['maintenance', 'maintenanceHistory', 'dailyActivities', 'activities', 'history', 'rewards', 'logs'];
      for (var s3 = 0; s3 < psubs.length; s3++) {
        await tryQuery('propertyDetails/' + pid + '/' + psubs[s3], db.collection('propertyDetails').doc(pid).collection(psubs[s3]).limit(20));
        await tryQuery('properties/' + pid + '/' + psubs[s3], db.collection('properties').doc(pid).collection(psubs[s3]).limit(20));
      }
    }
    console.log(TAG, 'done');
  }

  var started = false;
  firebase.auth().onAuthStateChanged(function (user) {
    if (started || !user || user.uid !== NFO_UID) return;
    try { if (sessionStorage.getItem('nfoMaintDiagRan') === '1') { console.log(TAG, 'already ran this tab session; open a new tab to re-run'); return; } sessionStorage.setItem('nfoMaintDiagRan', '1'); } catch (e) {}
    started = true;
    setTimeout(function () { run(user).catch(function (e) { console.error(TAG, 'crashed', e); }); }, 2000);
  });
})();
