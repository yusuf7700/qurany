/* =========================================================
   QuranY — App logic
   ========================================================= */

/* ---------- FIREBASE ------------------------------------------------------
   Google Sign-In va qurilmalar aro sinxronizatsiya uchun.
------------------------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyDE6y2ZbXcc3YDPYM-IMwTQ5sZJuxKbcrA",
  authDomain: "qurany-7d105.firebaseapp.com",
  projectId: "qurany-7d105",
  storageBucket: "qurany-7d105.firebasestorage.app",
  messagingSenderId: "593144843405",
  appId: "1:593144843405:web:db26cbcc5e105dea90a6c4",
  measurementId: "G-53D2SYKXZV"
};

let fbAuth = null, fbDb = null, firebaseReady = false;
try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY" && typeof firebase !== "undefined") {
    firebase.initializeApp(firebaseConfig);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    firebaseReady = true;
  }
} catch (e) {
  console.warn("Firebase sozlanmagan — mahalliy rejimda ishlaydi.", e);
}

/* ---------- TAKLIFLAR / DONAT HAVOLALARI --------------------------------*/
const SOCIAL_LINKS = {
  telegram: "https://t.me/yuuvsuf",
  instagram: "https://instagram.com/yunusovvyusuf",
  donateTelegram: "https://t.me/yuuvsuf"
};

/* ---------- LOTIN → KIRILL AVTOMATIK TRANSLITERATSIYA ------------------- */
function uzLatToCyr(str) {
  if (!str) return str;
  const map2 = { "o'": "ў", "o‘": "ў", "g'": "ғ", "g‘": "ғ", "sh": "ш", "ch": "ч", "ng": "нг" };
  const map1 = { a:"а",b:"б",d:"д",e:"е",f:"ф",g:"г",h:"ҳ",i:"и",j:"ж",k:"к",l:"л",m:"м",n:"н",
                 o:"о",p:"п",q:"қ",r:"р",s:"с",t:"т",u:"у",v:"в",x:"х",y:"й",z:"з","'":"ъ","‘":"ъ" };
  let out = "";
  let i = 0;
  while (i < str.length) {
    const two = str.substr(i, 2).toLowerCase();
    if (map2[two]) {
      const orig = str.substr(i, 2);
      let rep = map2[two];
      if (orig === orig.toUpperCase() && orig.toLowerCase() !== orig.toUpperCase()) rep = rep.toUpperCase();
      else if (orig[0] === orig[0].toUpperCase()) rep = rep.charAt(0).toUpperCase() + rep.slice(1);
      out += rep;
      i += 2;
      continue;
    }
    const ch = str[i];
    const low = ch.toLowerCase();
    if (map1[low]) {
      let rep = map1[low];
      if (ch === ch.toUpperCase() && ch.toLowerCase() !== ch.toUpperCase()) rep = rep.toUpperCase();
      out += rep;
    } else {
      out += ch;
    }
    i += 1;
  }
  return out;
}
function L(str) { return currentScript() === "kirill" ? uzLatToCyr(str) : str; }
function currentScript() { return (appData && appData.settings && appData.settings.script) || "lotin"; }

/* ---------- SANA YORDAMCHILARI ------------------------------------------ */
function pad(n) { return String(n).padStart(2, "0"); }
function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayKey() { return dateKey(new Date()); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function dayOfYear(d) { const start = new Date(d.getFullYear(), 0, 0); return Math.floor((d - start) / 86400000); }

const WEEKDAY_LABELS = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"]; // getDay(): 0=Yakshanba

/* ---------- HOLAT (STATE) ------------------------------------------------*/
let currentUser = null;   // {uid, name, email, isGuest}
let appData = null;       // {name, goals:{pages,verses,memoUnit,memoDays}, logs, settings, onboarded}
let draft = { pages: 0, verses: 0 };
let obDraft = { pages: 3, verses: 5, unit: "oyat", days: [0,1,2,3,4,5,6] };
let deferredInstallPrompt = null;
let suppressAuthAutoHandle = false;

const LS_PREFIX = "quranY_v1_";
function loadLocal(uid) {
  try { return JSON.parse(localStorage.getItem(LS_PREFIX + uid)); } catch (e) { return null; }
}
function saveLocalRaw(uid, data) {
  try { localStorage.setItem(LS_PREFIX + uid, JSON.stringify(data)); } catch (e) {}
}
function defaultData(name) {
  return {
    name: name || "Do'stim",
    goals: { pages: 3, verses: 5, memoUnit: "oyat", memoDays: [0,1,2,3,4,5,6] },
    logs: {},
    frozenDays: [],
    lastCelebratedStreak: 0,
    settings: { theme: "light", script: "lotin" },
    onboarded: false
  };
}
function ensureDataShape(d) {
  d.goals = d.goals || {};
  if (d.goals.pages == null) d.goals.pages = 3;
  if (d.goals.verses == null) d.goals.verses = 5;
  if (!d.goals.memoUnit) d.goals.memoUnit = "oyat";
  if (!d.goals.memoDays || !d.goals.memoDays.length) d.goals.memoDays = [0,1,2,3,4,5,6];
  if (d.onboarded == null) d.onboarded = false;
  if (!d.frozenDays) d.frozenDays = [];
  if (d.lastCelebratedStreak == null) d.lastCelebratedStreak = 0;
  d.settings = d.settings || { theme: "light", script: "lotin" };
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
  merged.goals = remote.goals || (local && local.goals) || { pages: 3, verses: 5, memoUnit: "oyat", memoDays: [0,1,2,3,4,5,6] };
  merged.settings = remote.settings || (local && local.settings) || { theme: "light", script: "lotin" };
  merged.onboarded = remote.onboarded != null ? remote.onboarded : (local && local.onboarded) || false;
  return merged;
}
function persist() {
  saveLocalRaw(currentUser.uid, appData);
  if (firebaseReady && !currentUser.isGuest && fbDb) {
    fbDb.collection("users").doc(currentUser.uid).set(appData).catch(() => {});
  }
}

/* ---------- TOAST ---------------------------------------------------------*/
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

/* ---------- EKRANLAR / NAVIGATSIYA ----------------------------------------*/
function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  window.scrollTo(0, 0);
}

/* ---------- AUTENTIFIKATSIYA -----------------------------------------------*/
function bindAuthEvents() {
  document.getElementById("btnGoogle").addEventListener("click", async () => {
    if (!firebaseReady) {
      toast("Google kirish hali sozlanmagan — \"Ism bilan davom etish\"dan foydalaning.");
      return;
    }
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await fbAuth.signInWithPopup(provider);
      await handleFirebaseUser(result.user);
    } catch (e) {
      toast("Kirishda xatolik yuz berdi.");
    }
  });

  document.getElementById("btnShowGuest").addEventListener("click", () => {
    document.getElementById("guestForm").classList.add("open");
  });

  document.getElementById("btnGuestContinue").addEventListener("click", () => {
    const name = document.getElementById("guestName").value.trim();
    if (!name) { toast("Ismingizni kiriting"); return; }
    currentUser = { uid: "guest", name, isGuest: true };
    localStorage.setItem("quranY_guest_session", JSON.stringify(currentUser));
    loadAppDataAndEnter();
  });
}

async function handleFirebaseUser(user) {
  if (suppressAuthAutoHandle) return;
  currentUser = { uid: user.uid, name: user.displayName || "Do'stim", email: user.email, isGuest: false };
  await loadAppDataAndEnter();
}

async function loadAppDataAndEnter() {
  const local = loadLocal(currentUser.uid);
  appData = local || defaultData(currentUser.name);
  if (currentUser.name) appData.name = currentUser.name;

  if (firebaseReady && !currentUser.isGuest && fbDb) {
    try {
      const snap = await fbDb.collection("users").doc(currentUser.uid).get();
      if (snap.exists) {
        appData = mergeData(appData, snap.data());
      } else {
        await fbDb.collection("users").doc(currentUser.uid).set(appData);
      }
    } catch (e) {
      // Offline yoki Firestore mavjud emas — mahalliy nusxa bilan davom etamiz
    }
  }
  ensureDataShape(appData);
  saveLocalRaw(currentUser.uid, appData);

  if (!appData.onboarded) {
    showOnboarding();
  } else {
    enterApp();
  }
}

function enterApp() {
  applyTheme(appData.settings.theme);
  document.getElementById("scriptSelect").value = appData.settings.script;
  tagLeaves();
  applyScriptToStatics(appData.settings.script);
  document.getElementById("bottomNav").style.display = "flex";
  showScreen("dashboard");
  renderAll();
}

function logout() {
  if (firebaseReady && !currentUser.isGuest) {
    fbAuth.signOut().catch(() => {});
  }
  localStorage.removeItem("quranY_guest_session");
  currentUser = null;
  appData = null;
  document.getElementById("bottomNav").style.display = "none";
  document.getElementById("guestForm").classList.remove("open");
  document.getElementById("guestName").value = "";
  showScreen("auth");
}

/* ---------- ONBOARDING (birinchi sozlash) ---------------------------------*/
function showOnboarding() {
  obDraft.pages = appData.goals.pages;
  obDraft.verses = appData.goals.verses;
  obDraft.unit = appData.goals.memoUnit;
  obDraft.days = appData.goals.memoDays.slice();
  updateOnboardingUI();
  document.getElementById("bottomNav").style.display = "none";
  showScreen("onboarding");
}
function updateOnboardingUI() {
  document.getElementById("obPagesVal").textContent = obDraft.pages;
  document.getElementById("obVersesVal").textContent = obDraft.verses;
  document.getElementById("obUnitSelect").value = obDraft.unit;
  document.querySelectorAll("#obWeekdayChips .chip").forEach(c => {
    c.classList.toggle("active", obDraft.days.includes(Number(c.dataset.day)));
  });
}
function bindOnboardingEvents() {
  document.getElementById("obPagesPlus").addEventListener("click", () => { obDraft.pages = Math.min(50, obDraft.pages + 1); updateOnboardingUI(); });
  document.getElementById("obPagesMinus").addEventListener("click", () => { obDraft.pages = Math.max(1, obDraft.pages - 1); updateOnboardingUI(); });
  document.getElementById("obVersesPlus").addEventListener("click", () => { obDraft.verses = Math.min(50, obDraft.verses + 1); updateOnboardingUI(); });
  document.getElementById("obVersesMinus").addEventListener("click", () => { obDraft.verses = Math.max(1, obDraft.verses - 1); updateOnboardingUI(); });
  document.getElementById("obUnitSelect").addEventListener("change", (e) => { obDraft.unit = e.target.value; });
  document.querySelectorAll("#obWeekdayChips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const day = Number(chip.dataset.day);
      const idx = obDraft.days.indexOf(day);
      if (idx >= 0) obDraft.days.splice(idx, 1); else obDraft.days.push(day);
      updateOnboardingUI();
    });
  });
  document.getElementById("obAllDays").addEventListener("click", () => {
    obDraft.days = [0,1,2,3,4,5,6];
    updateOnboardingUI();
  });
  document.getElementById("btnOnboardingDone").addEventListener("click", () => {
    appData.goals.pages = obDraft.pages;
    appData.goals.verses = obDraft.verses;
    appData.goals.memoUnit = obDraft.unit;
    appData.goals.memoDays = obDraft.days.length ? obDraft.days.slice() : [0,1,2,3,4,5,6];
    appData.onboarded = true;
    persist();
    enterApp();
  });
}

/* ---------- STREAK HISOBLASH -----------------------------------------------*/
function isDayDone(key) {
  const log = appData.logs[key];
  const doneByLog = !!(log && log.pages >= appData.goals.pages);
  const frozen = appData.frozenDays && appData.frozenDays.includes(key);
  return doneByLog || frozen;
}
function freezesUsedInMonth(monthKey) {
  return (appData.frozenDays || []).filter(k => k.startsWith(monthKey)).length;
}
function computeCurrentStreak() {
  let cursor = new Date();
  if (!isDayDone(dateKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (isDayDone(dateKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
function computeLongestStreak() {
  const keys = Object.keys(appData.logs).sort();
  let longest = 0, run = 0, prevDate = null;
  for (const k of keys) {
    if (!isDayDone(k)) { run = 0; prevDate = null; continue; }
    const d = new Date(k + "T00:00:00");
    if (prevDate && dateKey(addDays(prevDate, 1)) === k) run++;
    else run = 1;
    longest = Math.max(longest, run);
    prevDate = d;
  }
  return longest;
}

/* ---------- KUNNING OYATI / HADISI -----------------------------------------*/
function todayQuote() {
  const idx = dayOfYear(new Date()) % QURANY_QUOTES.length;
  return QURANY_QUOTES[idx];
}

/* ---------- DASHBOARD -------------------------------------------------------*/
function initDraftFromToday() {
  const log = appData.logs[todayKey()] || { pages: 0, verses: 0 };
  draft.pages = log.pages || 0;
  draft.verses = log.verses || 0;
}

function renderDashboard() {
  document.getElementById("dashName").textContent = appData.name;

  const q = todayQuote();
  document.getElementById("quoteKind").textContent = L(q.type === "ayah" ? "Kunning oyati" : "Kunning hadisi");
  document.getElementById("quoteText").textContent = L(q.text);
  if (q.type === "ayah") {
    document.getElementById("quoteRef").textContent = L(q.ref);
    document.getElementById("quoteNarrator").textContent = "";
  } else {
    document.getElementById("quoteRef").textContent = L(q.source);
    document.getElementById("quoteNarrator").textContent = L(q.narrator);
  }

  document.getElementById("pagesGoal").textContent = appData.goals.pages;
  document.getElementById("versesGoal").textContent = appData.goals.verses;
  document.getElementById("versesUnit").textContent = L(appData.goals.memoUnit);
  updateDraftUI();

  const todayDow = new Date().getDay();
  const isMemoDay = appData.goals.memoDays.includes(todayDow);
  document.getElementById("verseTaskBlock").style.display = isMemoDay ? "block" : "none";
  document.getElementById("verseOffHint").style.display = isMemoDay ? "none" : "block";

  const streak = computeCurrentStreak();
  document.getElementById("streakNum").textContent = streak;

  const todayDone = isDayDone(todayKey());
  document.getElementById("todayDoneHint").style.display = todayDone ? "flex" : "none";

  renderWeekBeads();
}

function updateDraftUI() {
  document.getElementById("pagesVal").textContent = draft.pages;
  document.getElementById("pagesDone").textContent = draft.pages;
  document.getElementById("versesVal").textContent = draft.verses;
  document.getElementById("versesDone").textContent = draft.verses;
  const pPct = Math.min(100, Math.round((draft.pages / Math.max(1, appData.goals.pages)) * 100));
  const vPct = Math.min(100, Math.round((draft.verses / Math.max(1, appData.goals.verses)) * 100));
  document.getElementById("pagesFill").style.width = pPct + "%";
  document.getElementById("versesFill").style.width = vPct + "%";
}

function renderWeekBeads() {
  const wrap = document.getElementById("weekBeads");
  wrap.innerHTML = "";
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const key = dateKey(d);
    const frozen = appData.frozenDays.includes(key);
    const bead = document.createElement("div");
    let cls = "bead";
    if (frozen) cls += " frozen";
    else if (isDayDone(key)) cls += " filled";
    if (i === 0) cls += " today";
    bead.className = cls;
    bead.textContent = L(WEEKDAY_LABELS[d.getDay()]);
    wrap.appendChild(bead);
  }
}

function bindDashboardEvents() {
  document.getElementById("pagesPlus").addEventListener("click", () => { draft.pages = Math.min(99, draft.pages + 1); updateDraftUI(); });
  document.getElementById("pagesMinus").addEventListener("click", () => { draft.pages = Math.max(0, draft.pages - 1); updateDraftUI(); });
  document.getElementById("versesPlus").addEventListener("click", () => { draft.verses = Math.min(99, draft.verses + 1); updateDraftUI(); });
  document.getElementById("versesMinus").addEventListener("click", () => { draft.verses = Math.max(0, draft.verses - 1); updateDraftUI(); });

  document.getElementById("btnSaveToday").addEventListener("click", () => {
    appData.logs[todayKey()] = { pages: draft.pages, verses: draft.verses };
    persist();
    renderDashboard();
    toast("Bugungi natija saqlandi!");
    checkMilestone();
  });
}

const STREAK_MILESTONES = [3, 7, 15, 30, 50, 100, 180, 365];
function checkMilestone() {
  const streak = computeCurrentStreak();
  if (STREAK_MILESTONES.includes(streak) && appData.lastCelebratedStreak !== streak) {
    appData.lastCelebratedStreak = streak;
    persist();
    document.getElementById("milestoneTitle").textContent = L(`${streak} kunlik streak!`);
    document.getElementById("milestoneSheetBackdrop").classList.add("open");
  }
}

/* ---------- STATISTIKA --------------------------------------------------------*/
let statsRange = "week";
let statsWeekDate = new Date(); // shu haftadagi istalgan sana
let statsMonthDate = new Date(); // joriy ko'rilayotgan oy (har doim shu oyning 1-kuni sifatida ishlatiladi)
const MONTH_NAMES = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentyabr","Oktyabr","Noyabr","Dekabr"];

function getMondayOfWeek(d) {
  const dow = d.getDay(); // 0=Yakshanba..6=Shanba
  const diffFromMonday = (dow + 6) % 7;
  const monday = addDays(d, -diffFromMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
function getWeekBuckets(weekStart) {
  const buckets = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const key = dateKey(d);
    buckets.push({ label: WEEKDAY_LABELS[d.getDay()], value: (appData.logs[key] && appData.logs[key].pages) || 0 });
  }
  return buckets;
}
function formatWeekLabel(weekStart) {
  const weekEnd = addDays(weekStart, 6);
  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${weekStart.getDate()}-${weekEnd.getDate()} ${MONTH_NAMES[weekStart.getMonth()]}`;
  }
  return `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]} - ${weekEnd.getDate()} ${MONTH_NAMES[weekEnd.getMonth()]}`;
}

function getMonthBuckets(year, monthIndex) {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const buckets = [];
  for (let start = 1; start <= daysInMonth; start += 7) {
    const end = Math.min(start + 6, daysInMonth);
    let sum = 0;
    for (let day = start; day <= end; day++) {
      const key = `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
      sum += (appData.logs[key] && appData.logs[key].pages) || 0;
    }
    buckets.push({ label: `${start}-${end}`, value: sum });
  }
  return buckets;
}

function renderStats() {
  document.getElementById("statStreak").textContent = computeCurrentStreak();
  document.getElementById("statLongest").textContent = computeLongestStreak();

  let totalPages = 0, totalVerses = 0;
  for (const k in appData.logs) {
    totalPages += appData.logs[k].pages || 0;
    totalVerses += appData.logs[k].verses || 0;
  }
  document.getElementById("statPagesTotal").textContent = totalPages;
  document.getElementById("statVersesTotal").textContent = totalVerses;
  document.getElementById("statVersesLabel").textContent = L(`Jami yodlangan ${appData.goals.memoUnit}`);

  document.getElementById("chartTitle").textContent = L("O'qilgan betlar");
  const bars = document.getElementById("chartBars");
  bars.innerHTML = "";

  const monthNav = document.getElementById("monthNav");
  const weekNav = document.getElementById("weekNav");
  let buckets = [];

  if (statsRange === "week") {
    monthNav.style.display = "none";
    weekNav.style.display = "flex";
    const weekStart = getMondayOfWeek(statsWeekDate);
    document.getElementById("weekLabel").textContent = L(formatWeekLabel(weekStart));
    const currentWeekStart = getMondayOfWeek(new Date());
    document.getElementById("weekNext").disabled = weekStart.getTime() >= currentWeekStart.getTime();
    buckets = getWeekBuckets(weekStart);
  } else {
    weekNav.style.display = "none";
    monthNav.style.display = "flex";
    const y = statsMonthDate.getFullYear();
    const m = statsMonthDate.getMonth();
    document.getElementById("monthLabel").textContent = L(`${MONTH_NAMES[m]} ${y}`);
    const now = new Date();
    const isCurrentMonth = y === now.getFullYear() && m === now.getMonth();
    document.getElementById("monthNext").disabled = isCurrentMonth;
    buckets = getMonthBuckets(y, m);
  }

  const max = Math.max(1, ...buckets.map(b => b.value));
  buckets.forEach(b => {
    const wrap = document.createElement("div");
    wrap.className = "bar-wrap";
    const val = document.createElement("div");
    val.className = "bar-val";
    val.textContent = b.value;
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = Math.max(4, Math.round((b.value / max) * 100)) + "%";
    const lbl = document.createElement("div");
    lbl.className = "bar-lbl";
    lbl.textContent = L(b.label);
    wrap.appendChild(val);
    wrap.appendChild(bar);
    wrap.appendChild(lbl);
    bars.appendChild(wrap);
  });

  renderHistoryList();
  renderRecap();
}

function bindStatsEvents() {
  document.querySelectorAll("#statsRange button").forEach(btn => {
    btn.addEventListener("click", () => {
      statsRange = btn.dataset.range;
      document.querySelectorAll("#statsRange button").forEach(b => b.classList.toggle("active", b === btn));
      renderStats();
    });
  });

  document.getElementById("weekPrev").addEventListener("click", () => {
    statsWeekDate = addDays(getMondayOfWeek(statsWeekDate), -7);
    renderStats();
  });
  document.getElementById("weekNext").addEventListener("click", () => {
    const currentWeekStart = getMondayOfWeek(new Date());
    const nextStart = addDays(getMondayOfWeek(statsWeekDate), 7);
    if (nextStart.getTime() > currentWeekStart.getTime()) return;
    statsWeekDate = nextStart;
    renderStats();
  });

  document.getElementById("monthPrev").addEventListener("click", () => {
    statsMonthDate = new Date(statsMonthDate.getFullYear(), statsMonthDate.getMonth() - 1, 1);
    renderStats();
  });
  document.getElementById("monthNext").addEventListener("click", () => {
    const now = new Date();
    const next = new Date(statsMonthDate.getFullYear(), statsMonthDate.getMonth() + 1, 1);
    if (next.getFullYear() > now.getFullYear() || (next.getFullYear() === now.getFullYear() && next.getMonth() > now.getMonth())) return;
    statsMonthDate = next;
    renderStats();
  });
}

/* ---------- KUNLAR TARIXI VA TAHRIRLASH ---------------------------------------*/
function formatDayLabel(d, i) {
  if (i === 0) return "Bugun";
  if (i === 1) return "Kecha";
  return `${d.getDate()}.${pad(d.getMonth() + 1)} (${WEEKDAY_LABELS[d.getDay()]})`;
}
function renderHistoryList() {
  const wrap = document.getElementById("historyList");
  wrap.innerHTML = "";
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = addDays(today, -i);
    const key = dateKey(d);
    const log = appData.logs[key];
    const frozen = appData.frozenDays.includes(key);

    const row = document.createElement("div");
    row.className = "history-row";

    const dateDiv = document.createElement("div");
    dateDiv.className = "history-date";
    dateDiv.textContent = L(formatDayLabel(d, i)) + (frozen ? " ❄" : "");

    const valsDiv = document.createElement("div");
    valsDiv.className = "history-vals";
    const pagesVal = (log && log.pages) || 0;
    const versesVal = (log && log.verses) || 0;
    valsDiv.textContent = frozen && pagesVal === 0
      ? L("Muzlatilgan")
      : `${pagesVal} ${L("bet")} · ${versesVal} ${L(appData.goals.memoUnit)}`;

    const editBtn = document.createElement("button");
    editBtn.className = "history-edit";
    editBtn.textContent = "✎";
    editBtn.addEventListener("click", () => openDayEdit(key, formatDayLabel(d, i)));

    row.appendChild(dateDiv);
    row.appendChild(valsDiv);
    row.appendChild(editBtn);
    wrap.appendChild(row);
  }
}

let dayEditDraft = { key: null, pages: 0, verses: 0, frozen: false };
function openDayEdit(key, label) {
  dayEditDraft.key = key;
  const log = appData.logs[key] || { pages: 0, verses: 0 };
  dayEditDraft.pages = log.pages || 0;
  dayEditDraft.verses = log.verses || 0;
  dayEditDraft.frozen = appData.frozenDays.includes(key);
  document.getElementById("dayEditTitle").textContent = L(label);
  updateDayEditUI();
  updateFreezeUI();
  document.getElementById("dayEditBackdrop").classList.add("open");
}
function updateDayEditUI() {
  document.getElementById("dayPagesVal").textContent = dayEditDraft.pages;
  document.getElementById("dayVersesVal").textContent = dayEditDraft.verses;
}
function updateFreezeUI() {
  const monthKey = dayEditDraft.key.slice(0, 7);
  const used = freezesUsedInMonth(monthKey);
  const available = dayEditDraft.frozen || used < 1;
  document.getElementById("freezeToggle").checked = dayEditDraft.frozen;
  document.getElementById("freezeSub").textContent = L(
    dayEditDraft.frozen ? "Bu kun uchun muzlatilgan" : (available ? "Bu oy uchun mavjud (oyiga 1 marta)" : "Bu oy uchun ishlatib bo'lingan")
  );
}
function bindDayEditEvents() {
  document.getElementById("dayPagesPlus").addEventListener("click", () => { dayEditDraft.pages = Math.min(99, dayEditDraft.pages + 1); updateDayEditUI(); });
  document.getElementById("dayPagesMinus").addEventListener("click", () => { dayEditDraft.pages = Math.max(0, dayEditDraft.pages - 1); updateDayEditUI(); });
  document.getElementById("dayVersesPlus").addEventListener("click", () => { dayEditDraft.verses = Math.min(99, dayEditDraft.verses + 1); updateDayEditUI(); });
  document.getElementById("dayVersesMinus").addEventListener("click", () => { dayEditDraft.verses = Math.max(0, dayEditDraft.verses - 1); updateDayEditUI(); });

  document.getElementById("freezeToggle").addEventListener("change", (e) => {
    const monthKey = dayEditDraft.key.slice(0, 7);
    if (e.target.checked) {
      const used = freezesUsedInMonth(monthKey);
      if (!dayEditDraft.frozen && used >= 1) {
        e.target.checked = false;
        toast("Bu oy uchun muzlatish limiti tugagan (oyiga 1 marta).");
        return;
      }
      dayEditDraft.frozen = true;
    } else {
      dayEditDraft.frozen = false;
    }
    updateFreezeUI();
  });

  document.getElementById("btnDaySave").addEventListener("click", () => {
    appData.logs[dayEditDraft.key] = { pages: dayEditDraft.pages, verses: dayEditDraft.verses };
    const idx = appData.frozenDays.indexOf(dayEditDraft.key);
    if (dayEditDraft.frozen && idx === -1) appData.frozenDays.push(dayEditDraft.key);
    if (!dayEditDraft.frozen && idx !== -1) appData.frozenDays.splice(idx, 1);
    persist();
    document.getElementById("dayEditBackdrop").classList.remove("open");
    renderStats();
    if (dayEditDraft.key === todayKey()) { initDraftFromToday(); renderDashboard(); }
    toast("Kun yangilandi!");
  });
  document.getElementById("btnDayCancel").addEventListener("click", () => {
    document.getElementById("dayEditBackdrop").classList.remove("open");
  });
  document.getElementById("dayEditBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "dayEditBackdrop") e.currentTarget.classList.remove("open");
  });
}

/* ---------- XULOSA (RECAP) VA NATIJALARNI ULASHISH -------------------------------*/
function renderRecap() {
  const lastWeekStart = addDays(getMondayOfWeek(new Date()), -7);
  const wBuckets = getWeekBuckets(lastWeekStart);
  const wTotal = wBuckets.reduce((s, b) => s + b.value, 0);
  let wDaysDone = 0;
  for (let i = 0; i < 7; i++) { if (isDayDone(dateKey(addDays(lastWeekStart, i)))) wDaysDone++; }
  document.getElementById("recapWeekText").textContent = L(`${wTotal} bet o'qidingiz, ${wDaysDone}/7 kun bajarildi`);

  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mBuckets = getMonthBuckets(lastMonth.getFullYear(), lastMonth.getMonth());
  const mTotal = mBuckets.reduce((s, b) => s + b.value, 0);
  document.getElementById("recapMonthText").textContent = L(`${MONTH_NAMES[lastMonth.getMonth()]} oyida ${mTotal} bet o'qidingiz`);
}

function buildShareCanvas(opts) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#1B4D3B");
  grad.addColorStop(1, "#0B241B");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.arc(950, 130, 280, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fill();

  ctx.fillStyle = "#EFFAF3";
  ctx.font = "800 56px Manrope, sans-serif";
  ctx.fillText("QuranY", 72, 140);
  ctx.font = "500 30px Inter, sans-serif";
  ctx.fillStyle = "#A7DABE";
  ctx.fillText("Har kuni Qur'on bilan", 72, 182);

  ctx.font = "800 230px Manrope, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(opts.headline, 72, 470);

  ctx.font = "700 42px Manrope, sans-serif";
  ctx.fillStyle = "#C9A24B";
  ctx.fillText(L(opts.headlineLabel), 72, 525);

  ctx.font = "500 34px Inter, sans-serif";
  ctx.fillStyle = "#EFFAF3";
  let y = 610;
  (opts.lines || []).forEach(line => {
    ctx.fillText(L(line), 72, y);
    y += 52;
  });

  ctx.font = "600 30px Inter, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(appData.name, 72, 990);
  ctx.font = "400 24px Inter, sans-serif";
  ctx.fillStyle = "#8FA79B";
  ctx.fillText(L("QuranY ilovasi bilan"), 72, 1030);

  return canvas;
}

function shareOrDownloadCanvas(canvas, shareText) {
  canvas.toBlob(async (blob) => {
    if (!blob) { toast("Rasm yaratishda xatolik yuz berdi."); return; }
    const file = new File([blob], "qurany-natija.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "QuranY", text: shareText });
        return;
      } catch (e) {
        // Foydalanuvchi bekor qilgan bo'lishi mumkin — pastdagi yuklab olish fallback ishlaydi
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qurany-natija.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("Rasm yuklab olindi — Instagram yoki Telegramda ulashing!");
  }, "image/png");
}

function shareStreakCard() {
  const streak = computeCurrentStreak();
  let totalPages = 0, totalVerses = 0;
  for (const k in appData.logs) {
    totalPages += appData.logs[k].pages || 0;
    totalVerses += appData.logs[k].verses || 0;
  }
  const canvas = buildShareCanvas({
    headline: String(streak),
    headlineLabel: "kunlik streak 🔥",
    lines: [`📖 Jami ${totalPages} bet o'qilgan`, `🧠 Jami ${totalVerses} ${appData.goals.memoUnit} yodlangan`]
  });
  shareOrDownloadCanvas(canvas, `Men QuranY'da ${streak} kunlik streakdaman! 🔥`);
}

function shareWeekRecap() {
  const lastWeekStart = addDays(getMondayOfWeek(new Date()), -7);
  const wBuckets = getWeekBuckets(lastWeekStart);
  const wTotal = wBuckets.reduce((s, b) => s + b.value, 0);
  let wDaysDone = 0;
  for (let i = 0; i < 7; i++) { if (isDayDone(dateKey(addDays(lastWeekStart, i)))) wDaysDone++; }
  const streak = computeCurrentStreak();
  const canvas = buildShareCanvas({
    headline: String(wTotal),
    headlineLabel: "bet — o'tgan hafta",
    lines: [`${wDaysDone}/7 kun bajarildi`, `Joriy streak: ${streak} kun 🔥`]
  });
  shareOrDownloadCanvas(canvas, `O'tgan hafta QuranY'da ${wTotal} bet o'qidim! 📖`);
}

function shareMonthRecap() {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mBuckets = getMonthBuckets(lastMonth.getFullYear(), lastMonth.getMonth());
  const mTotal = mBuckets.reduce((s, b) => s + b.value, 0);
  const streak = computeCurrentStreak();
  const canvas = buildShareCanvas({
    headline: String(mTotal),
    headlineLabel: `bet — ${MONTH_NAMES[lastMonth.getMonth()]} oyi`,
    lines: [`Joriy streak: ${streak} kun 🔥`]
  });
  shareOrDownloadCanvas(canvas, `${MONTH_NAMES[lastMonth.getMonth()]} oyida QuranY'da ${mTotal} bet o'qidim! 📖`);
}

function bindShareEvents() {
  document.getElementById("btnShareStats").addEventListener("click", shareStreakCard);
  document.getElementById("btnShareWeek").addEventListener("click", shareWeekRecap);
  document.getElementById("btnShareMonth").addEventListener("click", shareMonthRecap);
  document.getElementById("btnMilestoneShare").addEventListener("click", shareStreakCard);
  document.getElementById("btnMilestoneClose").addEventListener("click", () => {
    document.getElementById("milestoneSheetBackdrop").classList.remove("open");
  });
  document.getElementById("milestoneSheetBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "milestoneSheetBackdrop") e.currentTarget.classList.remove("open");
  });
}

/* ---------- SOZLAMALAR ---------------------------------------------------------*/
function renderSettings() {
  document.getElementById("setAccountName").textContent = appData.name;
  document.getElementById("setAccountType").textContent = L(currentUser.isGuest ? "Mehmon rejimi (shu qurilmada saqlanadi)" : "Google akkaunt bilan ulangan");
  document.getElementById("linkGoogleItem").style.display = currentUser.isGuest ? "flex" : "none";

  document.getElementById("goalPagesVal").textContent = appData.goals.pages;
  document.getElementById("goalVersesVal").textContent = appData.goals.verses;
  document.getElementById("goalUnitSelect").value = appData.goals.memoUnit;
  document.querySelectorAll("#setWeekdayChips .chip").forEach(c => {
    c.classList.toggle("active", appData.goals.memoDays.includes(Number(c.dataset.day)));
  });

  document.getElementById("darkModeToggle").checked = appData.settings.theme === "dark";
  document.getElementById("linkTelegram").href = SOCIAL_LINKS.telegram;
  document.getElementById("linkInstagram").href = SOCIAL_LINKS.instagram;
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
}

function bindSettingsEvents() {
  document.getElementById("goalPagesPlus").addEventListener("click", () => { appData.goals.pages = Math.min(50, appData.goals.pages + 1); persist(); renderSettings(); renderDashboard(); });
  document.getElementById("goalPagesMinus").addEventListener("click", () => { appData.goals.pages = Math.max(1, appData.goals.pages - 1); persist(); renderSettings(); renderDashboard(); });
  document.getElementById("goalVersesPlus").addEventListener("click", () => { appData.goals.verses = Math.min(50, appData.goals.verses + 1); persist(); renderSettings(); renderDashboard(); });
  document.getElementById("goalVersesMinus").addEventListener("click", () => { appData.goals.verses = Math.max(1, appData.goals.verses - 1); persist(); renderSettings(); renderDashboard(); });

  document.getElementById("goalUnitSelect").addEventListener("change", (e) => {
    appData.goals.memoUnit = e.target.value;
    persist();
    renderSettings();
    renderDashboard();
  });

  document.querySelectorAll("#setWeekdayChips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const day = Number(chip.dataset.day);
      const days = appData.goals.memoDays.slice();
      const idx = days.indexOf(day);
      if (idx >= 0) days.splice(idx, 1); else days.push(day);
      appData.goals.memoDays = days.length ? days : [0,1,2,3,4,5,6];
      persist();
      renderSettings();
      renderDashboard();
    });
  });

  document.getElementById("darkModeToggle").addEventListener("change", (e) => {
    appData.settings.theme = e.target.checked ? "dark" : "light";
    applyTheme(appData.settings.theme);
    persist();
  });

  document.getElementById("scriptSelect").addEventListener("change", (e) => {
    appData.settings.script = e.target.value;
    persist();
    applyScriptToStatics(appData.settings.script);
    renderAll();
  });

  document.getElementById("btnLogout").addEventListener("click", logout);

  document.getElementById("btnLinkGoogle").addEventListener("click", async () => {
    if (!firebaseReady) { toast("Google ulash hozircha sozlanmagan."); return; }
    suppressAuthAutoHandle = true;
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await fbAuth.signInWithPopup(provider);
      const user = result.user;
      const guestData = appData;
      let finalData = guestData;
      if (fbDb) {
        try {
          const snap = await fbDb.collection("users").doc(user.uid).get();
          if (snap.exists) finalData = mergeData(guestData, snap.data());
        } catch (e) {}
      }
      currentUser = { uid: user.uid, name: user.displayName || guestData.name, email: user.email, isGuest: false };
      appData = finalData;
      ensureDataShape(appData);
      localStorage.removeItem("quranY_guest_session");
      persist();
      renderAll();
      toast("Google akkaunt ulandi — ma'lumotlaringiz saqlandi!");
    } catch (e) {
      toast("Ulashda xatolik yuz berdi.");
    } finally {
      setTimeout(() => { suppressAuthAutoHandle = false; }, 800);
    }
  });

  document.getElementById("btnInstall").addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (choice.outcome === "accepted") toast("Ilova o'rnatilmoqda...");
    } else {
      toast("Bu qurilmada avtomatik o'rnatish mavjud emas. Brauzer menyusidan \"Bosh ekranga qo'shish\"ni tanlang.");
    }
  });

  document.getElementById("btnClearCache").addEventListener("click", async () => {
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      toast("Kesh tozalandi, sahifa yangilanmoqda...");
      setTimeout(() => location.reload(), 900);
    } catch (e) {
      toast("Keshni tozalashda xatolik yuz berdi.");
    }
  });

  document.getElementById("btnDonate").addEventListener("click", () => {
    document.getElementById("donateSheetBackdrop").classList.add("open");
  });
  document.getElementById("btnDonateClose").addEventListener("click", () => {
    document.getElementById("donateSheetBackdrop").classList.remove("open");
  });
  document.getElementById("donateSheetBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "donateSheetBackdrop") e.currentTarget.classList.remove("open");
  });
  document.getElementById("donateContact").addEventListener("click", () => {
    window.open(SOCIAL_LINKS.donateTelegram, "_blank");
  });
}

/* ---------- I18N (LOTIN/KIRILL) STATIK MATNLAR --------------------------------*/
function tagLeaves() {
  const all = document.querySelectorAll("#app *");
  all.forEach(el => {
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "SCRIPT") return;
    if (el.children.length === 0 && el.textContent.trim().length > 0) {
      if (!el.dataset.lat) el.dataset.lat = el.textContent;
    }
  });
  document.querySelectorAll("#app option").forEach(o => { if (!o.dataset.lat) o.dataset.lat = o.textContent; });
}
function applyScriptToStatics(script) {
  document.querySelectorAll("#app [data-lat]").forEach(el => {
    el.textContent = script === "kirill" ? uzLatToCyr(el.dataset.lat) : el.dataset.lat;
  });
}

/* ---------- NAV -----------------------------------------------------------------*/
function bindNav() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      showScreen(btn.dataset.view);
      if (btn.dataset.view === "stats") renderStats();
      if (btn.dataset.view === "settings") renderSettings();
      if (btn.dataset.view === "dashboard") { initDraftFromToday(); renderDashboard(); }
    });
  });
}

function renderAll() {
  initDraftFromToday();
  renderDashboard();
  renderStats();
  renderSettings();
}

/* ---------- PWA: O'RNATISH VA SERVICE WORKER --------------------------------------*/
function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });
}
function registerSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
}

/* ---------- ISHGA TUSHIRISH ---------------------------------------------------------*/
let sessionRestored = false;

function init() {
  bindAuthEvents();
  bindOnboardingEvents();
  bindNav();
  bindDashboardEvents();
  bindStatsEvents();
  bindSettingsEvents();
  bindDayEditEvents();
  bindShareEvents();
  setupInstallPrompt();
  registerSW();

  // Tezkor yo'l: agar shu qurilmada mehmon sessiyasi bo'lsa, Firebase javobini
  // kutmasdan darhol ilovaga kiritamiz (aks holda har safar 2-3 soniyalik kutish bo'lardi).
  const savedGuest = JSON.parse(localStorage.getItem("quranY_guest_session") || "null");
  if (savedGuest) {
    currentUser = savedGuest;
    sessionRestored = true;
    loadAppDataAndEnter();
  }

  if (firebaseReady) {
    fbAuth.onAuthStateChanged(user => {
      if (suppressAuthAutoHandle) return;
      if (user) {
        sessionRestored = true;
        handleFirebaseUser(user);
      } else if (!sessionRestored) {
        showScreen("auth");
      }
    });
  } else if (!sessionRestored) {
    showScreen("auth");
  }
}

document.addEventListener("DOMContentLoaded", init);
