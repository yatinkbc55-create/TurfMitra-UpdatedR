// Local-only persistence in the device's own IndexedDB (falls back to localStorage). No backend; each device/client has its own private data. Timestamps stored in UTC ISO.
import { validateLang, FALLBACK_LANG, generateHourlySlots, todayIST, addDays, priceFor } from './logic.js';

const DB_KEY = 'turfmitra.db.v1', SESSION_KEY = 'turfmitra.session', GUEST_LANG_KEY = 'turfmitra.lang';
const uid = (p) => p + Math.random().toString(36).slice(2, 9);

function demoBookings(grounds) {
  const today = todayIST(); const out = [];
  const pick = [ // [groundIdx, dayOffset, slotIdx, customer, paidFraction, method]
    [0,0,12,'c1',.5,'upi'],[0,0,13,'c2',0,'cash'],[0,0,14,'c4',1,'upi'],[1,0,13,'c3',.5,'cash'],[1,0,15,'c5',1,'card'],
    [0,1,14,'c3',.4,'upi'],[0,1,15,'c1',0,'cash'],[1,1,12,'c6',.5,'upi'],[0,2,13,'c4',0,'cash'],[1,3,14,'c2',.5,'upi'],
    [0,-1,12,'c1',1,'upi'],[0,-1,14,'c5',1,'cash'],[1,-1,13,'c6',1,'upi'],[0,-2,13,'c4',1,'cash'],[1,-2,15,'c3',1,'upi'],
    [0,-3,14,'c1',1,'upi'],[0,-3,15,'c2',1,'cash'],[1,-4,12,'c5',1,'upi'],[0,-4,13,'c6',1,'card'],[0,-5,14,'c1',1,'upi'],
    [1,-5,13,'c4',1,'cash'],[0,-6,12,'c3',1,'upi'],[0,-6,15,'c1',.5,'upi'],[1,-7,14,'c2',1,'cash'],[0,-8,13,'c1',1,'upi'],[0,-9,14,'c1',1,'upi']
  ];
  for (const [gi, off, si, cid, frac, method] of pick) {
    const g = grounds[gi], s = g.slots[si], date = addDays(today, off), total = priceFor(s, date, g);
    const at = new Date(`${off < 0 ? date : today}T10:00:00+05:30`).toISOString(); const paid = Math.round(total * frac);
    out.push({ id: uid('b'), groundId: g.id, slotId: s.id, customerId: cid, date, total, discount: 0, cancelled: false, createdAt: at, payments: paid ? [{ id: uid('p'), amount: paid, method, at }] : [] });
  }
  return out;
}

/** Sample data - NOT used by the app. Only for screenshots / automated tests. */
export function sampleDb() {
  const mkSlots = (a, b) => generateHourlySlots('06:00', '22:00', 1000).map((s) => ({ ...s, price: s.start >= '17:00' ? b : a }));
  const grounds = [
    { id: 'g1', name: 'Green Arena', sport: 'football', weekendPct: 20, slots: mkSlots(1000, 1500) },
    { id: 'g2', name: 'Box Cricket Arena', sport: 'boxCricket', weekendPct: 20, slots: mkSlots(800, 1200) }
  ];
  const today = todayIST(), at = new Date().toISOString();
  return {
    users: [
      { id: 'u1', name: 'Amit Kulkarni', email: 'owner@turfmitra.demo', password: 'owner123', role: 'owner', preferredLanguage: null, onboarded: true },
      { id: 'u2', name: 'Sneha Joshi', email: 'reception@turfmitra.demo', password: 'desk123', role: 'manager', perms: { discount: false, cancel: true, reports: false }, active: true, preferredLanguage: null, onboarded: true }
    ],
    business: { name: 'Green Arena Sports', phone: '9876543210' },
    grounds,
    customers: [
      { id: 'c1', name: 'Rahul Patil', phone: '9822012345', email: 'rahul@example.com' },
      { id: 'c2', name: 'सागर देशमुख', phone: '9890098900', email: '' },
      { id: 'c3', name: 'Priya Sharma', phone: '9811122233', email: '' },
      { id: 'c4', name: 'अमित जाधव', phone: '9922334455', email: '' },
      { id: 'c5', name: 'Vikas More', phone: '9765432100', email: '' },
      { id: 'c6', name: 'नेहा कदम', phone: '9988776655', email: '' }
    ],
    bookings: demoBookings(grounds),
    expenses: [
      { id: 'x1', date: addDays(today, -2), category: 'electricity', amount: 4200, note: '' },
      { id: 'x2', date: addDays(today, -5), category: 'maintenance', amount: 2500, note: '' },
      { id: 'x3', date: addDays(today, -6), category: 'salary', amount: 6000, note: '' }
    ],
    log: [{ id: 'l1', at, key: 'log.demoLoaded', params: {} }]
  };
}

function seed() { return { users: [], business: { name: '', phone: '', logo: '' }, grounds: [], customers: [], bookings: [], expenses: [], log: [], achieved: [] }; }
function migrate(db) { // older saved data → add new fields
  db.expenses ||= []; db.log ||= []; db.achieved ||= []; db.business ||= { name: '', phone: '' }; db.business.logo ??= '';
  db.users.forEach((u) => { if (u.role === 'receptionist') u.role = 'manager'; if (u.role === 'manager') { u.perms ||= { discount: false, cancel: true, reports: false }; u.active ??= true; } });
  const first = db.users.find((u) => u.role === 'owner')?.id;
  db.users.forEach((u) => { if (u.role === 'manager') u.ownerId ??= first; if (u.role !== 'admin') u.active ??= true; });
  db.grounds.forEach((g) => { g.weekendPct ??= 0; g.active ??= true; g.ownerId ??= first; g.facilities ||= []; g.photos ||= []; g.address ??= ''; g.size ??= ''; g.about ??= ''; });
  db.customers.forEach((c) => { c.ownerId ??= first; });
  db.expenses.forEach((x) => { x.ownerId ??= first; });
  db.bookings.forEach((b) => { b.discount ??= 0; });
  return db;
}

// ---------- IndexedDB key-value layer (memory cache + async write-through) ----------
const IDB_NAME = 'turfmitra', IDB_STORE = 'kv', KEYS = [DB_KEY, SESSION_KEY, GUEST_LANG_KEY, 'turfmitra.license', 'turfmitra.lastseen'];
const mem = {}; let idb = null; export let storageKind = 'memory';
const openIdb = () => new Promise((res) => { try { const r = indexedDB.open(IDB_NAME, 1); r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE); r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null); } catch { res(null); } });
const idbGet = (k) => new Promise((res) => { if (!idb) return res(undefined); try { const q = idb.transaction(IDB_STORE).objectStore(IDB_STORE).get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); } catch { res(undefined); } });
function put(k, v) {
  mem[k] = v ?? undefined;
  if (idb) { try { const st = idb.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE); v == null ? st.delete(k) : st.put(v, k); } catch {} }
  else { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch {} }
}
/** Must be awaited once before load(): opens IndexedDB, loads data into memory, migrates any older localStorage data. */
export async function init() {
  idb = await openIdb(); storageKind = idb ? 'indexeddb' : 'localstorage';
  for (const k of KEYS) {
    let v = await idbGet(k);
    if (v === undefined) { // first run on this engine → migrate from older localStorage versions (or read it when IndexedDB is unavailable)
      try { const raw = localStorage.getItem(k); if (raw != null) { v = k === DB_KEY ? JSON.parse(raw) : raw; if (idb) put(k, v); } } catch {}
    }
    mem[k] = v;
  }
  try { navigator.storage?.persist?.(); } catch {} // ask the browser not to evict this device's data
  return storageKind;
}
export const save = (db) => put(DB_KEY, db);
export const getSession = () => mem[SESSION_KEY] ?? null;
export const setSession = (id) => put(SESSION_KEY, id || null);
export const getGuestLang = () => validateLang(mem[GUEST_LANG_KEY]) || FALLBACK_LANG;
export const setGuestLang = (l) => put(GUEST_LANG_KEY, l);

export function load() {
  if (mem[DB_KEY]) { const d = migrate(mem[DB_KEY]); save(d); return d; }
  const db = seed(); save(db); return db;
}
export function reset() { const db = seed(); save(db); return db; }
export function replace(obj) { const db = migrate(obj); save(db); return db; }
export function log(db, key, params = {}, owner = null) { db.log.unshift({ id: uid('l'), at: new Date().toISOString(), key, params, o: owner }); db.log.length = Math.min(db.log.length, 60); }
export const newId = uid;


// ---------- demo-license storage (same device database) ----------
export const getMeta = (k) => mem['turfmitra.' + k] ?? null;
export const setMeta = (k, v) => put('turfmitra.' + k, v);
