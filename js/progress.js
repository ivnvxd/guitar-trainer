/* Progress: per-item results, the choice of the next item, and the daily practice log.
   An item climbs a box when you answer it right and fast, and drops to box 0 when you miss it.
   Low boxes come up more often. Missed items also come back 3 to 5 questions later. */
(function (root) {
  'use strict';
  const GT = root.GT;
  const { store } = GT;
  const WEIGHT = [6, 4, 2.5, 1.5, 1, 0.7];
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  function stats(drillId) { return store.get('stats.' + drillId, {}); }
  function saveStats(drillId, data) { store.set('stats.' + drillId, data); }

  function record(drillId, item, correct, ms, fastMs) {
    const data = stats(drillId);
    const s = data[item] || { n: 0, ok: 0, box: 0, times: [], recent: [] };
    s.n++; if (correct) s.ok++;
    s.recent = (s.recent || []).concat(correct ? 1 : 0).slice(-10);
    if (correct) s.times = (s.times || []).concat(Math.round(ms)).slice(-10);
    s.box = !correct ? 0 : ms <= fastMs ? Math.min(5, s.box + 1) : Math.max(1, s.box);
    s.last = Date.now();
    data[item] = s;
    saveStats(drillId, data);
    logPractice(ms);
    store.set('lastDrill', drillId.split(':')[0]);
    return s;
  }
  function logPractice(ms) {
    const days = store.get('days', {});
    const d = days[today()] || { ms: 0, q: 0 };
    d.ms += Math.min(ms, 30000); d.q++;
    days[today()] = d;
    store.set('days', days);
  }
  // Weighted random choice. "avoid" lowers the chance of asking the same item twice in a row.
  function choose(drillId, pool, avoid) {
    if (!pool.length) return null;
    const data = stats(drillId);
    const weights = pool.map(item => {
      const s = data[item];
      let w = s ? WEIGHT[Math.min(5, s.box)] : 4;
      if (item === avoid) w *= pool.length > 2 ? 0.05 : 0.3;
      return w;
    });
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }
  const median = list => { if (!list || !list.length) return null; const a = [...list].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
  function summary(drillId, pool) {
    const data = stats(drillId);
    const items = pool || Object.keys(data);
    let n = 0, ok = 0, mastered = 0, seen = 0;
    const times = [];
    for (const item of items) {
      const s = data[item]; if (!s) continue;
      seen++; n += s.n; ok += s.ok;
      if (s.box >= 3) mastered++;
      times.push(...(s.times || []));
    }
    return { n, ok, accuracy: n ? ok / n : null, mastered, seen, total: items.length, median: median(times) };
  }
  // Recent accuracy of a set of items: used to unlock the next stage.
  function ready(drillId, items, minEach = 6, threshold = 0.85) {
    const data = stats(drillId);
    let ok = 0, n = 0;
    for (const item of items) {
      const s = data[item];
      if (!s || (s.recent || []).length < Math.min(minEach, 6)) return false;
      ok += s.recent.reduce((a, b) => a + b, 0); n += s.recent.length;
    }
    return n > 0 && ok / n >= threshold;
  }
  function day() { return store.get('days', {})[today()] || { ms: 0, q: 0 }; }
  function streak() {
    const days = store.get('days', {});
    let count = 0;
    const d = new Date();
    if (!days[today()]) d.setDate(d.getDate() - 1);
    for (;;) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!days[key]) break;
      count++; d.setDate(d.getDate() - 1);
    }
    return count;
  }

  GT.progress = { stats, record, choose, summary, ready, median, day, streak, today };
})(window);
