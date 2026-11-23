// Run: node tests/i18n.test.mjs   (no dependencies)
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';

const load = (l) => JSON.parse(readFileSync(new URL(`../assets/i18n/${l}.json`, import.meta.url), 'utf8'));
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, p + k + '.') : [[p + k, v]]));
const dicts = Object.fromEntries(L.SUPPORTED_LANGS.map((l) => [l, Object.fromEntries(flat(load(l)))]));
let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n    ', e.message); } };

console.log('Translation files');
for (const l of ['mr', 'hi']) {
  test(`${l}: has every key that en has`, () => {
    const miss = Object.keys(dicts.en).filter((k) => !(k in dicts[l]));
    assert.deepEqual(miss, [], 'missing: ' + miss.join(', '));
  });
  test(`${l}: has no extra keys`, () => {
    const extra = Object.keys(dicts[l]).filter((k) => !(k in dicts.en));
    assert.deepEqual(extra, [], 'extra: ' + extra.join(', '));
  });
  test(`${l}: no empty values`, () => assert.deepEqual(Object.entries(dicts[l]).filter(([, v]) => !String(v).trim()), []));
  test(`${l}: {placeholders} match English`, () => {
    const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join();
    const bad = Object.keys(dicts.en).filter((k) => ph(dicts.en[k]) !== ph(dicts[l][k]));
    assert.deepEqual(bad, [], 'placeholder mismatch: ' + bad.join(', '));
  });
  test(`${l}: values contain Devanagari (not left in English)`, () => {
    const allowed = new Set(['app.name', 'payments.upi']); // brand / acronym
    const bad = Object.entries(dicts[l]).filter(([k, v]) => !allowed.has(k) && !/[ऀ-ॿ]/.test(v)).map(([k]) => k);
    assert.deepEqual(bad, [], 'untranslated: ' + bad.join(', '));
  });
  test(`${l}: no value is identical to English (except allow-list)`, () => {
    const allowed = new Set(['app.name', 'payments.upi']);
    const same = Object.keys(dicts.en).filter((k) => !allowed.has(k) && dicts.en[k] === dicts[l][k]);
    assert.deepEqual(same, [], same.join(', '));
  });
}

console.log('Keys used in code exist');
const src = ['index.html', 'js/app.js', 'js/i18n.js'].map((f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n');
const used = new Set();
for (const m of src.matchAll(/data-i18n(?:-[a-z]+)?="([\w.]+)"/g)) used.add(m[1]);
for (const m of src.matchAll(/\bt\(\s*['"`]([\w.]+)['"`]/g)) used.add(m[1]);
for (const m of src.matchAll(/['"`]((?:license|log|wa|receipt|dues|board|insights|expense|validation|auth|settings|grounds|bookings|payments|customers|dashboard|onboarding|reports|notify|tooltips|common|nav|public)\.[A-Za-z]+)['"`]/g)) used.add(m[1]);
used.delete('common.xx');
test(`all ${used.size} referenced keys exist in en/mr/hi`, () => {
  const bad = [...used].filter((k) => !(k in dicts.en) && !k.endsWith('.')).map((k) => k);
  assert.deepEqual(bad, [], 'unknown keys: ' + bad.join(', '));
});
test('dynamic key groups (status.*, pay.*, sports.*, nav.*) are complete', () => {
  for (const k of ['status.confirmed', 'status.cancelled', 'status.completed', 'pay.unpaid', 'pay.partial', 'pay.paid', 'sports.football', 'sports.cricket', 'sports.boxCricket', 'sports.pickleball', ...['dashboard', 'board', 'bookings', 'customers', 'dues', 'grounds', 'reports', 'settings'].map((n) => 'nav.' + n), ...['electricity','maintenance','salary','equipment','other'].map((c) => 'expense.' + c), 'payments.cash', 'payments.upi', 'payments.card'])
    for (const l of L.SUPPORTED_LANGS) assert.ok(dicts[l][k], `${l}:${k}`);
});
test('no hard-coded user-facing text in HTML (every text node is data-i18n or data)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<head>[\s\S]*?<\/head>/g, '');
  const bad = [];
  for (const m of html.matchAll(/<(\w+)([^>]*)>([^<]+)</g)) {
    const text = m[3].trim(); if (!text || /^[⚽·–—←→‹›✎×]+$/.test(text)) continue;
    if (!/data-i18n=/.test(m[2])) bad.push(`<${m[1]}> "${text}"`);
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

console.log('Business logic');
test('only en, mr, hi accepted as language', () => { assert.equal(L.validateLang('mr'), 'mr'); assert.equal(L.validateLang('fr'), null); assert.equal(L.validateLang(undefined), null); });
test('phone / email / time validators', () => {
  assert.ok(L.isPhone('9822012345')); assert.ok(!L.isPhone('12345')); assert.ok(!L.isPhone('5822012345'));
  assert.ok(L.isEmail('a@b.co')); assert.ok(!L.isEmail('a@b')); assert.ok(L.isTime('06:30')); assert.ok(!L.isTime('25:00'));
});
test('slot overlap detection', () => {
  assert.ok(L.slotsOverlap({ start: '06:00', end: '07:00' }, { start: '06:30', end: '07:30' }));
  assert.ok(!L.slotsOverlap({ start: '06:00', end: '07:00' }, { start: '07:00', end: '08:00' }));
});
test('hourly slot generation', () => { const s = L.generateHourlySlots('06:00', '09:00', 800); assert.equal(s.length, 3); assert.equal(s[2].end, '09:00'); assert.equal(s[0].price, 800); });
test('payment status & balance (advance then remaining)', () => {
  const b = { total: 1000, payments: [], cancelled: false, date: '2999-01-01' };
  assert.equal(L.payStatus(b), 'unpaid'); b.payments.push({ amount: 300 });
  assert.equal(L.payStatus(b), 'partial'); assert.equal(L.balanceOf(b), 700); b.payments.push({ amount: 700 });
  assert.equal(L.payStatus(b), 'paid'); assert.equal(L.balanceOf(b), 0);
});
test('booking status: confirmed / completed / cancelled', () => {
  assert.equal(L.bookingStatus({ cancelled: false, date: '2999-01-01' }, '2026-11-20'), 'confirmed');
  assert.equal(L.bookingStatus({ cancelled: false, date: '2020-01-01' }, '2026-11-20'), 'completed');
  assert.equal(L.bookingStatus({ cancelled: true, date: '2999-01-01' }, '2026-11-20'), 'cancelled');
});
test('double booking is detected, cancelled bookings free the slot', () => {
  const bk = [{ groundId: 'g', slotId: 's', date: 'd', cancelled: false }];
  assert.ok(L.isSlotTaken(bk, 'g', 's', 'd')); bk[0].cancelled = true; assert.ok(!L.isSlotTaken(bk, 'g', 's', 'd'));
});
test('IST date handling around UTC midnight', () => assert.equal(L.todayIST(new Date('2026-11-20T19:00:00Z')), '2026-11-21'));

console.log('Formatting (all 3 locales)');
for (const l of L.SUPPORTED_LANGS) {
  test(`${l}: INR amount uses ₹ and Indian grouping (app formatter)`, () => {
    const s = new Intl.NumberFormat('en-IN-u-nu-latn', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(125000);
    assert.match(s, /₹/); assert.match(s, /1,25,000/);
  });
  test(`${l}: date renders in Asia/Kolkata`, () => {
    const s = new Intl.DateTimeFormat(`${l}-IN-u-nu-latn`, { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date('2026-11-20T12:00:00+05:30'));
    assert.match(s, /20/); assert.match(s, /2026/);
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
