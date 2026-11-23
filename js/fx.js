// Interaction effects: status pop (success / fail / in-process), top progress bar, confetti, count-up, badges.
import { fmtMoney } from './i18n.js';
const $ = (s) => document.querySelector(s);
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const POP = {
  success: '<svg viewBox="0 0 52 52" class="pop-svg"><circle class="pc" cx="26" cy="26" r="23"/><path class="pk" d="M15 27l8 8 15-17"/></svg>',
  error: '<svg viewBox="0 0 52 52" class="pop-svg"><circle class="pc" cx="26" cy="26" r="23"/><path class="pk" d="M18 18l16 16M34 18L18 34"/></svg>',
  progress: '<svg viewBox="0 0 52 52" class="pop-svg spin"><circle class="pc" cx="26" cy="26" r="23"/></svg>'
};
export function statusPop(kind) {
  const el = $('#statusPop'); if (!el) return;
  clearTimeout(el._t); el.className = 'pop ' + kind; el.innerHTML = POP[kind]; el.hidden = false;
  void el.offsetWidth; el.classList.add('show');
  if (kind !== 'progress') el._t = setTimeout(hidePop, 1150);
}
export function hidePop() { const el = $('#statusPop'); if (!el) return; el.classList.remove('show'); el._t = setTimeout(() => { el.hidden = true; }, 250); }
export function topProgress() { const b = $('#topProgress'); if (!b) return; b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); }
export function confetti() {
  if (reduce()) return; const box = $('#confetti'); if (!box) return;
  const cols = ['#E8892B', '#17503A', '#F2C14E', '#2f8f5b', '#C9D6CD', '#B5571B'];
  box.innerHTML = Array.from({ length: 30 }, (_, i) => `<i style="--x:${Math.round(Math.random() * 100 - 50)}vw;--r:${Math.round(Math.random() * 720 - 360)}deg;--d:${(Math.random() * 0.25).toFixed(2)}s;--c:${cols[i % cols.length]};--w:${6 + (i % 4) * 2}px"></i>`).join('');
  box.hidden = false; clearTimeout(box._t); box._t = setTimeout(() => { box.hidden = true; box.innerHTML = ''; }, 2000);
}
const FMT = { money: fmtMoney, pct: (v) => Math.round(v) + '%', int: (v) => String(Math.round(v)) };
export function countUp(root = document) {
  root.querySelectorAll('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count), f = FMT[el.dataset.kind || 'int'];
    if (reduce() || !to) { el.textContent = f(to || 0); return; }
    const t0 = performance.now(), D = 800;
    const step = (now) => { const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3); el.textContent = f(to * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
export const ring = (pct) => `<svg class="ring" viewBox="0 0 100 100" style="--p:${Math.max(0, Math.min(100, pct))}"><circle class="rb" cx="50" cy="50" r="42"/><circle class="rf" cx="50" cy="50" r="42"/><text x="50" y="56" text-anchor="middle" data-count="${pct}" data-kind="pct">${pct}%</text></svg>`;
const P = (d) => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const BADGE_ICON = {
  first: P('<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18" opacity=".35"/><path d="M8 12l3 3 5-6"/>'),
  ten: P('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 20h8"/>'),
  cash: P('<circle cx="12" cy="12" r="9"/><path d="M9 8h6M9 11h6M10 8c3 0 4 2 0 4l4 4"/>'),
  crowd: P('<circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.4"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 15c3 0 6 1.5 6 5"/>'),
  vip: P('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'),
  weekly: P('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M8 15h3M13 15h3"/>'),
  smart: P('<path d="M4 18l5-6 4 3 7-9"/><path d="M15 6h5v5"/>')
};
