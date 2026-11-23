import * as I from './i18n.js';
import { t, apply, setLang, fmtMoney, fmtDate, fmtTime, fmtDateTime, lang } from './i18n.js';
import * as L from './logic.js';
import * as LIC from './license.js';
import * as FX from './fx.js';
import { CONTACT } from './config.js';
import * as S from './store.js';
import * as FA from './facilities.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

await S.init();
let db = S.load();
const native = !!window.Capacitor?.isNativePlatform?.();
const plug = (n) => window.Capacitor?.Plugins?.[n];
async function shareText(title, text) { try { await plug('Share').share({ title, text, dialogTitle: title }); } catch {} }
let user = null;
// ---- ownership scope: admin sees everything (or one owner chosen via "Viewing"), owner sees own turfs, manager sees the owner's turfs
let focus = '';
const scopeOwner = () => !user ? null : user.role === 'admin' ? (focus || null) : user.role === 'owner' ? user.id : user.ownerId || null;
const inScope = (o) => { const k = scopeOwner(); return k == null || o == null || o === k; };
let _m = null;
const V = {
  _key: () => [user?.id, focus, db, db.grounds.length, db.bookings.length].map(String).join('|') + (db.grounds.map((g) => g.ownerId).join()),
  _all() { const k = this._key(); if (_m?.k !== k) { const grounds = db.grounds.filter((g) => inScope(g.ownerId)), ids = new Set(grounds.map((g) => g.id)); _m = { k, grounds, bookings: db.bookings.filter((b) => ids.has(b.groundId)) }; } return _m; },
  get grounds() { return this._all().grounds; },
  get active() { return this._all().grounds.filter((g) => g.active !== false); },
  get bookings() { return this._all().bookings; },
  get customers() { return db.customers.filter((c) => inScope(c.ownerId)); },
  get expenses() { return db.expenses.filter((x) => inScope(x.ownerId)); }
};
const solo = () => !db.users.some((u) => u.role === 'admin'); // single-owner install (no admin account)
const fullAccess = () => user?.role === 'admin' || (user?.role === 'owner' && solo());
const ownerName = (id) => db.users.find((u) => u.id === id)?.name || '';
const LOCKED = ['needCode', 'expired', 'clock'];
const isLocked = () => LOCKED.includes(LIC.status().state);
const save = () => { if (!isLocked()) { S.save(db); FX.topProgress(); } }; // an expired demo can no longer change any data

// ---------- helpers ----------
function toast(key, params, isErr) {
  const d = document.createElement('div');
  d.className = 'toast' + (isErr ? ' err' : '');
  d.dataset.i18n = key; d.dataset.i18nParams = JSON.stringify(params || {});
  d.textContent = t(key, params);
  $('#toasts').append(d);
  setTimeout(() => d.remove(), 3200);
  if (key !== 'notify.langChanged') FX.statusPop(isErr ? 'error' : 'success');
  if (['bookings.created', 'bookings.series', 'payments.recorded'].includes(key)) FX.confetti();
}
function setErr(form, name, key, params) {
  const el = $(`[data-err="${name}"]`, form); if (!el) return;
  if (key) { el.dataset.i18n = key; el.dataset.i18nParams = JSON.stringify(params || {}); el.textContent = t(key, params); }
  else { delete el.dataset.i18n; el.textContent = ''; }
}
const clearErrs = (form) => $$('[data-err]', form).forEach((e) => setErr(form, e.dataset.err, null));
function wireClear(form) { form.addEventListener('input', (e) => e.target.name && setErr(form, e.target.name, null)); }
function confirmDlg(titleKey, bodyKey, params) {
  return new Promise((res) => {
    const d = $('#confirmDlg');
    $('#confirmTitle').dataset.i18n = titleKey; $('#confirmTitle').textContent = t(titleKey);
    $('#confirmBody').dataset.i18n = bodyKey; $('#confirmBody').dataset.i18nParams = JSON.stringify(params || {}); $('#confirmBody').textContent = t(bodyKey, params);
    d.addEventListener('close', () => res(d.returnValue === 'yes'), { once: true });
    d.returnValue = ''; d.showModal();
  });
}
$$('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) d.close(); }));
const sportOptions = () => ['football', 'cricket', 'boxCricket', 'pickleball'].map((s) => `<option value="${s}" data-i18n="sports.${s}">${t('sports.' + s)}</option>`).join('');
const custName = (id) => db.customers.find((c) => c.id === id)?.name ?? '';
const logoSrc = () => db.business?.logo || 'assets/logo/logo.png';
function updateBrand() {
  const img = $('#brandImg'), mark = $('.logo-mark'), name = $('.brand [data-i18n], .brand [data-brand-name]');
  const on = !!user && !!db.business?.name;
  img.hidden = !on; mark.toggleAttribute('hidden', on); if (on) img.src = logoSrc();
  if (on) { name.removeAttribute('data-i18n'); name.dataset.brandName = '1'; name.textContent = db.business.name; } else if (!name.dataset.i18n) { name.dataset.i18n = 'app.name'; delete name.dataset.brandName; name.textContent = t('app.name'); }
}
const EMPTY_SVG = '<svg viewBox="0 0 120 90" fill="none" stroke="#17503A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="14" width="92" height="62" rx="8" fill="#FFF7E6"/><line x1="60" y1="14" x2="60" y2="76"/><circle cx="60" cy="45" r="11" stroke="#E8892B"/><rect x="14" y="30" width="16" height="30" stroke="#E8892B"/><rect x="90" y="30" width="16" height="30" stroke="#E8892B"/></svg>';
const empty = (msg) => `<div class="empty">${EMPTY_SVG}<p>${msg}</p></div>`;
const groundOf = (id) => db.grounds.find((g) => g.id === id);
const custOf = (id) => db.customers.find((c) => c.id === id);
const biz = () => db.business?.name || t('app.name');
const logIt = (key, params) => S.log(db, key, params, scopeOwner());
const shortMoney = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n));
const timeRange = (s) => `${fmtTime(s.start)} – ${fmtTime(s.end)}`;
const waBtn = (phone, text, key) => `<a class="btn small" target="_blank" rel="noopener" href="${esc(L.waLink(phone, text))}">${t(key)}</a>`;
function bars(vals, labels, hiIdx = -1) {
  const max = Math.max(1, ...vals);
  return `<div class="bars" role="img">${vals.map((v, i) => `<div title="${esc(fmtMoney(v))}"><small>${v ? shortMoney(v) : ''}</small><i class="${i === hiIdx ? 'hi' : ''}" style="height:${Math.round((v / max) * 100)}%"></i><small>${esc(labels[i])}</small></div>`).join('')}</div>`;
}
const wd = (ymd) => new Intl.DateTimeFormat(`${lang()}-IN-u-nu-latn`, { weekday: 'short', timeZone: L.TZ }).format(new Date(`${ymd}T12:00:00+05:30`));

// ---------- language switcher (visible on every screen) ----------
const LANG_BTNS = () => L.SUPPORTED_LANGS.map((c) => `<button type="button" data-lang="${c}" lang="${c}" aria-pressed="false">${L.LANG_NAMES[c]}</button>`).join('');
function buildLangSwitch() {
  // header switcher + one inside every form dialog (a modal blocks the header, and users must be able to switch mid-form)
  $('#langSwitch').innerHTML = LANG_BTNS();
  $$('dialog').forEach((d) => {
    if (d.id === 'confirmDlg') return;
    const box = document.createElement('div'); box.className = 'lang-switch in-dialog'; box.setAttribute('role', 'group');
    box.setAttribute('data-i18n-aria', 'lang.label'); box.innerHTML = LANG_BTNS(); d.prepend(box);
  });
  document.addEventListener('click', (e) => { const b = e.target.closest('.lang-switch [data-lang]'); if (b) changeLang(b.dataset.lang); });
  const sel = $('#settingsLang');
  sel.innerHTML = L.SUPPORTED_LANGS.map((c) => `<option value="${c}" lang="${c}">${L.LANG_NAMES[c]}</option>`).join('');
}
async function changeLang(code, { announce = true } = {}) {
  if (!L.validateLang(code)) return;
  await setLang(code);
  if (user) { user.preferredLanguage = code; save(); } // saved to profile
  S.setGuestLang(code);
  if (announce) toast('notify.langChanged', { name: L.LANG_NAMES[code] });
}
document.addEventListener('langchange', (e) => {
  $$('.lang-switch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === e.detail)));
  $('#settingsLang').value = e.detail;
  renderNav(); renderCurrent();
});

// ---------- routing ----------
const ROUTES = {
  '': { v: 'home', pub: true }, login: { v: 'login', pub: true }, register: { v: 'register', pub: true },
  onboarding: { v: 'onboarding', roles: ['owner'] },
  dashboard: { v: 'dashboard' }, board: { v: 'board' }, dues: { v: 'dues' }, bookings: { v: 'bookings' }, customers: { v: 'customers' },
  grounds: { v: 'grounds', roles: ['owner', 'admin'] }, admin: { v: 'admin', roles: ['admin'] }, reports: { v: 'reports', perm: 'reports' }, settings: { v: 'settings' }
};
const ICONS = {dashboard:'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>',bookings:'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>',customers:'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.8c1.8.7 3 2.3 3 5.2"/></svg>',grounds:'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M12 6v12"/><circle cx="12" cy="12" r="2.6"/></svg>',reports:'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',settings:'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>'};
ICONS.board = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>';
ICONS.dues = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M9 8h6M9 11h6M10 8c3 0 4 2 0 4l4 4"/></svg>';
// role-based access: owner = everything; manager = only what the owner allows
const can = (p) => !!user && (user.role === 'owner' || user.role === 'admin' || (user.role === 'manager' && user.active !== false && !!user.perms?.[p]));
ICONS.admin = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.2 7.6-8 9-4.8-1.4-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>';
const NAV = [['dashboard'], ['board'], ['bookings'], ['customers'], ['dues'], ['grounds'], ['reports'], ['admin'], ['settings']];
let view = 'home';

function route() {
  $('#acctField').hidden = !!db.users.length;
  const name = (location.hash.replace(/^#\/?/, '') || '');
  let r = ROUTES[name] || ROUTES[''];
  if (!user && !r.pub) { location.hash = db.users.length ? '#/login' : '#/register'; return; }
  if (!user && !db.users.length && name === 'login') { location.hash = '#/register'; return; }
  if (user && (name === 'login' || name === 'register' || name === '')) { location.hash = '#/dashboard'; return; }
  if (user && ((r.roles && !r.roles.includes(user.role)) || (r.perm && !can(r.perm)))) { location.hash = '#/dashboard'; return; }
  if (user?.role === 'owner' && !user.onboarded && name !== 'onboarding') { location.hash = '#/onboarding'; return; }
  view = r.v;
  if (view !== 'settings') delete $('#profileForm').dataset.init;
  $$('.view').forEach((s) => (s.hidden = s.id !== 'view-' + view));
  $('#nav').hidden = !user || view === 'onboarding';
  $('#logoutBtn').hidden = !user;
  renderNav(); updateBrand(); renderCurrent(); window.scrollTo(0, 0);
}
function renderNav() {
  if (!user) return;
  $('#nav').innerHTML = NAV.filter(([n]) => (!ROUTES[n].roles || ROUTES[n].roles.includes(user.role)) && (!ROUTES[n].perm || can(ROUTES[n].perm)))
    .map(([n]) => `<a href="#/${n}" ${view === n ? 'aria-current="page"' : ''}><span class="ic" aria-hidden="true">${ICONS[n]}</span><span>${t('nav.' + n)}</span></a>`).join('');
}
function renderCurrent() {
  renderFocus(); ({ admin: renderAdmin, board: renderBoard, dues: renderDues, dashboard: renderDashboard, grounds: renderGrounds, customers: renderCustomers, bookings: renderBookings, reports: renderReport, onboarding: renderOnbStep, settings: renderSettings }[view] || (() => {}))();
}

// ---------- auth ----------
async function login(u) {
  user = u; S.setSession(u.id);
  await changeLang(u.preferredLanguage || lang(), { announce: false }); // saved profile preference; if none, keep what they picked on the login page (and save it)
  route();
}
const blocked = (u) => u.role !== 'admin' && (u.active === false || (u.role === 'manager' && db.users.find((x) => x.id === u.ownerId)?.active === false));
$('#loginForm').addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target; clearErrs(f);
  const email = f.email.value.trim().toLowerCase(), pw = f.password.value;
  if (!email) return setErr(f, 'email', 'validation.required');
  if (!L.isEmail(email)) return setErr(f, 'email', 'validation.invalidEmail');
  if (!pw) return setErr(f, 'password', 'validation.required');
  const u = db.users.find((x) => x.email === email && x.password === pw);
  if (!u) return setErr(f, 'form', 'auth.invalidCredentials');
  if (blocked(u)) return setErr(f, 'form', 'staff.suspended');
  location.hash = '#/dashboard'; login(u);
});
$('#registerForm').addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target; clearErrs(f);
  const name = f.name.value.trim(), email = f.email.value.trim().toLowerCase(), pw = f.password.value; let bad = false;
  if (!name) { setErr(f, 'name', 'validation.required'); bad = true; }
  if (!email) { setErr(f, 'email', 'validation.required'); bad = true; } else if (!L.isEmail(email)) { setErr(f, 'email', 'validation.invalidEmail'); bad = true; } else if (db.users.some((u) => u.email === email)) { setErr(f, 'email', 'auth.emailTaken'); bad = true; }
  if (!pw) { setErr(f, 'password', 'validation.required'); bad = true; } else if (pw.length < 6) { setErr(f, 'password', 'settings.passwordShort'); bad = true; }
  if (bad) return;
  const asAdmin = !db.users.length && f.acct.value === 'admin';
  const u = { id: S.newId('u'), name, email, password: pw, role: asAdmin ? 'admin' : 'owner', active: true, preferredLanguage: lang(), onboarded: asAdmin };
  db.users.push(u); save(); f.reset(); login(u);
});
$('#logoutBtn').addEventListener('click', () => {
  user = null; S.setSession(null);
  // keep the interface in the language the user last used (also stored as guest preference)
  location.hash = '#/login'; route();
});

// ---------- onboarding wizard ----------
let onbStep = 1;
function renderOnbStep() {
  $$('.onb-step').forEach((s) => (s.hidden = Number(s.dataset.step) !== onbStep));
  const st = $('#onbStep'); st.dataset.i18n = 'onboarding.step'; st.dataset.i18nParams = JSON.stringify({ n: onbStep, total: 3 }); st.textContent = t('onboarding.step', { n: onbStep, total: 3 });
  const nx = $('#onbNext'); nx.dataset.i18n = onbStep === 3 ? 'common.finish' : 'common.next'; nx.textContent = t(nx.dataset.i18n);
  $('#onbBack').hidden = onbStep === 1;
  const f = $('#onbForm'); const n = L.generateHourlySlots(f.open.value, f.close.value, f.price.value).length;
  $('#onbPreview').dataset.i18n = 'onboarding.slotsPreview'; $('#onbPreview').dataset.i18nParams = JSON.stringify({ count: n }); $('#onbPreview').textContent = t('onboarding.slotsPreview', { count: n });
}
$('#onbBack').addEventListener('click', () => { onbStep = Math.max(1, onbStep - 1); renderOnbStep(); });
$('#onbForm').addEventListener('input', () => view === 'onboarding' && renderOnbStep());
$('#onbForm').addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target; clearErrs(f); let bad = false;
  if (onbStep === 1) {
    if (!f.businessName.value.trim()) { setErr(f, 'businessName', 'validation.required'); bad = true; }
    if (!L.isPhone(f.phone.value)) { setErr(f, 'phone', 'validation.invalidPhone'); bad = true; }
  } else if (onbStep === 2) {
    if (!f.groundName.value.trim()) { setErr(f, 'groundName', 'validation.required'); bad = true; }
    if (!(Number(f.price.value) > 0)) { setErr(f, 'price', 'validation.priceInvalid'); bad = true; }
  } else {
    if (!L.isTime(f.open.value)) { setErr(f, 'open', 'validation.invalidTime'); bad = true; }
    if (!L.isTime(f.close.value)) { setErr(f, 'close', 'validation.invalidTime'); bad = true; }
    if (!bad && L.toMin(f.close.value) <= L.toMin(f.open.value)) { setErr(f, 'close', 'validation.endAfterStart'); bad = true; }
  }
  if (bad) return;
  if (onbStep < 3) { onbStep++; return renderOnbStep(); }
  db.business = { ...db.business, name: f.businessName.value.trim(), phone: f.phone.value };
  db.grounds.push({ id: S.newId('g'), name: f.groundName.value.trim(), sport: f.sport.value, weekendPct: 0, active: true, ownerId: user.id, facilities: [], photos: [], address: '', size: '', about: '', slots: L.generateHourlySlots(f.open.value, f.close.value, f.price.value) });
  user.onboarded = true; save(); onbStep = 1; f.reset(); location.hash = '#/dashboard';
});
wireClear($('#onbForm')); wireClear($('#loginForm')); wireClear($('#registerForm'));

// ---------- dashboard ----------
const LEVELS = [0, 50, 150, 300, 600];
function gamify() {
  const act = V.bookings.filter((b) => !b.cancelled), collected = V.bookings.flatMap((b) => b.payments).reduce((x, p) => x + p.amount, 0);
  const vip = V.customers.some((c) => L.isVip(L.customerStats(V.bookings, c.id)));
  const spent = L.sumAmount(V.expenses);
  const xp = act.length * 10 + V.customers.length * 5 + Math.floor(collected / 200);
  const done = { first: act.length >= 1, ten: act.length >= 10, cash: collected >= 10000, crowd: V.customers.length >= 5, vip, weekly: act.some((b) => b.series), smart: spent > 0 && collected > spent };
  let lvl = 0; LEVELS.forEach((m, i) => { if (xp >= m) lvl = i; });
  return { xp, lvl, done };
}
let achvBoot = true;
function renderDashboard() {
  const today = L.todayIST();
  const active = V.bookings.filter((b) => !b.cancelled);
  const todays = active.filter((b) => b.date === today).length;
  const pending = active.reduce((s, b) => s + Math.max(0, L.balanceOf(b)), 0);
  const revenue = V.bookings.flatMap((b) => b.payments).filter((p) => L.istDateOf(p.at) === today).reduce((s, p) => s + p.amount, 0);
  const occ = L.occupancy(V.active, V.bookings, today);
  const w = $('#welcome'); w.dataset.i18n = 'dashboard.welcome'; w.dataset.i18nParams = JSON.stringify({ name: user.name }); w.textContent = t('dashboard.welcome', { name: user.name });
  $('#dashHero').innerHTML = `<div class="hero-dash"><div class="hero-top"><img class="biz-logo-lg" src="${esc(logoSrc())}" alt=""><div><h2>${esc(db.business.name || t('app.name'))}</h2><p>${esc(t('dashboard.welcome', { name: user.name }))}</p></div></div>
    <div class="hero-mid">${FX.ring(occ)}<div class="hero-act"><div class="hero-cap">${t('dashboard.occupancy')}</div><button class="btn primary" type="button" data-go="new">${t('dashboard.quickBook')}</button><a class="btn" href="#/board">${t('dashboard.openBoard')}</a></div></div></div>`;
  // quick-start quest (disappears when finished)
  const q = [[V.grounds.length > 0, 'quest.s1', '#/grounds'], [V.customers.length > 0, 'quest.s2', '#/customers'], [V.bookings.length > 0, 'quest.s3', '#/board']];
  const qd = q.filter((x) => x[0]).length;
  $('#quest').innerHTML = (qd === 3 || user.role !== 'owner') ? '' : `<div class="card quest"><div class="row between"><h3>${t('quest.title')}</h3><b>${t('quest.done', { done: qd })}</b></div><div class="pbar"><i style="--w:${Math.round((qd / 3) * 100)}%"></i></div>${q.map(([ok, k, href]) => `<div class="qrow ${ok ? 'done' : ''}"><span class="qdot">✓</span><span class="qt">${t(k)}</span>${ok ? '' : `<a class="btn small primary" href="${href}">${t('quest.go')}</a>`}</div>`).join('')}</div>`;
  const icon = ['<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#E8892B" stroke-width="2"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16"/></svg>'];
  $('#stats').innerHTML = [['dashboard.todayBookings', todays, 'int'], ['dashboard.pendingPayments', pending, 'money'], ...(can('reports') ? [['dashboard.todayRevenue', revenue, 'money']] : []), ['dashboard.occupancy', occ, 'pct']]
    .map(([k, v, kind]) => `<div class="stat"><div class="v" data-count="${v}" data-kind="${kind}">${kind === 'money' ? fmtMoney(v) : kind === 'pct' ? v + '%' : v}</div><div class="l">${t(k)}</div></div>`).join('');
  // achievements
  const G = gamify(), keys = ['first', 'ten', 'cash', 'crowd', 'vip', 'weekly', 'smart'];
  const fresh = keys.filter((k) => G.done[k] && !db.achieved.includes(k));
  const next = LEVELS[G.lvl + 1], base = LEVELS[G.lvl], pct = next ? Math.round(((G.xp - base) / (next - base)) * 100) : 100;
  $('#achv').innerHTML = user.role === 'owner' && (V.bookings.length || V.customers.length) ? `<div class="card"><h3>${t('ach.title')}</h3><div class="lvl"><div class="lvl-n">${G.lvl + 1}</div><div style="flex:1"><b>${t('ach.level', { n: G.lvl + 1, name: t(['ach.l1', 'ach.l2', 'ach.l3', 'ach.l4', 'ach.l5'][G.lvl]) })}</b><div class="pbar"><i style="--w:${pct}%"></i></div><div class="note">${next ? t('ach.xp', { xp: G.xp, next }) : t('ach.max')}</div></div></div>
    <div class="badges">${keys.map((k) => `<div class="bdg ${G.done[k] ? 'on' : 'off'} ${fresh.includes(k) ? 'fresh' : ''}"><div class="bi">${FX.BADGE_ICON[k]}</div>${t('ach.' + k)}</div>`).join('')}</div></div>` : '';
  if (fresh.length) { db.achieved.push(...fresh); S.save(db); if (!achvBoot) { FX.confetti(); toast('ach.unlocked', { name: t('ach.' + fresh[0]) }); } }
  achvBoot = false;
  const days = L.lastDays(7), vals = L.revenueByDay(V.bookings, days);
  $('#chart7').hidden = !can('reports');
  $('#chart7').innerHTML = bars(vals, days.map(wd), 6) + `<p class="note">${t('bookings.total')}: <b>${fmtMoney(vals.reduce((a, b) => a + b, 0))}</b></p>`;
  const top = V.customers.map((c) => ({ c, st: L.customerStats(V.bookings, c.id) })).filter((x) => x.st.count).sort((a, b) => b.st.spent - a.st.spent).slice(0, 3);
  $('#topCust').innerHTML = top.map(({ c, st }) => `<div class="item"><div class="top"><div class="title">${esc(c.name)} ${L.isVip(st) ? `<span class="badge vip">${t('customers.vip')}</span>` : ''}</div><div><b>${fmtMoney(st.spent)}</b></div></div><div class="meta">${t('customers.bookingsCount', { count: st.count })}</div></div>`).join('');
  const up = active.filter((b) => b.date >= today).sort((a, b) => a.date.localeCompare(b.date) || slotOf(a).start.localeCompare(slotOf(b).start)).slice(0, 5);
  $('#upcomingList').innerHTML = up.length ? up.map(bookingCard.bind(null, false)).join('') : empty(t('dashboard.noUpcoming'));
  FX.countUp($('#view-dashboard'));
}
$('#dashHero').addEventListener('click', (e) => { if (e.target.closest('[data-go=new]')) { if (!V.active.length || !V.customers.length) { location.hash = !V.active.length ? '#/grounds' : '#/customers'; return; } openBooking(); } });
const slotOf = (b) => groundOf(b.groundId)?.slots.find((s) => s.id === b.slotId) || { start: '00:00', end: '00:00' };

// ---------- availability board ----------
const bd = () => $('#boardDate');
function renderBoard() {
  if (!bd().value) bd().value = L.todayIST();
  const date = bd().value, occ = L.occupancy(V.active, V.bookings, date);
  const o = $('#boardOcc'); o.dataset.i18n = 'board.occupancy'; o.dataset.i18nParams = JSON.stringify({ pct: occ }); o.textContent = t('board.occupancy', { pct: occ });
  $('#boardOut').innerHTML = V.active.length ? V.active.map((g) => `<div class="board-g"><h3>${esc(g.name)} <span class="note">· ${t('sports.' + g.sport)}${g.weekendPct && L.isWeekend(date) ? ' · ' + t('grounds.weekendOn', { pct: g.weekendPct }) : ''}</span></h3><div class="slots">${
    [...g.slots].sort((a, b) => a.start.localeCompare(b.start)).map((sl) => {
      const b = V.bookings.find((x) => !x.cancelled && x.groundId === g.id && x.slotId === sl.id && x.date === date);
      if (!b) return `<button type="button" class="slotc free" data-bg="${g.id}" data-bs="${sl.id}"><b>${fmtTime(sl.start)}</b>${fmtMoney(L.priceFor(sl, date, g))}</button>`;
      return `<div class="slotc ${L.payStatus(b)}"><b>${fmtTime(sl.start)}</b>${esc(custName(b.customerId))}</div>`;
    }).join('')}</div></div>`).join('') : empty(t('grounds.noGrounds'));
}
bd().addEventListener('change', renderBoard);
$('#boardPrev').addEventListener('click', () => { bd().value = L.addDays(bd().value || L.todayIST(), -1); renderBoard(); });
$('#boardNext').addEventListener('click', () => { bd().value = L.addDays(bd().value || L.todayIST(), 1); renderBoard(); });
$('#boardToday').addEventListener('click', () => { bd().value = L.todayIST(); renderBoard(); });
$('#boardOut').addEventListener('click', (e) => { const b = e.target.closest('[data-bg]'); if (b) openBooking({ ground: b.dataset.bg, slot: b.dataset.bs, date: bd().value }); });

// ---------- dues ----------
function renderDues() {
  const rows = V.customers.map((c) => { const mine = V.bookings.filter((b) => b.customerId === c.id && !b.cancelled && L.balanceOf(b) > 0); return { c, n: mine.length, due: mine.reduce((s, b) => s + L.balanceOf(b), 0) }; }).filter((r) => r.due > 0).sort((a, b) => b.due - a.due);
  const tot = rows.reduce((s, r) => s + r.due, 0);
  const el = $('#duesTotal'); el.innerHTML = `<div class="v">${fmtMoney(tot)}</div><div class="l">${t('dashboard.pendingPayments')}</div>`;
  $('#duesList').innerHTML = rows.length ? rows.map(({ c, n, due }) => `<div class="item"><div class="top"><div><div class="title">${esc(c.name)}</div><div class="meta">${t('dues.bookingsPending', { count: n })} · ${esc(c.phone)}</div></div><b>${fmtMoney(due)}</b></div>
    <div class="acts">${waBtn(c.phone, t('wa.due', { name: c.name, amount: fmtMoney(due), biz: biz() }), 'dues.remind')}<a class="btn small" href="tel:${esc(c.phone)}">${t('customers.call')}</a></div></div>`).join('') : empty(t('dues.none'));
}

// ---------- grounds & slots ----------
let priceGround = null;
$('#groundList').addEventListener('click', userAdminClick);
$('#groundList').addEventListener('click', (e) => { const b = e.target.closest('[data-wk]'); if (!b) return; priceGround = groundOf(b.dataset.wk); const f = $('#priceForm'); clearErrs(f); f.pct.value = priceGround.weekendPct || 0; $('#priceGround').textContent = priceGround.name; $('#priceDlg').showModal(); });
$('#priceForm').addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target; clearErrs(f); const v = Number(f.pct.value);
  if (f.pct.value === '' || Number.isNaN(v) || v < 0 || v > 100) return setErr(f, 'pct', 'validation.amountPositive');
  priceGround.weekendPct = v; logIt('log.pricing', { name: priceGround.name }); save(); $('#priceDlg').close(); toast('grounds.pricingSaved'); renderGrounds();
});
const hashStr = (x) => [...String(x)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) >>> 0;
const minPrice = (g) => (g.slots.length ? Math.min(...g.slots.map((s) => s.price)) : 0);
const coverOf = (g) => g.photos?.[0] || FA.pitchSvg(hashStr(g.id));
const canEditG = (g) => user?.role === 'admin' || (user?.role === 'owner' && g.ownerId === user.id);
function renderGrounds() {
  $('#groundList').innerHTML = V.grounds.length ? V.grounds.map((g) => { const off = g.active === false, fac = g.facilities || [], p = minPrice(g); return `
    <div class="tcard ${off ? 'off' : ''}"><button type="button" class="tcover" data-turf="${g.id}" aria-label="${esc(g.name)}"><img src="${coverOf(g)}" alt=""><span class="pill ${off ? 'inactive' : 'active'}">${t(off ? 'turf.inactive' : 'turf.active')}</span>${g.photos?.length > 1 ? `<span class="pill cnt">${g.photos.length}</span>` : ''}</button>
    <div class="tbody"><div class="top"><div><div class="title">${esc(g.name)}</div><div class="meta">${t('sports.' + g.sport)}${g.size ? ' · ' + esc(g.size) : ''}${user.role === 'admin' && g.ownerId ? ' · ' + esc(ownerName(g.ownerId)) : ''}</div></div>${p ? `<div class="price">${fmtMoney(p)}<small>${t('turf.perHour')}</small></div>` : ''}</div>
    <div class="ficons">${fac.slice(0, 5).map((k) => `<span title="${esc(t('fac.' + k))}">${FA.FACILITIES[k]}</span>`).join('')}${fac.length > 5 ? `<span class="more">+${fac.length - 5}</span>` : ''}</div>
    <div class="meta">${t('grounds.slotsCount', { count: g.slots.length })} · ${g.weekendPct ? t('grounds.weekendOn', { pct: g.weekendPct }) : t('grounds.weekendOff')}</div>
    <div class="acts"><button class="btn small primary" data-turf="${g.id}">${t('turf.details')}</button><button class="btn small" data-gedit="${g.id}">${t('turf.edit')}</button><button class="btn small" data-slots="${g.id}">${t('grounds.configureSlots')}</button><button class="btn small" data-wk="${g.id}">${t('grounds.weekendPricing')}</button><button class="btn small" data-gtoggle="${g.id}">${t(off ? 'staff.activate' : 'staff.suspend')}</button><button class="btn small danger" data-delg="${g.id}">${t('common.delete')}</button></div></div></div>`; }).join('')
    : empty(t('grounds.noGrounds'));
}
// ----- turf create / edit (facilities, details, gallery) -----
let editG = null, gPhotos = [], gFac = new Set();
const renderFacTiles = () => { $('#gFacilities').innerHTML = FA.FKEYS.map((k) => `<button type="button" class="ftile ${gFac.has(k) ? 'on' : ''}" data-fk="${k}" aria-pressed="${gFac.has(k)}"><span>${FA.FACILITIES[k]}</span>${t('fac.' + k)}</button>`).join(''); };
const renderThumbs = () => { $('#gThumbs').innerHTML = gPhotos.map((src, i) => `<div class="gth"><img src="${src}" alt=""><button type="button" data-rmph="${i}" aria-label="Remove">×</button></div>`).join(''); };
function openGroundForm(g) {
  const owners = db.users.filter((u) => u.role === 'owner');
  if (user.role === 'admin' && !owners.length) return toast('admin.needOwner', {}, true);
  editG = g || null; const f = $('#groundForm'); f.reset(); clearErrs(f);
  const ti = $('#groundDlgTitle'); ti.dataset.i18n = g ? 'turf.edit' : 'grounds.create'; ti.textContent = t(ti.dataset.i18n);
  f.name.value = g?.name || ''; f.sport.value = g?.sport || 'football'; f.address.value = g?.address || ''; f.size.value = g?.size || ''; f.about.value = g?.about || ''; f.active.checked = g ? g.active !== false : true;
  gFac = new Set(g?.facilities || []); gPhotos = [...(g?.photos || [])]; renderFacTiles(); renderThumbs();
  $('#gOwnerField').hidden = user.role !== 'admin';
  if (user.role === 'admin') { $('#gOwner').innerHTML = owners.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join(''); $('#gOwner').value = g?.ownerId || focus || owners[0].id; }
  $('#groundDlg').showModal();
}
$('#newGroundBtn').addEventListener('click', () => openGroundForm());
$('#gFacilities').addEventListener('click', (e) => { const b = e.target.closest('[data-fk]'); if (!b) return; gFac.has(b.dataset.fk) ? gFac.delete(b.dataset.fk) : gFac.add(b.dataset.fk); b.classList.toggle('on'); b.setAttribute('aria-pressed', gFac.has(b.dataset.fk)); });
$('#gThumbs').addEventListener('click', (e) => { const b = e.target.closest('[data-rmph]'); if (!b) return; gPhotos.splice(Number(b.dataset.rmph), 1); renderThumbs(); });
$('#gPhotoFile').addEventListener('change', async (e) => {
  const files = [...e.target.files]; e.target.value = '';
  for (const file of files) {
    if (gPhotos.length >= 8) { toast('turf.maxPhotos', {}, true); break; }
    if (!file.type.startsWith('image/')) { toast('biz.logoBad', {}, true); continue; }
    try { gPhotos.push(await FA.shrinkPhoto(file)); renderThumbs(); } catch { toast('biz.logoBad', {}, true); }
  }
});
$('#groundForm').addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target; clearErrs(f);
  if (!f.name.value.trim()) return setErr(f, 'name', 'validation.required');
  const d = { name: f.name.value.trim(), sport: f.sport.value, address: f.address.value.trim(), size: f.size.value.trim(), about: f.about.value.trim(), facilities: [...gFac], photos: [...gPhotos], active: f.active.checked };
  if (editG) { if (!canEditG(editG)) return; Object.assign(editG, d); if (user.role === 'admin') editG.ownerId = f.gowner.value; }
  else db.grounds.push({ id: S.newId('g'), ...d, weekendPct: 0, slots: [], ownerId: user.role === 'admin' ? f.gowner.value : user.id });
  logIt('log.ground', { name: d.name }); save(); $('#groundDlg').close(); toast(editG ? 'turf.saved' : 'grounds.created'); renderCurrent();
});
// ----- turf details sheet (gallery + facilities + book) -----
let turfId = null;
function renderTurf() {
  const g = groundOf(turfId); if (!g) return;
  const photos = g.photos?.length ? g.photos : [FA.pitchSvg(hashStr(g.id))], fac = g.facilities || [], p = minPrice(g), pm = g.slots.length ? Math.max(...g.slots.map((s) => s.price)) : 0;
  const sl = [...g.slots].sort((a, b) => a.start.localeCompare(b.start)), off = g.active === false, can_ = !off && g.slots.length && (user.role !== 'manager' || true);
  $('#turfBody').innerHTML = `<div class="gal-wrap"><div class="gal" id="galScroll">${photos.map((src) => `<img src="${src}" alt="${esc(g.name)}">`).join('')}</div>
    <button type="button" class="round gal-back" data-close aria-label="Close">←</button>${canEditG(g) ? `<button type="button" class="round gal-edit" data-gedit="${g.id}" aria-label="${esc(t('turf.edit'))}">✎</button>` : ''}
    <span class="pill cnt gal-cnt" id="galCnt">1/${photos.length}</span></div>
    ${photos.length > 1 ? `<div class="gal-th">${photos.map((src, i) => `<button type="button" data-gal="${i}"><img src="${src}" alt=""></button>`).join('')}</div>` : (g.photos?.length ? '' : `<p class="note center">${t('turf.noPhotos')}</p>`)}
    <div class="tinfo"><div class="row between"><h2>${esc(g.name)}</h2><span class="pill ${off ? 'inactive' : 'active'} static">${t(off ? 'turf.inactive' : 'turf.active')}</span></div>
      ${g.address ? `<p class="muted taddr">📍 ${esc(g.address)}</p>` : ''}
      <div class="chips-s"><span>${t('sports.' + g.sport)}</span>${g.size ? `<span>${esc(g.size)}</span>` : ''}${sl.length ? `<span>${fmtTime(sl[0].start)} – ${fmtTime(sl[sl.length - 1].end)}</span>` : ''}${g.weekendPct ? `<span>${t('grounds.weekendOn', { pct: g.weekendPct })}</span>` : ''}</div>
      ${g.about ? `<h3>${t('turf.aboutHdr')}</h3><p>${esc(g.about)}</p>` : ''}
      <h3>${t('turf.facilities')}</h3>${fac.length ? `<div class="fgrid">${fac.map((k) => `<div class="fcell"><span>${FA.FACILITIES[k]}</span>${t('fac.' + k)}</div>`).join('')}</div>` : `<p class="note">${t('turf.noFacilities')}</p>`}</div>
    <div class="cta bar"><div class="cta-p">${p ? `<b>${fmtMoney(p)}${pm > p ? '+' : ''}</b><small>${t('turf.perHour')}</small>` : ''}</div>${can_ ? `<button type="button" class="cta-pill" data-bookturf="${g.id}"><span>${t('turf.bookNow')}</span><i>→</i></button>` : `<span class="note">${t(off ? 'turf.inactive' : 'grounds.noSlots')}</span>`}</div>`;
  const gs = $('#galScroll'); gs?.addEventListener('scroll', () => { const i = Math.round(gs.scrollLeft / gs.clientWidth); $('#galCnt').textContent = `${i + 1}/${photos.length}`; }, { passive: true });
}
function openTurf(id) { turfId = id; renderTurf(); $('#turfDlg').showModal(); }
$('#turfDlg').addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) return $('#turfDlg').close();
  const th = e.target.closest('[data-gal]'); if (th) { const gs = $('#galScroll'); gs.scrollTo({ left: gs.clientWidth * Number(th.dataset.gal), behavior: 'smooth' }); }
  const ed = e.target.closest('[data-gedit]'); if (ed) { $('#turfDlg').close(); openGroundForm(groundOf(ed.dataset.gedit)); }
  const bk = e.target.closest('[data-bookturf]'); if (bk) { $('#turfDlg').close(); if (!V.customers.length) { location.hash = '#/customers'; return; } openBooking({ ground: bk.dataset.bookturf }); }
});
document.addEventListener('langchange', () => { if ($('#turfDlg').open) renderTurf(); });
document.addEventListener('click', (e) => { const b = e.target.closest('[data-turf]'); if (b && !$('#turfDlg').contains(b)) openTurf(b.dataset.turf); });
let slotGround = null;
$('#groundList').addEventListener('click', async (e) => {
  const sb = e.target.closest('[data-slots]'), db_ = e.target.closest('[data-delg]'), ge = e.target.closest('[data-gedit]');
  if (ge) return openGroundForm(groundOf(ge.dataset.gedit));
  if (sb) { slotGround = groundOf(sb.dataset.slots); renderSlotDlg(); $('#slotForm').reset(); clearErrs($('#slotForm')); $('#slotsDlg').showModal(); }
  if (db_) {
    const g = groundOf(db_.dataset.delg);
    if (V.bookings.some((b) => b.groundId === g.id)) return toast('grounds.hasBookings', {}, true);
    if (await confirmDlg('grounds.deleteTitle', 'grounds.deleteBody', { name: g.name })) { db.grounds = db.grounds.filter((x) => x.id !== g.id); save(); toast('grounds.deleted'); renderGrounds(); }
  }
});
function renderSlotDlg() {
  $('#slotsGroundName').textContent = slotGround.name;
  const sorted = [...slotGround.slots].sort((a, b) => a.start.localeCompare(b.start));
  $('#slotList').innerHTML = sorted.length ? sorted.map((s) => `<div class="item"><div class="top"><div class="title">${fmtTime(s.start)} – ${fmtTime(s.end)}</div><div>${fmtMoney(s.price)}</div></div><div class="acts"><button type="button" class="btn small" data-rmslot="${s.id}">${t('common.delete')}</button></div></div>`).join('') : `<p class="muted">${t('grounds.noSlots')}</p>`;
}
$('#slotList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rmslot]'); if (!b) return;
  slotGround.slots = slotGround.slots.filter((s) => s.id !== b.dataset.rmslot); save(); renderSlotDlg(); renderGrounds(); toast('grounds.slotRemoved');
});
$('#slotForm').addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target; clearErrs(f); let bad = false;
  if (!L.isTime(f.start.value)) { setErr(f, 'start', 'validation.invalidTime'); bad = true; }
  if (!L.isTime(f.end.value)) { setErr(f, 'end', 'validation.invalidTime'); bad = true; }
  if (!(Number(f.price.value) > 0)) { setErr(f, 'price', 'validation.priceInvalid'); bad = true; }
  if (bad) return;
  if (L.toMin(f.end.value) <= L.toMin(f.start.value)) return setErr(f, 'end', 'validation.endAfterStart');
  const ns = { id: S.newId('s'), start: f.start.value, end: f.end.value, price: Number(f.price.value) };
  if (slotGround.slots.some((s) => L.slotsOverlap(s, ns))) return setErr(f, 'start', 'validation.slotOverlap');
  slotGround.slots.push(ns); save(); f.reset(); renderSlotDlg(); renderGrounds(); toast('grounds.slotAdded');
});
['groundForm', 'slotForm', 'customerForm', 'bookingForm', 'payForm', 'profileForm', 'pwForm', 'priceForm', 'expenseForm'].forEach((id) => wireClear($('#' + id)));

// ---------- customers ----------
function renderCustomers() {
  const q = $('#customerSearch').value.trim().toLowerCase();
  const list = V.customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q));
  $('#customerList').innerHTML = list.length ? list.map((c) => { const st = L.customerStats(V.bookings, c.id); return `
    <div class="item"><div class="top"><div class="title">${esc(c.name)} ${L.isVip(st) ? `<span class="badge vip" title="${esc(t('customers.vipHint', { count: L.VIP_MIN_BOOKINGS }))}">${t('customers.vip')}</span>` : ''}</div><div class="meta">${t('customers.spent')}: <b>${fmtMoney(st.spent)}</b></div></div>
    <div class="meta">${esc(c.phone)}${c.email ? ' · ' + esc(c.email) : ''}</div>
    <div class="meta">${t('customers.bookingsCount', { count: st.count })}</div>
    <div class="acts"><a class="btn small" target="_blank" rel="noopener" href="${esc(L.waLink(c.phone, ''))}">${t('customers.whatsapp')}</a><a class="btn small" href="tel:${esc(c.phone)}">${t('customers.call')}</a></div></div>`; }).join('')
    : empty(t('customers.noCustomers'));
}
$('#customerSearch').addEventListener('input', renderCustomers);
$('#newCustomerBtn').addEventListener('click', () => { const f = $('#customerForm'); f.reset(); clearErrs(f); $('#customerDlg').showModal(); });
$('#customerForm').addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target; clearErrs(f); let bad = false;
  if (!f.name.value.trim()) { setErr(f, 'name', 'validation.required'); bad = true; }
  if (!L.isPhone(f.phone.value)) { setErr(f, 'phone', 'validation.invalidPhone'); bad = true; }
  if (f.email.value && !L.isEmail(f.email.value)) { setErr(f, 'email', 'validation.invalidEmail'); bad = true; }
  if (bad) return;
  db.customers.push({ id: S.newId('c'), name: f.name.value.trim(), phone: f.phone.value.replace(/\s+/g, ''), email: f.email.value.trim(), ownerId: scopeOwner() }); logIt('log.customer', { name: f.name.value.trim() }); save();
  $('#customerDlg').close(); toast('customers.created'); renderCustomers();
});

// ---------- bookings & payments ----------
function waMsg(key, b) {
  const s = slotOf(b);
  return t(key, { name: custName(b.customerId), ground: groundOf(b.groundId)?.name ?? '', date: fmtDate(b.date), time: timeRange(s), amount: fmtMoney(Math.max(0, L.balanceOf(b))), total: fmtMoney(b.total), paid: fmtMoney(L.paidOf(b)), balance: fmtMoney(Math.max(0, L.balanceOf(b))), biz: biz(), no: rcptNo(b) });
}
const rcptNo = (b) => 'R-' + b.id.slice(-5).toUpperCase();
function bookingCard(actions, b) {
  const g = groundOf(b.groundId), s = slotOf(b), st = L.bookingStatus(b), ps = L.payStatus(b), bal = L.balanceOf(b);
  const acts = actions && !b.cancelled ? `<div class="acts">${bal > 0 ? `<button class="btn small primary" data-pay="${b.id}" title="${esc(t('tooltips.pay'))}" data-i18n-title="tooltips.pay">${t(L.paidOf(b) > 0 ? 'payments.recordRemaining' : 'payments.recordAdvance')}</button>` : `<span class="badge paid">${t('payments.noBalance')}</span>`}
    ${st === 'confirmed' && custOf(b.customerId) ? waBtn(custOf(b.customerId).phone, bal > 0 ? waMsg('wa.reminder', b) : waMsg('wa.confirm', b), 'bookings.remind') : ''}
    <button class="btn small" data-receipt="${b.id}">${t('bookings.receipt')}</button>
    ${st === 'confirmed' && can('cancel') ? `<button class="btn small" data-cancel="${b.id}" data-i18n-title="tooltips.cancelBooking" title="${esc(t('tooltips.cancelBooking'))}">${t('bookings.cancel')}</button>` : ''}</div>` : '';
  const pct = b.total > 0 ? Math.min(100, Math.round((L.paidOf(b) / b.total) * 100)) : 0;
  return `<div class="item st-${st}"><div class="top"><div><div class="title">${esc(g?.name ?? '')} · ${fmtTime(s.start)} – ${fmtTime(s.end)}</div><div class="meta">${fmtDate(b.date)} · ${esc(custName(b.customerId))}${b.people ? ' · ' + t('bk.players', { count: b.people }) : ''}</div></div>
    <div><span class="badge ${st}">${t('status.' + st)}</span> <span class="badge ${ps}">${t('pay.' + ps)}</span></div></div>
    <div class="meta">${t('bookings.total')}: ${fmtMoney(b.total)} · ${t('bookings.paid')}: ${fmtMoney(L.paidOf(b))} · ${t('bookings.balance')}: ${fmtMoney(Math.max(0, bal))}</div>
    <div class="sline"><div class="pbar ${ps}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="--w:${pct}%"></i></div><b>${pct}%</b></div>${acts}</div>`;
}
function renderBookings() {
  const fs = $('#fStatus').value, fd = $('#fDate').value;
  const list = V.bookings.filter((b) => (!fs || L.bookingStatus(b) === fs) && (!fd || b.date === fd)).sort((a, b) => b.date.localeCompare(a.date) || slotOf(b).start.localeCompare(slotOf(a).start));
  $('#bookingList').innerHTML = list.length ? list.map(bookingCard.bind(null, true)).join('') : empty(t('bookings.noBookings'));
}
$('#fStatus').addEventListener('change', renderBookings); $('#fDate').addEventListener('change', renderBookings);

const bkF = () => $('#bookingForm');
function fillBookingSelects() {
  const f = bkF(), gv = f.ground.value, cv = f.customer.value, rv = f.repeat.value || '1';
  f.ground.innerHTML = `<option value="" data-i18n="bookings.selectGround">${t('bookings.selectGround')}</option>` + V.active.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('');
  f.customer.innerHTML = `<option value="" data-i18n="bookings.selectCustomer">${t('bookings.selectCustomer')}</option>` + V.customers.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  f.repeat.innerHTML = [1, 4, 8, 12].map((n) => `<option value="${n}">${n === 1 ? t('bookings.repeatNone') : t('bookings.repeatWeeks', { count: n })}</option>`).join('');
  f.ground.value = gv; f.customer.value = cv; f.repeat.value = rv; fillSlotSelect();
}
function fillSlotSelect() {
  const f = bkF(), sv = f.slot.value, g = groundOf(f.ground.value);
  f.slot.innerHTML = `<option value="" data-i18n="bookings.selectSlot">${t('bookings.selectSlot')}</option>` + (g ? [...g.slots].sort((a, b) => a.start.localeCompare(b.start)).map((s) => `<option value="${s.id}">${timeRange(s)} · ${fmtMoney(f.date.value ? L.priceFor(s, f.date.value, g) : s.price)}</option>`).join('') : '');
  f.slot.value = sv; updatePrice();
}
function _updatePrice() {
  const f = bkF(), g = groundOf(f.ground.value), s = g?.slots.find((x) => x.id === f.slot.value), el = $('#bkPrice');
  if (!s || !f.date.value) { el.textContent = ''; el.removeAttribute('data-i18n'); return; }
  const price = L.priceFor(s, f.date.value, g), wk = price !== s.price;
  el.textContent = t('bookings.pricePreview', { price: fmtMoney(price) }) + (wk ? ' · ' + t('bookings.weekendApplied', { pct: g.weekendPct }) : '');
}
function updatePrice() { _updatePrice(); renderBookingUI(); }
// ----- "Book Your Slot": month calendar, slot chips, number of people -----
let calMonth = L.todayIST().slice(0, 7);
const PEOPLE = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
function renderBookingUI() {
  const f = bkF(), loc = lang() + '-IN', today = L.todayIST(), g = groundOf(f.ground.value), sel = f.date.value;
  $('#bkGroundChips').innerHTML = V.active.map((x) => `<button type="button" class="chip-b ${f.ground.value === x.id ? 'on' : ''}" data-bkg="${x.id}">${esc(x.name)}</button>`).join('');
  const [y, m] = calMonth.split('-').map(Number), fmt = (o, d) => new Intl.DateTimeFormat(loc, { ...o, timeZone: 'UTC' }).format(d);
  $('#calTitle').textContent = fmt({ month: 'long', year: 'numeric' }, new Date(Date.UTC(y, m - 1, 1)));
  $('#calWeek').innerHTML = [0, 1, 2, 3, 4, 5, 6].map((i) => `<span>${fmt({ weekday: 'short' }, new Date(Date.UTC(2024, 0, 7 + i)))}</span>`).join('');
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  $('#calGrid').innerHTML = '<i></i>'.repeat(lead) + Array.from({ length: days }, (_, i) => { const d = `${calMonth}-${String(i + 1).padStart(2, '0')}`, past = d < today; return `<button type="button" class="cd ${d === sel ? 'on' : ''} ${d === today ? 'today' : ''}" data-d="${d}" ${past ? 'disabled' : ''}>${i + 1}</button>`; }).join('');
  $('#bkSlotChips').innerHTML = g ? [...g.slots].sort((a, b) => a.start.localeCompare(b.start)).map((sl) => { const taken = sel && L.isSlotTaken(V.bookings, g.id, sl.id, sel); return `<button type="button" class="chip-b ${f.slot.value === sl.id ? 'on' : ''} ${taken ? 'taken' : ''}" data-bks="${sl.id}" ${taken ? 'disabled' : ''}>${timeRange(sl)}<small>${fmtMoney(sel ? L.priceFor(sl, sel, g) : sl.price)}</small></button>`; }).join('') || `<p class="note">${t('bookings.noSlotsForGround')}</p>` : `<p class="note">${t('bookings.selectGround')}</p>`;
  $('#bkPeople').innerHTML = PEOPLE.map((n) => `<button type="button" class="chip-b ${String(n) === f.people.value ? 'on' : ''}" data-pp="${n}">${n}</button>`).join('');
}
$('#bookingDlg').addEventListener('click', (e) => {
  const f = bkF(), q = (a) => e.target.closest(a);
  if (q('[data-bkg]')) { f.ground.value = q('[data-bkg]').dataset.bkg; f.slot.value = ''; fillSlotSelect(); }
  else if (q('[data-d]')) { f.date.value = q('[data-d]').dataset.d; calMonth = f.date.value.slice(0, 7); fillSlotSelect(); }
  else if (q('[data-bks]')) { f.slot.value = q('[data-bks]').dataset.bks; updatePrice(); }
  else if (q('[data-pp]')) { const v = q('[data-pp]').dataset.pp; f.people.value = f.people.value === v ? '' : v; renderBookingUI(); }
  else if (q('#calPrev') || q('#calNext')) { const [y, m] = calMonth.split('-').map(Number), n = new Date(Date.UTC(y, m - 1 + (q('#calNext') ? 1 : -1), 1)); calMonth = n.toISOString().slice(0, 7); renderBookingUI(); }
});
$('#bkGround').addEventListener('change', () => { bkF().slot.value = ''; fillSlotSelect(); });
bkF().slot.addEventListener('change', updatePrice); bkF().date.addEventListener('change', () => { if (bkF().date.value) calMonth = bkF().date.value.slice(0, 7); fillSlotSelect(); });
document.addEventListener('langchange', () => { if ($('#bookingDlg').open) fillBookingSelects(); if ($('#slotsDlg').open) renderSlotDlg(); if ($('#receiptDlg').open && rcptBooking) renderReceipt(); }); // relabel options; selections preserved
function openBooking(pre = {}) {
  const f = bkF(); f.reset(); clearErrs(f); f.date.value = pre.date || L.todayIST(); calMonth = f.date.value.slice(0, 7); f.people.value = ''; fillBookingSelects();
  if (pre.ground) { f.ground.value = pre.ground; fillSlotSelect(); f.slot.value = pre.slot || ''; updatePrice(); }
  f.discount.closest('.field').hidden = !can('discount');
  $('#bookingDlg').showModal();
}
$('#newBookingBtn').addEventListener('click', () => openBooking());
bkF().addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target; clearErrs(f); let bad = false;
  for (const n of ['ground', 'date', 'slot', 'customer']) if (!f[n].value) { setErr(f, n, 'validation.required'); bad = true; }
  if (bad) return;
  const g = groundOf(f.ground.value), s = g?.slots.find((x) => x.id === f.slot.value);
  if (!s) return setErr(f, 'slot', 'bookings.noSlotsForGround');
  const weeks = Number(f.repeat.value) || 1;
  if (weeks === 1 && L.isSlotTaken(V.bookings, g.id, s.id, f.date.value)) return setErr(f, 'slot', 'bookings.slotTaken');
  const price = L.priceFor(s, f.date.value, g);
  const disc = !can('discount') || f.discount.value === '' ? 0 : Number(f.discount.value);
  if (disc < 0 || Number.isNaN(disc)) return setErr(f, 'discount', 'validation.amountPositive');
  if (disc > price) return setErr(f, 'discount', 'bookings.discountExceeds');
  const total = price - disc;
  const adv = f.advance.value === '' ? 0 : Number(f.advance.value);
  if (adv < 0 || Number.isNaN(adv)) return setErr(f, 'advance', 'validation.amountPositive');
  if (adv > total) return setErr(f, 'advance', 'validation.amountExceeds', { max: fmtMoney(total) });
  const now = new Date().toISOString(); let made = 0, skipped = 0;
  for (let i = 0; i < weeks; i++) {
    const date = L.addDays(f.date.value, 7 * i);
    if (L.isSlotTaken(V.bookings, g.id, s.id, date)) { skipped++; continue; }
    db.bookings.push({ id: S.newId('b'), groundId: g.id, slotId: s.id, customerId: f.customer.value, date, total, discount: disc, people: f.people.value ? Number(f.people.value) : undefined, cancelled: false, createdAt: now, series: weeks > 1 ? now : undefined,
      payments: adv > 0 && made === 0 ? [{ id: S.newId('p'), amount: adv, method: 'cash', at: now }] : [] });
    made++;
  }
  if (!made) return setErr(f, 'slot', 'bookings.slotTaken');
  logIt(weeks > 1 ? 'log.series' : 'log.booking', weeks > 1 ? { count: made, name: custName(f.customer.value), ground: g.name } : { name: custName(f.customer.value), ground: g.name, date: f.date.value });
  save(); $('#bookingDlg').close();
  if (weeks > 1) { toast('bookings.series', { count: made }); if (skipped) setTimeout(() => toast('bookings.skipped', { count: skipped }, true), 400); } else toast('bookings.created');
  renderCurrent();
});

// ---------- receipt ----------
let rcptBooking = null;
function renderReceipt() {
  const b = rcptBooking, s = slotOf(b), c = custOf(b.customerId), pay = b.payments;
  $('#receiptBody').innerHTML = `<div class="rcpt"><img class="biz-logo-lg brand-big" src="${esc(logoSrc())}" alt=""><h3>${esc(biz())}</h3><p class="muted">${t('receipt.title')} · ${t('receipt.no')} ${rcptNo(b)}</p>
    <div class="kv"><span class="muted">${t('bookings.customer')}</span><b>${esc(c?.name ?? '')}</b></div>
    <div class="kv"><span class="muted">${t('bookings.ground')}</span><b>${esc(groundOf(b.groundId)?.name ?? '')}</b></div>
    <div class="kv"><span class="muted">${t('bookings.date')}</span><b>${fmtDate(b.date)} · ${timeRange(s)}</b></div>
    ${b.discount ? `<div class="kv"><span class="muted">${t('bookings.discountLine')}</span><b>− ${fmtMoney(b.discount)}</b></div>` : ''}
    <div class="kv"><span class="muted">${t('bookings.total')}</span><b>${fmtMoney(b.total)}</b></div>
    <div class="kv"><span class="muted">${t('bookings.paid')}</span><b>${fmtMoney(L.paidOf(b))}</b></div>
    <div class="kv"><span class="muted">${t('bookings.balance')}</span><b>${fmtMoney(Math.max(0, L.balanceOf(b)))}</b></div>
    ${pay.length ? `<h3>${t('receipt.payments')}</h3>${pay.map((p) => `<div class="kv"><span class="muted">${fmtDateTime(p.at)} · ${t('payments.' + p.method)}</span><b>${fmtMoney(p.amount)}</b></div>`).join('')}` : ''}</div>`;
  $('#receiptWa').href = L.waLink(c?.phone ?? '', waMsg('wa.receipt', b));
}
$('#bookingList').addEventListener('click', (e) => { const r = e.target.closest('[data-receipt]'); if (!r) return; rcptBooking = V.bookings.find((x) => x.id === r.dataset.receipt); renderReceipt(); $('#receiptDlg').showModal(); });
$('#receiptPrint').addEventListener('click', () => { if (native) return shareText(t('receipt.title'), $('#receiptBody').innerText); document.body.classList.add('print-receipt'); window.print(); });
window.addEventListener('afterprint', () => document.body.classList.remove('print-receipt'));
let payBooking = null;
$('#bookingList').addEventListener('click', async (e) => {
  const p = e.target.closest('[data-pay]'), c = e.target.closest('[data-cancel]');
  if (p) {
    payBooking = V.bookings.find((b) => b.id === p.dataset.pay); const f = $('#payForm'); f.reset(); clearErrs(f); renderPayDlg(); $('#payDlg').showModal();
  }
  if (c && can('cancel')) {
    const b = V.bookings.find((x) => x.id === c.dataset.cancel);
    if (await confirmDlg('bookings.cancelTitle', 'bookings.cancelBody', { name: custName(b.customerId) })) { b.cancelled = true; logIt('log.cancel', { name: custName(b.customerId) }); save(); toast('bookings.cancelled'); renderBookings(); }
  }
});
function renderPayDlg() {
  const key = L.paidOf(payBooking) > 0 ? 'payments.recordRemaining' : 'payments.recordAdvance';
  const ti = $('#payTitle'); ti.dataset.i18n = key; ti.textContent = t(key);
  const bl = $('#payBalance'); bl.dataset.i18n = 'payments.balanceDue'; bl.dataset.i18nParams = JSON.stringify({ amount: fmtMoney(L.balanceOf(payBooking)) }); bl.textContent = t('payments.balanceDue', { amount: fmtMoney(L.balanceOf(payBooking)) });
}
document.addEventListener('langchange', () => { if ($('#payDlg').open && payBooking) renderPayDlg(); });
$('#payForm').addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target; clearErrs(f);
  const amt = Number(f.amount.value), bal = L.balanceOf(payBooking);
  if (!(amt > 0)) return setErr(f, 'amount', 'validation.amountPositive');
  if (amt > bal) return setErr(f, 'amount', 'validation.amountExceeds', { max: fmtMoney(bal) });
  payBooking.payments.push({ id: S.newId('p'), amount: amt, method: f.method.value, at: new Date().toISOString() }); logIt('log.payment', { amount: amt, name: custName(payBooking.customerId) }); save();
  $('#payDlg').close(); toast('payments.recorded'); renderCurrent();
});

// ---------- reports ----------
const rf = () => $('#reportForm');
function monthRange() { const t0 = L.todayIST(); return [t0.slice(0, 8) + '01', t0]; }
let renderReport = function () {
  const f = rf(); if (!f.from.value) [f.from.value, f.to.value] = monthRange();
  const rows = V.bookings.filter((b) => !b.cancelled && b.date >= f.from.value && b.date <= f.to.value).sort((a, b) => a.date.localeCompare(b.date));
  const billed = rows.reduce((s, b) => s + b.total, 0), paid = rows.reduce((s, b) => s + L.paidOf(b), 0);
  const gen = t('reports.generatedOn', { date: fmtDateTime(new Date().toISOString()) });
  const hdr = [['date', 'bookings.date'], ['ground', 'bookings.ground'], ['slot', 'bookings.slot'], ['cust', 'bookings.customer'], ['st', 'bookings.status'], ['tot', 'bookings.total'], ['paid', 'bookings.paid'], ['bal', 'bookings.balance']];
  $('#reportOut').innerHTML = `
    <div class="print-title"><h1>${esc(db.business.name)} — ${t('reports.title')}</h1></div>
    <p class="muted">${fmtDate(f.from.value)} – ${fmtDate(f.to.value)} · ${esc(gen)}</p>
    <div class="stats">${[['reports.bookingsCount', rows.length], ['reports.billed', fmtMoney(billed)], ['reports.collected', fmtMoney(paid)], ['reports.outstanding', fmtMoney(billed - paid)]].map(([k, v]) => `<div class="stat"><div class="v">${esc(v)}</div><div class="l">${t(k)}</div></div>`).join('')}</div>
    <h2></h2>${rows.length ? `<table><thead><tr>${hdr.map(([, k]) => `<th>${t(k)}</th>`).join('')}</tr></thead><tbody>${rows.map((b) => {
      const s = slotOf(b), st = L.bookingStatus(b); const cells = [fmtDate(b.date), groundOf(b.groundId)?.name ?? '', `${fmtTime(s.start)} – ${fmtTime(s.end)}`, custName(b.customerId), t('status.' + st), fmtMoney(b.total), fmtMoney(L.paidOf(b)), fmtMoney(L.balanceOf(b))];
      return `<tr>${cells.map((c, i) => `<td data-label="${esc(t(hdr[i][1]))}">${esc(c)}</td>`).join('')}</tr>`; }).join('')}</tbody></table>` : `<p class="muted">${t('reports.noData')}</p>`}`;
};

function renderInsights() {
  const f = rf(), inR = (d) => d >= f.from.value && d <= f.to.value;
  const rows = V.bookings.filter((b) => !b.cancelled && inR(b.date));
  const collected = V.bookings.flatMap((b) => b.payments).filter((p) => inR(L.istDateOf(p.at))).reduce((a, p) => a + p.amount, 0);
  const exps = V.expenses.filter((x) => inR(x.date)).sort((a, b) => b.date.localeCompare(a.date)), spent = L.sumAmount(exps);
  const days = L.lastDays(14, f.to.value), vals = L.revenueByDay(V.bookings, days);
  const peak = L.peakHours(rows, (b) => slotOf(b).start), pmax = Math.max(0, ...peak.map((x) => x[1]));
  $('#insightsOut').innerHTML = `<div class="stats">${[['reports.collected', fmtMoney(collected)], ['insights.expenses', fmtMoney(spent)], ['insights.profit', fmtMoney(collected - spent)]].map(([k, v]) => `<div class="stat"><div class="v">${esc(v)}</div><div class="l">${t(k)}</div></div>`).join('')}</div>
    <h3>${t('insights.collection')}</h3><div class="card">${bars(vals, days.map((d) => d.slice(8)))}</div>
    <h3>${t('insights.peak')}</h3><div class="card">${peak.length ? bars(peak.map((x) => x[1]), peak.map((x) => fmtTime(x[0] + ':00')), peak.findIndex((x) => x[1] === pmax)).replace(/title="[^"]*"/g, '') : `<p class="muted">${t('insights.noData')}</p>`}</div>`;
  $('#expenseList').innerHTML = exps.length ? exps.map((x) => `<div class="item"><div class="top"><div><div class="title">${t('expense.' + x.category)}</div><div class="meta">${fmtDate(x.date)}${x.note ? ' · ' + esc(x.note) : ''}</div></div><div><b>${fmtMoney(x.amount)}</b></div></div><div class="acts"><button class="btn small" data-delx="${x.id}">${t('common.delete')}</button></div></div>`).join('') : empty(t('insights.noExpenses'));
}
const _renderReport = renderReport;
renderReport = () => { _renderReport(); renderInsights(); };
rf().addEventListener('submit', (e) => { e.preventDefault(); renderReport(); });
$('#newExpenseBtn').addEventListener('click', () => { const x = $('#expenseForm'); x.reset(); clearErrs(x); x.date.value = L.todayIST(); $('#expenseDlg').showModal(); });
$('#expenseForm').addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target; clearErrs(f); let bad = false;
  if (!(Number(f.amount.value) > 0)) { setErr(f, 'amount', 'validation.amountPositive'); bad = true; }
  if (!f.date.value) { setErr(f, 'date', 'validation.required'); bad = true; }
  if (bad) return;
  db.expenses.push({ id: S.newId('x'), date: f.date.value, category: f.category.value, amount: Number(f.amount.value), note: f.note.value.trim(), ownerId: scopeOwner() });
  logIt('log.expense', { amount: Number(f.amount.value) }); save(); $('#expenseDlg').close(); toast('insights.expenseAdded'); renderReport();
});
$('#expenseList').addEventListener('click', (e) => { const b = e.target.closest('[data-delx]'); if (!b) return; db.expenses = db.expenses.filter((x) => x.id !== b.dataset.delx); save(); toast('insights.expenseDeleted'); renderReport(); });
$('#pdfBtn').addEventListener('click', () => { renderReport(); if (native) return shareText(t('reports.title'), $('#reportOut').innerText); window.print(); }); // "Save as PDF" in the print dialog embeds the active Devanagari font

// ---------- settings ----------
function renderSettings() {
  const f = $('#profileForm'); if (!f.dataset.init) { f.name.value = user.name; f.dataset.init = '1'; } // don't overwrite unsaved edits on language switch
  $('#settingsLang').value = lang();
  $('#storageNote').dataset.kind = S.storageKind;
  const owner = user.role === 'owner', adm = user.role === 'admin', fa = fullAccess(); $('#backupCard').hidden = !fa; $('#activityCard').hidden = !(owner || adm); $('#bizForm').hidden = !fa; $('#staffForm').hidden = !owner;
  if (owner || adm) {
    const bf = $('#bizForm'); if (!bf.dataset.init) { bf.bname.value = db.business.name || ''; bf.bphone.value = db.business.phone || ''; bf.dataset.init = '1'; }
    $('#bizPreview').src = logoSrc();
    const staff = db.users.filter((u) => u.role === 'manager' && u.ownerId === user.id);
    $('#staffList').innerHTML = staff.length ? staff.map(mgrRow).join('') : `<p class="note">${t('staff.none')}</p>`;
  }
  const myLog = db.log.filter((l) => l.o == null || inScope(l.o));
  $('#activityList').innerHTML = myLog.length ? myLog.slice(0, 12).map((l) => { const p = { ...l.params }; if ('amount' in p) p.amount = fmtMoney(p.amount); if ('date' in p) p.date = fmtDate(p.date); return `<div class="kv"><span>${esc(t(l.key, p))}</span><span class="muted">${fmtDateTime(l.at)}</span></div>`; }).join('') : `<p class="muted">${t('settings.noActivity')}</p>`;
}
const busy = async (btn, fn) => { btn.classList.add('busy'); FX.statusPop('progress'); try { return await fn(); } finally { btn.classList.remove('busy'); FX.hidePop(); } };
$('#bizForm').addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target; clearErrs(f);
  if (!f.bname.value.trim()) return setErr(f, 'bname', 'validation.required');
  if (f.bphone.value && !L.isPhone(f.bphone.value)) return setErr(f, 'bphone', 'validation.invalidPhone');
  db.business.name = f.bname.value.trim(); db.business.phone = f.bphone.value.trim(); save(); updateBrand(); toast('biz.saved');
});
$('#logoFile').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  if (!file.type.startsWith('image/')) return toast('biz.logoBad', {}, true);
  try {
    const img = await createImageBitmap(file), k = Math.min(1, 256 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    db.business.logo = c.toDataURL('image/png'); save(); updateBrand(); renderSettings(); toast('biz.saved');
  } catch { toast('biz.logoBad', {}, true); }
});
$('#logoRemove').addEventListener('click', () => { db.business.logo = ''; save(); updateBrand(); renderSettings(); toast('biz.saved'); });
$('#staffForm').addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target; clearErrs(f); let bad = false;
  const name = f.sname.value.trim(), email = f.semail.value.trim().toLowerCase(), pw = f.spw.value;
  if (!name) { setErr(f, 'sname', 'validation.required'); bad = true; }
  if (!email) { setErr(f, 'semail', 'validation.required'); bad = true; } else if (!L.isEmail(email)) { setErr(f, 'semail', 'validation.invalidEmail'); bad = true; } else if (db.users.some((u) => u.email === email)) { setErr(f, 'semail', 'auth.emailTaken'); bad = true; }
  if (pw.length < 6) { setErr(f, 'spw', 'settings.passwordShort'); bad = true; }
  if (bad) return;
  db.users.push({ id: S.newId('u'), name, email, password: pw, role: 'manager', ownerId: user.id, perms: { discount: !!f.pdiscount.checked, cancel: !!f.pcancel.checked, reports: !!f.preports.checked }, active: true, preferredLanguage: lang(), onboarded: true }); logIt('log.manager', { name }); save(); f.reset(); renderSettings(); toast('staff.added');
});
const PERMS = ['discount', 'cancel', 'reports'];
const mgrRow = (u) => `<div class="mgr ${u.active === false ? 'off' : ''}"><div class="row between"><span><b>${esc(u.name)}</b> <span class="muted">· ${esc(u.email)}</span></span><span class="chip">${t(u.active === false ? 'staff.suspendedTag' : 'roles.manager')}</span></div>
  <div class="perms">${PERMS.map((k) => `<label class="chk"><input type="checkbox" data-perm="${k}" data-uid="${u.id}" ${u.perms?.[k] ? 'checked' : ''}> ${t('staff.perm.' + k)}</label>`).join('')}</div>
  <div class="acts"><input type="password" class="mini" data-pwfor="${u.id}" placeholder="${esc(t('staff.newPw'))}" autocomplete="new-password"><button class="btn small" type="button" data-setpw="${u.id}">${t('staff.setPw')}</button><button class="btn small" type="button" data-grant="${u.id}">${t('admin.grantAll')}</button><button class="btn small" type="button" data-toggle="${u.id}">${t(u.active === false ? 'staff.activate' : 'staff.suspend')}</button><button class="btn small" type="button" data-delstaff="${u.id}">${t('common.delete')}</button></div></div>`;
// who may change whom: admin → anyone; owner → own managers only
const canManage = (u) => !!u && ((user?.role === 'admin' && u.role !== 'admin') || (user?.role === 'owner' && u.role === 'manager' && u.ownerId === user.id));
async function userAdminClick(e) {
  const d = e.target.closest('[data-delstaff]'), tg = e.target.closest('[data-toggle]'), sp = e.target.closest('[data-setpw]'), gr = e.target.closest('[data-grant]'), dow = e.target.closest('[data-delowner]'), gt = e.target.closest('[data-gtoggle]'), fo = e.target.closest('[data-focus]');
  if (fo && user?.role === 'admin') { focus = fo.dataset.focus; location.hash = '#/dashboard'; route(); return; }
  if (gt) { const g = groundOf(gt.dataset.gtoggle); if (g && (user.role === 'admin' || g.ownerId === user.id)) { g.active = g.active === false; logIt('log.ground', { name: g.name }); save(); toast(g.active ? 'turf.nowActive' : 'turf.nowInactive'); renderCurrent(); } return; }
  const uid = (d || tg || sp || gr || dow)?.dataset; if (!uid) return;
  const u = db.users.find((x) => x.id === (uid.delstaff || uid.toggle || uid.setpw || uid.grant || uid.delowner)); if (!canManage(u)) return;
  if (d) db.users = db.users.filter((x) => x.id !== u.id);
  else if (dow) {
    if (db.grounds.some((g) => g.ownerId === u.id)) return toast('admin.delOwnerBlocked', {}, true);
    if (!(await confirmDlg('admin.delOwnerTitle', 'admin.delOwnerBody', { name: u.name }))) return;
    db.users = db.users.filter((x) => x.id !== u.id && x.ownerId !== u.id);
  } else if (tg) u.active = u.active === false;
  else if (gr) { u.perms = { discount: true, cancel: true, reports: true }; toast('admin.granted'); }
  else if (sp) { const inp = $(`[data-pwfor="${u.id}"]`); if (inp.value.length < 6) return toast('settings.passwordShort', {}, true); u.password = inp.value; inp.value = ''; save(); return toast('staff.pwSet'); }
  save(); renderCurrent();
}
function userPermChange(e) {
  const c = e.target.closest('[data-perm]'); if (!c) return;
  const u = db.users.find((x) => x.id === c.dataset.uid); if (!canManage(u)) return; u.perms = { ...u.perms, [c.dataset.perm]: c.checked }; save(); toast('staff.saved');
}
['#staffList', '#adminOwners'].forEach((id) => { $(id).addEventListener('click', userAdminClick); $(id).addEventListener('change', userPermChange); });

// ---------- admin panel ----------
const adminOpen = new Set();
function renderFocus() {
  const b = $('#focusBar'), on = user?.role === 'admin' && focus;
  b.hidden = !on; if (on) b.innerHTML = `<span>${esc(t('admin.viewingOwner', { name: ownerName(focus) }))}</span><button class="btn small" type="button" data-exitfocus>${t('admin.exitView')}</button>`;
}
$('#focusBar').addEventListener('click', (e) => { if (e.target.closest('[data-exitfocus]')) { focus = ''; renderCurrent(); } });
const sumPaid = (bs) => bs.flatMap((b) => b.payments).reduce((a, p) => a + p.amount, 0);
function renderAdmin() {
  const owners = db.users.filter((u) => u.role === 'owner'), mgrs = db.users.filter((u) => u.role === 'manager');
  $('#adminFocus').innerHTML = `<option value="">${t('admin.allOwners')}</option>` + owners.map((o) => `<option value="${o.id}" ${focus === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('');
  const act = db.bookings.filter((b) => !b.cancelled), due = act.reduce((a, b) => a + Math.max(0, L.balanceOf(b)), 0);
  $('#adminStats').innerHTML = [['admin.s.owners', owners.length, 'int'], ['admin.s.managers', mgrs.length, 'int'], ['admin.s.turfs', db.grounds.length, 'int'], ['admin.s.bookings', act.length, 'int'], ['admin.s.collected', sumPaid(db.bookings), 'money'], ['admin.s.dues', due, 'money']]
    .map(([k, v, kind]) => `<div class="stat"><div class="v" data-count="${v}" data-kind="${kind}">${kind === 'money' ? fmtMoney(v) : v}</div><div class="l">${t(k)}</div></div>`).join('');
  $('#adminOwners').innerHTML = owners.length ? owners.map((o) => {
    const gs = db.grounds.filter((g) => g.ownerId === o.id), ids = new Set(gs.map((g) => g.id)), bs = db.bookings.filter((b) => ids.has(b.groundId)), ms = mgrs.filter((m) => m.ownerId === o.id);
    return `<details class="ocard ${o.active === false ? 'off' : ''}" data-oid="${o.id}" ${adminOpen.has(o.id) ? 'open' : ''}><summary><div><b>${esc(o.name)}</b> <span class="muted">· ${esc(o.email)}</span></div><span class="chip ${o.active === false ? 'bad' : ''}">${t(o.active === false ? 'turf.inactive' : 'turf.active')}</span></summary>
      <div class="ostats"><span><b>${gs.length}</b> ${t('admin.s.turfs')}</span><span><b>${bs.filter((b) => !b.cancelled).length}</b> ${t('admin.s.bookings')}</span><span><b>${fmtMoney(sumPaid(bs))}</b> ${t('admin.s.collected')}</span><span><b>${ms.length}</b> ${t('admin.s.managers')}</span></div>
      <div class="acts"><button class="btn small primary" type="button" data-focus="${o.id}">${t('admin.viewData')}</button><input type="password" class="mini" data-pwfor="${o.id}" placeholder="${esc(t('staff.newPw'))}" autocomplete="new-password"><button class="btn small" type="button" data-setpw="${o.id}">${t('staff.setPw')}</button><button class="btn small" type="button" data-toggle="${o.id}">${t(o.active === false ? 'staff.activate' : 'staff.suspend')}</button><button class="btn small danger" type="button" data-delowner="${o.id}">${t('common.delete')}</button></div>
      <h4 class="sec">${t('admin.turfsHdr')}</h4>${gs.length ? gs.map((g) => `<div class="kv"><span>${esc(g.name)} <span class="muted">· ${t('sports.' + g.sport)}</span></span><span class="acts"><span class="chip ${g.active === false ? 'bad' : ''}">${t(g.active === false ? 'turf.inactive' : 'turf.active')}</span><button class="btn small" type="button" data-turf="${g.id}">${t('turf.details')}</button><button class="btn small" type="button" data-gtoggle="${g.id}">${t(g.active === false ? 'staff.activate' : 'staff.suspend')}</button></span></div>`).join('') : `<p class="note">${t('grounds.noGrounds')}</p>`}
      <h4 class="sec">${t('admin.managersHdr')}</h4>${ms.length ? ms.map(mgrRow).join('') : `<p class="note">${t('staff.none')}</p>`}</details>`;
  }).join('') : empty(t('admin.noOwners'));
  $('#amgrOwner').innerHTML = owners.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join('');
  $('#adminLog').innerHTML = db.log.length ? db.log.slice(0, 15).map((l) => { const p = { ...l.params }; if ('amount' in p) p.amount = fmtMoney(p.amount); if ('date' in p) p.date = fmtDate(p.date); return `<div class="kv"><span>${esc(t(l.key, p))}${l.o ? ` <span class="muted">· ${esc(ownerName(l.o))}</span>` : ''}</span><span class="muted">${fmtDateTime(l.at)}</span></div>`; }).join('') : `<p class="muted">${t('settings.noActivity')}</p>`;
}
$('#adminOwners').addEventListener('toggle', (e) => { const d = e.target.closest?.('details[data-oid]'); if (d) d.open ? adminOpen.add(d.dataset.oid) : adminOpen.delete(d.dataset.oid); }, true);
$('#adminFocus').addEventListener('change', (e) => { focus = e.target.value; renderFocus(); renderAdmin(); });
$('#ownerForm').addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target; clearErrs(f); let bad = false;
  const name = f.oname.value.trim(), email = f.oemail.value.trim().toLowerCase(), pw = f.opw.value;
  if (!name) { setErr(f, 'oname', 'validation.required'); bad = true; }
  if (!email) { setErr(f, 'oemail', 'validation.required'); bad = true; } else if (!L.isEmail(email)) { setErr(f, 'oemail', 'validation.invalidEmail'); bad = true; } else if (db.users.some((u) => u.email === email)) { setErr(f, 'oemail', 'auth.emailTaken'); bad = true; }
  if (pw.length < 6) { setErr(f, 'opw', 'settings.passwordShort'); bad = true; }
  if (bad || user?.role !== 'admin') return;
  db.users.push({ id: S.newId('u'), name, email, password: pw, role: 'owner', active: true, preferredLanguage: lang(), onboarded: true }); logIt('log.owner', { name }); save(); f.reset(); renderAdmin(); toast('admin.ownerAdded');
});
$('#amgrForm').addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target; clearErrs(f); let bad = false;
  const name = f.mname.value.trim(), email = f.memail.value.trim().toLowerCase(), pw = f.mpw.value;
  if (!f.mowner.value) { setErr(f, 'mowner', 'admin.needOwner'); bad = true; }
  if (!name) { setErr(f, 'mname', 'validation.required'); bad = true; }
  if (!email) { setErr(f, 'memail', 'validation.required'); bad = true; } else if (!L.isEmail(email)) { setErr(f, 'memail', 'validation.invalidEmail'); bad = true; } else if (db.users.some((u) => u.email === email)) { setErr(f, 'memail', 'auth.emailTaken'); bad = true; }
  if (pw.length < 6) { setErr(f, 'mpw', 'settings.passwordShort'); bad = true; }
  if (bad || user?.role !== 'admin') return;
  db.users.push({ id: S.newId('u'), name, email, password: pw, role: 'manager', ownerId: f.mowner.value, perms: { discount: !!f.pdiscount.checked, cancel: !!f.pcancel.checked, reports: !!f.preports.checked }, active: true, preferredLanguage: lang(), onboarded: true });
  logIt('log.manager', { name }); save(); f.reset(); renderAdmin(); toast('staff.added');
});
wireClear($('#ownerForm')); wireClear($('#amgrForm'));
function afterDataSwap() { user = db.users.find((u) => u.id === user?.id) || null; S.setSession(user?.id || null); delete $('#bizForm').dataset.init; delete $('#profileForm').dataset.init; location.hash = user ? '#/dashboard' : '#/register'; route(); }
$('#backupBtn').addEventListener('click', (e) => busy(e.currentTarget, async () => {
  const json = JSON.stringify(db, null, 1), name = `turfmitra-backup-${L.todayIST()}.json`;
  if (native) { try { const f = await plug('Filesystem').writeFile({ path: name, data: json, directory: 'CACHE', encoding: 'utf8' }); await plug('Share').share({ title: name, url: f.uri }); } catch {} return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  await new Promise((r) => setTimeout(r, 500)); toast('settings.backupDone');
}));
$('#restoreFile').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  try {
    const o = JSON.parse(await file.text());
    if (!['users', 'grounds', 'customers', 'bookings'].every((k) => Array.isArray(o[k])) || !o.business) throw new Error('bad');
    db = S.replace(o); logIt('log.restored'); save(); afterDataSwap(); toast('settings.restored');
  } catch { toast('settings.restoreBad', {}, true); }
});
$('#resetBtn').addEventListener('click', async () => { if (await confirmDlg('settings.resetTitle', 'settings.resetBody')) { db = S.reset(); user = null; afterDataSwap(); toast('settings.resetDone'); } });
$('#settingsLang').addEventListener('change', (e) => changeLang(e.target.value));
$('#profileForm').addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target; clearErrs(f);
  if (!f.name.value.trim()) return setErr(f, 'name', 'validation.required');
  if (!L.validateLang(f.lang.value)) return setErr(f, 'lang', 'validation.unsupportedLanguage');
  user.name = f.name.value.trim(); user.preferredLanguage = f.lang.value; save(); toast('settings.profileSaved');
});
$('#pwForm').addEventListener('submit', (e) => {
  e.preventDefault(); const f = e.target; clearErrs(f);
  if (f.current.value !== user.password) return setErr(f, 'current', 'settings.wrongPassword');
  if (f.next.value.length < 6) return setErr(f, 'next', 'settings.passwordShort');
  if (f.next.value !== f.confirm.value) return setErr(f, 'confirm', 'settings.passwordMismatch');
  user.password = f.next.value; save(); f.reset(); toast('settings.passwordChanged');
});

// ---------- demo lock (7-day licence) ----------
const LOCK_KEYS = { needCode: ['license.needTitle', 'license.needMsg'], expired: ['license.expiredTitle', 'license.expiredMsg'], clock: ['license.clockTitle', 'license.clockMsg'] };
async function enforce() {
  const st = LIC.status(), locked = LOCKED.includes(st.state), badge = $('#demoBadge');
  $('#lockScreen').hidden = !locked; document.body.classList.toggle('locked', locked);
  $$('body > header, body > .shell').forEach((el) => { el.inert = locked; });
  badge.hidden = st.state !== 'ok';
  if (st.state === 'ok') { badge.dataset.i18n = 'license.daysLeft'; badge.dataset.i18nParams = JSON.stringify({ days: st.daysLeft }); badge.textContent = t('license.daysLeft', { days: st.daysLeft }); }
  if (locked) {
    const [a, b] = LOCK_KEYS[st.state]; $('#lockTitle').dataset.i18n = a; $('#lockMsg').dataset.i18n = b;
    $('#lockWa').href = L.waLink(CONTACT, t('license.waMsg')); I.apply($('#lockScreen'));
  }
  return locked;
}
document.addEventListener('langchange', () => { if (!$('#lockScreen').hidden) enforce(); });
$('#lockForm').addEventListener('submit', async (e) => {
  e.preventDefault(); const err = $('#lockErr'); err.textContent = '';
  const r = await busy(e.target.querySelector('button[type=submit]'), async () => { await new Promise((x) => setTimeout(x, 450)); return LIC.activate(e.target.code.value); });
  if (!r.ok) { FX.statusPop('error'); err.textContent = t({ format: 'license.errFormat', signature: 'license.errSignature', expired: 'license.errExpired', older: 'license.errOlder' }[r.reason]); return; }
  e.target.reset(); await enforce(); route(); renderCurrent(); toast('license.activated');
});

// ---------- boot ----------
async function boot() {
  buildLangSwitch();
  if (native) { $('#pdfBtn').dataset.i18n = 'common.share'; $('#receiptPrint').dataset.i18n = 'common.share'; }
  const sid = S.getSession(); user = db.users.find((u) => u.id === sid) || null; if (user && blocked(user)) { user = null; S.setSession(null); }
  await setLang(user?.preferredLanguage || S.getGuestLang()); // profile → guest preference → English
  $$('.sport-select').forEach((s) => (s.innerHTML = sportOptions()));
  $('#lockLang').innerHTML = LANG_BTNS();
  await enforce();
  window.addEventListener('hashchange', route); route();
  setInterval(enforce, 60000); document.addEventListener('visibilitychange', () => { if (!document.hidden) enforce(); });
  window.__turfmitra = { missingKeys: I.missingKeys };
  setTimeout(() => $('#splash').classList.add('gone'), 650);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
