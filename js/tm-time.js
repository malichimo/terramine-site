/* TerraMine shared time-unit constants (Oct 6, 2026).
 *
 * A month is 365 / 12 = 30.41666… days (NOT 30). Use these for every
 * rate → period conversion (per-second / per-day → per-month / per-year).
 * Do NOT use for literal 30-day windows (e.g. "Mini Games — Last 30 Days").
 */
(function (w) {
  var SECONDS_PER_MINUTE = 60;
  var SECONDS_PER_HOUR = 60 * 60;
  var SECONDS_PER_DAY = 60 * 60 * 24;          // 86,400
  var DAYS_PER_WEEK = 7;
  var DAYS_PER_YEAR = 365;
  var DAYS_PER_MONTH = DAYS_PER_YEAR / 12;     // 30.416666666666668 (full precision)
  w.TMTime = Object.freeze({
    SECONDS_PER_MINUTE: SECONDS_PER_MINUTE,
    SECONDS_PER_HOUR: SECONDS_PER_HOUR,
    SECONDS_PER_DAY: SECONDS_PER_DAY,
    DAYS_PER_WEEK: DAYS_PER_WEEK,
    DAYS_PER_YEAR: DAYS_PER_YEAR,
    DAYS_PER_MONTH: DAYS_PER_MONTH,
    HOURS_PER_MONTH: DAYS_PER_MONTH * 24,                  // 730
    SECONDS_PER_WEEK: SECONDS_PER_DAY * DAYS_PER_WEEK,     // 604,800
    SECONDS_PER_MONTH: SECONDS_PER_DAY * DAYS_PER_MONTH,   // 2,628,000
    SECONDS_PER_YEAR: SECONDS_PER_DAY * DAYS_PER_YEAR      // 31,536,000
  });
})(window);
