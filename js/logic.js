// Pure, framework-free business logic (unit-tested in tests/).
export const SUPPORTED_LANGS = ['en', 'mr', 'hi'];
export const FALLBACK_LANG = 'en';
export const LANG_NAMES = { en: 'English', mr: 'मराठी', hi: 'हिंदी' };
export const TZ = 'Asia/Kolkata';

/** Server-style validation: accepts only supported codes. */
export function validateLang(code) {
  return SUPPORTED_LANGS.includes(code) ? code : null;
}

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');
export const isPhone = (v) => /^[6-9]\d{9}$/.test((v || '').replace(/\s+/g, ''));
export const isTime = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v || '');
export const toMin = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };

export function slotsOverlap(a, b) {
  return toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);
}

/** Generate hourly slots between opening and closing at a fixed price. */
export function generateHourlySlots(open, close, price) {
  const out = [];
  if (!isTime(open) || !isTime(close)) return out;
  for (let m = toMin(open); m + 60 <= toMin(close); m += 60) {
    const f = (x) => String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0');
    out.push({ id: 's' + m, start: f(m), end: f(m + 60), price: Number(price) });
  }
  return out;
}

export const todayIST = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: TZ });
export const istDateOf = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });

export const paidOf = (b) => b.payments.reduce((s, p) => s + p.amount, 0);
export const balanceOf = (b) => b.total - paidOf(b);

export function bookingStatus(b, today = todayIST()) {
  if (b.cancelled) return 'cancelled';
  return b.date < today ? 'completed' : 'confirmed';
}
export function payStatus(b) {
  const p = paidOf(b);
  return p <= 0 ? 'unpaid' : p >= b.total ? 'paid' : 'partial';
}

export function isSlotTaken(bookings, groundId, slotId, date) {
  return bookings.some((b) => !b.cancelled && b.groundId === groundId && b.slotId === slotId && b.date === date);
}

// ---------- premium logic ----------
export function addDays(ymd, n) { const d = new Date(`${ymd}T12:00:00+05:30`); d.setUTCDate(d.getUTCDate() + n); return d.toLocaleDateString('en-CA', { timeZone: TZ }); }
export const isWeekend = (ymd) => { const w = new Date(`${ymd}T12:00:00+05:30`).getUTCDay(); return w === 0 || w === 6; };
/** Slot price for a date: weekend surcharge (percent) is applied on Sat/Sun. */
export const priceFor = (slot, ymd, ground) => (isWeekend(ymd) && ground?.weekendPct > 0 ? Math.round(slot.price * (1 + ground.weekendPct / 100)) : slot.price);
export const lastDays = (n, today = todayIST()) => Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
export function revenueByDay(bookings, days) {
  const m = Object.fromEntries(days.map((d) => [d, 0]));
  for (const b of bookings) for (const p of b.payments) { const d = istDateOf(p.at); if (d in m) m[d] += p.amount; }
  return days.map((d) => m[d]);
}
export function customerStats(bookings, cid) {
  const mine = bookings.filter((b) => b.customerId === cid && !b.cancelled);
  return { count: mine.length, spent: mine.reduce((s, b) => s + paidOf(b), 0), due: mine.reduce((s, b) => s + Math.max(0, balanceOf(b)), 0) };
}
export const VIP_MIN_BOOKINGS = 5;
export const isVip = (st) => st.count >= VIP_MIN_BOOKINGS;
export const waLink = (phone, text) => `https://wa.me/91${String(phone).replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(text)}`;
/** Occupancy of a day: booked slots / all slots across grounds (0..100). */
export function occupancy(grounds, bookings, ymd) {
  const total = grounds.reduce((s, g) => s + g.slots.length, 0); if (!total) return 0;
  const booked = bookings.filter((b) => !b.cancelled && b.date === ymd).length;
  return Math.min(100, Math.round((booked / total) * 100));
}
/** Bookings per slot start-hour (peak-hours chart). */
export function peakHours(bookings, startOf) {
  const m = {}; for (const b of bookings) if (!b.cancelled) { const h = startOf(b).slice(0, 2); m[h] = (m[h] || 0) + 1; }
  return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
}
export const sumAmount = (rows) => rows.reduce((s, r) => s + r.amount, 0);
