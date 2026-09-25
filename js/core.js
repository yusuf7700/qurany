/* =========================================================
   QuranY — Core (shared logic)
   Web appda ham, kelajakdagi Telegram bot backendida ham
   ishlatiladigan sof (pure) funksiyalar. DOM bilan ishlamaydi,
   faqat "data" obyekti (appData shakli) bilan ishlaydi — shuning
   uchun ikkala tomonda ham bir xil natija kafolatlanadi.
   ========================================================= */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  else root.QuranYCore = mod;
})(typeof self !== "undefined" ? self : this, function () {

  const DEFAULT_FREEZES_PER_MONTH = 2;
  const WEEKDAY_LABELS = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"]; // getDay(): 0=Yakshanba
  const MONTH_NAMES = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentyabr","Oktyabr","Noyabr","Dekabr"];

  /* ---------- Sana yordamchilari ---------- */
  function pad(n) { return String(n).padStart(2, "0"); }
  function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function todayKey() { return dateKey(new Date()); }
  function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
  function dayOfYear(d) { const start = new Date(d.getFullYear(), 0, 0); return Math.floor((d - start) / 86400000); }

  /* ---------- Ma'lumot shakli ---------- */
  function defaultData(name) {
    return {
      name: name || "Do'stim",
      goals: { pages: 3, verses: 5, memoUnit: "oyat", memoDays: [0, 1, 2, 3, 4, 5, 6] },
      logs: {},
      frozenDays: [],
      lastCelebratedStreak: 0,
      settings: { theme: "light", script: "lotin", freezesPerMonth: DEFAULT_FREEZES_PER_MONTH },
      onboarded: false
    };
  }

  function ensureDataShape(d) {
    d.goals = d.goals || {};
    if (d.goals.pages == null) d.goals.pages = 3;
    if (d.goals.verses == null) d.goals.verses = 5;
    if (!d.goals.memoUnit) d.goals.memoUnit = "oyat";
    if (!d.goals.memoDays || !d.goals.memoDays.length) d.goals.memoDays = [0, 1, 2, 3, 4, 5, 6];
    if (d.onboarded == null) d.onboarded = false;
    if (!d.frozenDays) d.frozenDays = [];
    if (d.lastCelebratedStreak == null) d.lastCelebratedStreak = 0;
    d.settings = d.settings || {};
    if (!d.settings.theme) d.settings.theme = "light";
    if (!d.settings.script) d.settings.script = "lotin";
    if (d.settings.freezesPerMonth == null) d.settings.freezesPerMonth = DEFAULT_FREEZES_PER_MONTH;
    d.logs = d.logs || {};
    return d;
  }

  function mergeData(local, remote) {
    if (!remote) return local;
    const merged = Object.assign({}, remote);
    merged.logs = Object.assign({}, remote.logs || {});
    if (local && local.logs) {
      for (const k in local.logs) {
        if (!merged.logs[k]) merged.logs[k] = local.logs[k];
      }
    }
    const remoteFrozen = remote.frozenDays || [];
    const localFrozen = (local && local.frozenDays) || [];
    merged.frozenDays = Array.from(new Set([...remoteFrozen, ...localFrozen]));
    merged.lastCelebratedStreak = remote.lastCelebratedStreak != null ? remote.lastCelebratedStreak : (local && local.lastCelebratedStreak) || 0;
    merged.goals = remote.goals || (local && local.goals) || { pages: 3, verses: 5, memoUnit: "oyat", memoDays: [0, 1, 2, 3, 4, 5, 6] };
    merged.settings = remote.settings || (local && local.settings) || { theme: "light", script: "lotin", freezesPerMonth: DEFAULT_FREEZES_PER_MONTH };
    merged.onboarded = remote.onboarded != null ? remote.onboarded : (local && local.onboarded) || false;
    return merged;
  }

  /* ---------- Streak / Freeze ---------- */
  function isDayDone(data, key) {
    const log = data.logs[key];
    const doneByLog = !!(log && log.pages >= data.goals.pages);
    const frozen = data.frozenDays && data.frozenDays.includes(key);
    return doneByLog || frozen;
  }

  function freezeLimit(data) {
    return (data.settings && data.settings.freezesPerMonth != null)
      ? data.settings.freezesPerMonth
      : DEFAULT_FREEZES_PER_MONTH;
  }

  function freezesUsedInMonth(data, monthKey) {
    return (data.frozenDays || []).filter(k => k.startsWith(monthKey)).length;
  }

  function freezesRemainingInMonth(data, monthKey) {
    return Math.max(0, freezeLimit(data) - freezesUsedInMonth(data, monthKey));
  }

  function computeCurrentStreak(data) {
    let cursor = new Date();
    if (!isDayDone(data, dateKey(cursor))) cursor = addDays(cursor, -1);
    let streak = 0;
    while (isDayDone(data, dateKey(cursor))) {
      streak++;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function computeLongestStreak(data) {
    const keys = Object.keys(data.logs).sort();
    let longest = 0, run = 0, prevDate = null;
    for (const k of keys) {
      if (!isDayDone(data, k)) { run = 0; prevDate = null; continue; }
      const d = new Date(k + "T00:00:00");
      if (prevDate && dateKey(addDays(prevDate, 1)) === k) run++;
      else run = 1;
      longest = Math.max(longest, run);
      prevDate = d;
    }
    return longest;
  }

  /* ---------- Statistika bucket'lari ---------- */
  function getMonthBuckets(data, year, monthIndex) {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const buckets = [];
    for (let start = 1; start <= daysInMonth; start += 7) {
      const end = Math.min(start + 6, daysInMonth);
      let sum = 0;
      for (let day = start; day <= end; day++) {
        const key = `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
        sum += (data.logs[key] && data.logs[key].pages) || 0;
      }
      buckets.push({ label: `${start}-${end}`, value: sum });
    }
    return buckets;
  }

  /* Kalendar-grid: oy ichidagi har bir kun uchun bitta yozuv, hafta
     qatorlari toʻgʻri tekislanishi uchun oldingi boʻsh kataklar bilan.
     Dushanbadan boshlab hisoblanadi (firstDow: 0=Dushanba..6=Yakshanba). */
  function getCalendarMonthGrid(data, year, monthIndex) {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstDow = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    const tKey = todayKey();
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
      const log = data.logs[key];
      cells.push({
        key,
        day,
        isFuture: key > tKey,
        isToday: key === tKey,
        done: isDayDone(data, key),
        frozen: data.frozenDays.includes(key),
        pages: (log && log.pages) || 0,
        verses: (log && log.verses) || 0
      });
    }
    return cells;
  }

  /* Tarixni tahrirlash chegarasi: bugundan N kun orqaga qadar ochiq. */
  function isEditable(key, maxDaysBack) {
    const tKey = todayKey();
    if (key > tKey) return false; // kelajak — hech qachon
    const cutoff = dateKey(addDays(new Date(), -maxDaysBack));
    return key >= cutoff;
  }

  return {
    DEFAULT_FREEZES_PER_MONTH,
    WEEKDAY_LABELS,
    MONTH_NAMES,
    pad, dateKey, todayKey, addDays, dayOfYear,
    defaultData, ensureDataShape, mergeData,
    isDayDone, freezeLimit, freezesUsedInMonth, freezesRemainingInMonth,
    computeCurrentStreak, computeLongestStreak,
    getMonthBuckets, getCalendarMonthGrid, isEditable
  };
});
