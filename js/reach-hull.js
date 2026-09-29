/*
 * TerraMine "Reach" outline — concave hull (chi-shape) around every mine.
 * Sep 29, 2026.
 *
 * Algorithm: chi-shape (Duckham, Kulik, Worboys & Galton 2008, "Efficient
 * generation of simple polygons for characterizing the shape of a set of
 * points in the plane"):
 *   1. Project lat/lng to local planar metres (equirectangular about the
 *      mean latitude — plenty accurate for an account-sized area).
 *   2. Delaunay-triangulate every unique parcel corner (vendored Delaunator,
 *      js/vendor/delaunator-5.1.0.min.js, ISC).
 *   3. Repeatedly remove the boundary triangle with the LONGEST boundary edge
 *      while that edge is longer than the threshold L, but only if the
 *      triangle's third vertex is not already on the boundary. That rule
 *      keeps the shape a single simple polygon (no holes, no pinch points)
 *      and every input point stays inside or on the outline.
 *   4. Walk the remaining boundary edges into one ring.
 *
 * Threshold (scales with the account's spread, so small and large accounts
 * both get sensible shapes):
 *   L = max(LAMBDA * bboxDiagonal,  K_SPACING * sqrt(convexHullArea / siteCount))
 *   (siteCount = number of mines; sqrt(area/n) = average mine spacing if the
 *   mines were spread evenly over the hull). A gap has to be wider than both
 *   ~LAMBDA of the whole spread AND ~K_SPACING typical spacings to get cut.
 *   `tightness` (default 1) divides L: >1 = tighter, <1 = looser.
 *
 * Accounts with < 40 mines use a larger LAMBDA (ramping to 0.6 at 8 mines)
 * so a handful of mines isn't carved into a random star.
 *
 * Any failure (fewer than 4 unique points / 8 mines, collinear input,
 * Delaunator missing, invalid ring) falls back to the convex hull.
 *
 * Exposes window.TerraMineReachHull (and module.exports for Node tests).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(function () { try { return require('./vendor/delaunator-5.1.0.min.js'); } catch (e) { return null; } });
  } else {
    root.TerraMineReachHull = factory(function () { return root.Delaunator || null; });
  }
}(typeof self !== 'undefined' ? self : this, function (getDelaunator) {
  'use strict';

  var LAMBDA = 0.035;     // fraction of bbox diagonal
  var K_SPACING = 2.2;    // multiples of average mine spacing
  var SMALL_MIN = 8;      // fewer mines than this -> convex hull
  var SMALL_RAMP = 40;    // below this many mines, LAMBDA ramps up toward LAMBDA_SMALL
  var LAMBDA_SMALL = 0.6;
  var Q = 1e7;            // ~1.1 cm dedupe precision
  var M_PER_DEG_LAT = 110574;
  var M_PER_DEG_LNG = 111320;
  var MAX_SIMPLE_CHECK = 6000; // O(m^2) self-intersection check up to this many vertices

  function quant(v) { return Math.round(Number(v) * Q) / Q; }

  function uniquePoints(points) {
    var out = [], seen = new Set();
    for (var i = 0; i < (points || []).length; i++) {
      var p = points[i];
      if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
      var la = quant(p.lat), ln = quant(p.lng), k = la + ',' + ln;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ lat: la, lng: ln });
    }
    return out;
  }

  /** Andrew's monotone chain on {lat,lng}. Null if < 3 non-collinear points. */
  function convexHull(points) {
    var uniq = uniquePoints(points);
    if (uniq.length < 3) return null;
    uniq.sort(function (a, b) { return a.lng === b.lng ? a.lat - b.lat : a.lng - b.lng; });
    function cross(o, a, b) { return (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng); }
    var lower = [], upper = [], i;
    for (i = 0; i < uniq.length; i++) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], uniq[i]) <= 0) lower.pop();
      lower.push(uniq[i]);
    }
    for (i = uniq.length - 1; i >= 0; i--) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], uniq[i]) <= 0) upper.pop();
      upper.push(uniq[i]);
    }
    lower.pop(); upper.pop();
    var hull = lower.concat(upper);
    return hull.length >= 3 ? hull : null;
  }

  // ── planar helpers (arrays of [x, y]) ──
  function project(pts) {
    var lat0 = 0;
    for (var i = 0; i < pts.length; i++) lat0 += pts[i].lat;
    lat0 /= pts.length;
    var kx = M_PER_DEG_LNG * Math.cos(lat0 * Math.PI / 180), ky = M_PER_DEG_LAT;
    var flat = new Float64Array(pts.length * 2);
    for (i = 0; i < pts.length; i++) { flat[2 * i] = pts[i].lng * kx; flat[2 * i + 1] = pts[i].lat * ky; }
    return flat;
  }
  function ringArea(ring) { // ring: [[x,y],...] -> absolute area
    var a = 0;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
    return Math.abs(a / 2);
  }
  function orient(ax, ay, bx, by, cx, cy) { var v = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); return v > 0 ? 1 : (v < 0 ? -1 : 0); }
  function onSeg(ax, ay, bx, by, px, py) { return Math.min(ax, bx) <= px && px <= Math.max(ax, bx) && Math.min(ay, by) <= py && py <= Math.max(ay, by); }
  function segsIntersect(a, b, c, d) {
    var o1 = orient(a[0], a[1], b[0], b[1], c[0], c[1]), o2 = orient(a[0], a[1], b[0], b[1], d[0], d[1]);
    var o3 = orient(c[0], c[1], d[0], d[1], a[0], a[1]), o4 = orient(c[0], c[1], d[0], d[1], b[0], b[1]);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSeg(a[0], a[1], b[0], b[1], c[0], c[1])) return true;
    if (o2 === 0 && onSeg(a[0], a[1], b[0], b[1], d[0], d[1])) return true;
    if (o3 === 0 && onSeg(c[0], c[1], d[0], d[1], a[0], a[1])) return true;
    if (o4 === 0 && onSeg(c[0], c[1], d[0], d[1], b[0], b[1])) return true;
    return false;
  }
  /** True if ring (>=3 distinct vertices) has no self-intersections (non-adjacent edges never touch). */
  function isSimpleRing(ring) {
    var m = ring.length;
    if (m < 3) return false;
    var seen = new Set();
    for (var i = 0; i < m; i++) { var k = ring[i][0] + ',' + ring[i][1]; if (seen.has(k)) return false; seen.add(k); }
    if (m > MAX_SIMPLE_CHECK) return true; // chi-shape guarantees simplicity; skip O(m^2) on huge rings
    var bx0 = new Float64Array(m), bx1 = new Float64Array(m), by0 = new Float64Array(m), by1 = new Float64Array(m);
    for (i = 0; i < m; i++) {
      var a = ring[i], b = ring[(i + 1) % m];
      bx0[i] = Math.min(a[0], b[0]); bx1[i] = Math.max(a[0], b[0]); by0[i] = Math.min(a[1], b[1]); by1[i] = Math.max(a[1], b[1]);
    }
    for (i = 0; i < m; i++) {
      for (var j = i + 1; j < m; j++) {
        if (j === i + 1 || (i === 0 && j === m - 1)) continue; // adjacent share a vertex
        if (bx1[i] < bx0[j] || bx1[j] < bx0[i] || by1[i] < by0[j] || by1[j] < by0[i]) continue;
        if (segsIntersect(ring[i], ring[(i + 1) % m], ring[j], ring[(j + 1) % m])) return false;
      }
    }
    return true;
  }
  /** Point in polygon, counting points on the boundary (within eps metres) as inside. */
  function pointInOrOn(ring, x, y, eps) {
    var inside = false, m = ring.length;
    for (var i = 0, j = m - 1; i < m; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      // distance to segment
      var dx = xi - xj, dy = yi - yj, l2 = dx * dx + dy * dy;
      var t = l2 ? Math.max(0, Math.min(1, ((x - xj) * dx + (y - yj) * dy) / l2)) : 0;
      var ex = xj + t * dx - x, ey = yj + t * dy - y;
      if (ex * ex + ey * ey <= eps * eps) return true;
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // ── tiny binary max-heap of [len, halfedge] ──
  function Heap() { this.a = []; }
  Heap.prototype.push = function (len, e) {
    var a = this.a; a.push([len, e]);
    var i = a.length - 1;
    while (i > 0) { var p = (i - 1) >> 1; if (a[p][0] >= a[i][0]) break; var t = a[p]; a[p] = a[i]; a[i] = t; i = p; }
  };
  Heap.prototype.pop = function () {
    var a = this.a; if (!a.length) return null;
    var top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; var i = 0, n = a.length;
      for (;;) {
        var l = 2 * i + 1, r = l + 1, m = i;
        if (l < n && a[l][0] > a[m][0]) m = l;
        if (r < n && a[r][0] > a[m][0]) m = r;
        if (m === i) break;
        var t = a[m]; a[m] = a[i]; a[i] = t; i = m;
      }
    }
    return top;
  };

  /**
   * compute(points, opts) -> { path:[{lat,lng}], method:'concave'|'convex'|'none', ... }
   *   points: [{lat,lng}] (all parcel corners)
   *   opts.siteCount: number of mines (defaults to points/4)
   *   opts.tightness: 1 = default; >1 tighter, <1 looser; <=0 = convex hull
   */
  function compute(points, opts) {
    opts = opts || {};
    var t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    var uniq = uniquePoints(points);
    // siteCount = number of DISTINCT mines (caller dedupes by parcel); default ~corners/4
    var siteCount = Math.max(1, Math.round(opts.siteCount || uniq.length / 4));
    var tightness = opts.tightness == null ? 1 : Number(opts.tightness);
    function convex(reason) {
      var h = convexHull(uniq);
      return { path: h, method: h ? 'convex' : 'none', reason: reason, points: uniq.length };
    }
    if (uniq.length < 4 || siteCount < SMALL_MIN) return convex('few-points');
    if (!(tightness > 0)) return convex('tightness-off');
    var Delaunator = getDelaunator();
    if (!Delaunator) return convex('no-delaunator');
    var n = uniq.length, xy = project(uniq), d;
    try { d = new Delaunator(xy); } catch (e) { return convex('delaunay-error'); }
    var tri = d.triangles, half = d.halfedges, nt = tri.length / 3;
    if (!nt) return convex('collinear');

    // spread metrics
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, i;
    for (i = 0; i < n; i++) {
      var X = xy[2 * i], Y = xy[2 * i + 1];
      if (X < minX) minX = X; if (X > maxX) maxX = X; if (Y < minY) minY = Y; if (Y > maxY) maxY = Y;
    }
    var diag = Math.hypot(maxX - minX, maxY - minY);
    var hullRing = []; for (i = 0; i < d.hull.length; i++) hullRing.push([xy[2 * d.hull[i]], xy[2 * d.hull[i] + 1]]);
    var hullArea = ringArea(hullRing);
    var spacing = Math.sqrt(hullArea / siteCount);
    // small accounts: carving a handful of mines just looks random, so only
    // cut really big gaps (lambda ramps LAMBDA_SMALL -> LAMBDA over SMALL_MIN..SMALL_RAMP)
    var ramp = Math.max(0, Math.min(1, (SMALL_RAMP - siteCount) / (SMALL_RAMP - SMALL_MIN)));
    var lambda = LAMBDA + (LAMBDA_SMALL - LAMBDA) * ramp;
    var L = Math.max(lambda * diag, K_SPACING * spacing) / tightness;

    function next(e) { return (e % 3 === 2) ? e - 2 : e + 1; }
    function elen(e) {
      var a = tri[e], b = tri[next(e)];
      return Math.hypot(xy[2 * a] - xy[2 * b], xy[2 * a + 1] - xy[2 * b + 1]);
    }
    var removed = new Uint8Array(nt);
    var boundaryEdge = new Uint8Array(tri.length); // halfedge e is on the current boundary
    var onBoundary = new Uint8Array(n);
    var heap = new Heap();
    for (var e = 0; e < tri.length; e++) {
      if (half[e] === -1) { boundaryEdge[e] = 1; onBoundary[tri[e]] = 1; heap.push(elen(e), e); }
    }
    var removedCount = 0;
    for (;;) {
      var top = heap.pop();
      if (!top || top[0] <= L) break;
      e = top[1];
      if (!boundaryEdge[e]) continue;
      var t = (e / 3) | 0;
      if (removed[t]) continue;
      var e1 = next(e), e2 = next(e1), v = tri[e2]; // v = vertex opposite edge e
      if (onBoundary[v]) continue;                    // regularity: would pinch / split
      if (nt - removedCount <= 1) break;
      // remove triangle t: its other two edges' twins become boundary
      removed[t] = 1; removedCount++;
      boundaryEdge[e] = 0;
      var o1 = half[e1], o2 = half[e2];
      if (o1 === -1 || o2 === -1) { return convex('topology'); } // can't happen when v is interior
      boundaryEdge[o1] = 1; boundaryEdge[o2] = 1;
      onBoundary[v] = 1;
      heap.push(elen(o1), o1); heap.push(elen(o2), o2);
    }

    // walk the boundary: each boundary vertex has exactly one outgoing boundary halfedge
    var outEdge = new Int32Array(n).fill(-1), bCount = 0, start = -1;
    for (e = 0; e < tri.length; e++) {
      if (!boundaryEdge[e] || removed[(e / 3) | 0]) continue;
      var a = tri[e];
      if (outEdge[a] !== -1) return convex('non-manifold');
      outEdge[a] = e; bCount++; if (start < 0) start = a;
    }
    var ringIdx = [], cur = start, guard = 0;
    do {
      ringIdx.push(cur);
      var oe = outEdge[cur];
      if (oe < 0) return convex('open-ring');
      cur = tri[next(oe)];
      if (++guard > bCount + 1) return convex('ring-loop');
    } while (cur !== start);
    if (ringIdx.length !== bCount || ringIdx.length < 3) return convex('multi-ring');

    // containment proof: every vertex is used by at least one kept triangle
    var used = new Uint8Array(n);
    for (t = 0; t < nt; t++) if (!removed[t]) { used[tri[3 * t]] = 1; used[tri[3 * t + 1]] = 1; used[tri[3 * t + 2]] = 1; }
    for (i = 0; i < n; i++) if (!used[i]) return convex('dropped-point');

    var ring = ringIdx.map(function (k) { return [xy[2 * k], xy[2 * k + 1]]; });
    if (!isSimpleRing(ring)) return convex('self-intersection');
    var area = ringArea(ring);
    var path = ringIdx.map(function (k) { return { lat: uniq[k].lat, lng: uniq[k].lng }; });
    var t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    return {
      path: path, method: 'concave', points: n, vertices: path.length,
      threshold: L, diag: diag, spacing: spacing, siteCount: siteCount,
      area: area, hullArea: hullArea, ratio: hullArea ? area / hullArea : 1,
      removedTriangles: removedCount, triangles: nt, ms: Math.round((t1 - t0) * 10) / 10
    };
  }

  /** Test helper: projects path + points together, checks simple + every point inside/on. */
  function validate(path, points) {
    var all = uniquePoints((path || []).concat(points || []));
    if (!path || path.length < 3) return { ok: false, why: 'short' };
    var lat0 = 0; for (var i = 0; i < all.length; i++) lat0 += all[i].lat; lat0 /= all.length;
    var kx = M_PER_DEG_LNG * Math.cos(lat0 * Math.PI / 180);
    var P = function (p) { return [quant(p.lng) * kx, quant(p.lat) * M_PER_DEG_LAT]; };
    var ring = path.map(P);
    var simple = isSimpleRing(ring);
    var outside = 0, pts = uniquePoints(points);
    for (i = 0; i < pts.length; i++) { var q = P(pts[i]); if (!pointInOrOn(ring, q[0], q[1], 0.01)) outside++; }
    return { ok: simple && outside === 0, simple: simple, outside: outside, area: ringArea(ring), vertices: ring.length };
  }

  return { compute: compute, convexHull: convexHull, validate: validate, LAMBDA: LAMBDA, K_SPACING: K_SPACING };
}));
