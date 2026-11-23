// Offline demo licence. A code is signed by JNMSoftwares (ECDSA P-256) and contains the client name and an ABSOLUTE
// expiry time, so deleting / reinstalling / re-downloading the app can never give a new 7-day period.
import { DEMO_LOCK, PUBLIC_KEY } from './config.js';
import * as S from './store.js';

const DAY = 86400000;
const dec = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
export const lockEnabled = DEMO_LOCK;

/** Verifies a pasted code. Returns { ok:true, lic } or { ok:false, reason: 'format'|'signature' } */
export async function verifyCode(code) {
  try {
    const [p, s] = String(code).trim().replace(/\s+/g, '').split('.');
    if (!p || !s) return { ok: false, reason: 'format' };
    const payload = dec(p), lic = JSON.parse(new TextDecoder().decode(payload));
    if (typeof lic.e !== 'number' || typeof lic.i !== 'number') return { ok: false, reason: 'format' };
    const key = await crypto.subtle.importKey('jwk', PUBLIC_KEY, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, dec(s), payload);
    return ok ? { ok: true, lic } : { ok: false, reason: 'signature' };
  } catch { return { ok: false, reason: 'format' }; }
}

/** The clock only moves forward for this app: if the phone clock is set back, the last seen time is used. */
export function effectiveNow() {
  const last = Number(S.getMeta('lastseen')) || 0, now = Date.now();
  const eff = Math.max(now, last);
  if (eff > last) S.setMeta('lastseen', eff);
  return { eff, rolledBack: last - now > 10 * 60000 };
}

/** → { state: 'off'|'needCode'|'ok'|'expired'|'clock', lic, daysLeft } */
export function status() {
  if (!DEMO_LOCK) return { state: 'off' };
  const lic = S.getMeta('license'); if (!lic) return { state: 'needCode' };
  const { eff, rolledBack } = effectiveNow();
  if (eff > lic.e) return { state: 'expired', lic, daysLeft: 0 };
  if (!rolledBack && Date.now() < lic.i - DAY) return { state: 'clock', lic };   // phone date is before the code was issued
  return { state: 'ok', lic, daysLeft: Math.max(1, Math.ceil((lic.e - eff) / DAY)) };
}

/** Accepts a code: stores it when valid and not expired. */
export async function activate(code) {
  const v = await verifyCode(code); if (!v.ok) return v;
  const { eff } = effectiveNow(); if (eff > v.lic.e) return { ok: false, reason: 'expired' };
  const cur = S.getMeta('license'); if (cur && cur.e > v.lic.e) return { ok: false, reason: 'older' }; // a code can only extend, never shorten
  S.setMeta('license', v.lic); return { ok: true, lic: v.lic };
}
