// Verifies IndexedDB persistence, per-device isolation and legacy localStorage migration.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { createServer } from 'node:http'; import { readFileSync, existsSync } from 'node:fs'; import { extname, join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'); const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = createServer((q, r) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html'; if (p === '/js/config.js' && !process.env.KEEP_LOCK) { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end('export const DEMO_LOCK=false;export const CONTACT="1";export const PUBLIC_KEY={};'); } const f = join(root, p); if (!existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); }).listen(0);
const url = `http://localhost:${srv.address().port}/`;
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] });
let pass = 0, fail = 0; const check = (n, ok) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + n); };
const idbDump = (p) => p.evaluate(() => new Promise((res) => { const r = indexedDB.open('turfmitra'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('turfmitra.db.v1'); q.onsuccess = () => res(q.result || null); }; r.onerror = () => res(null); }));
const login = async (p) => { await p.evaluate(async () => { const S = await import('/js/store.js'); S.replace(S.sampleDb()); }); await p.waitForTimeout(300); await p.reload(); await p.goto(url); await p.waitForSelector('#loginForm', { state: 'attached' }); await p.goto(url + '#/login'); await p.fill('[name=email]', 'owner@turfmitra.demo'); await p.fill('[name=password]', 'owner123'); await p.click('#loginForm button[type=submit]'); await p.waitForSelector('#view-dashboard:not([hidden])'); };
// device A
const A = await b.newContext(); const a = await A.newPage(); await a.goto(url); await a.waitForSelector('#langSwitch button'); await login(a);
check('data lives in IndexedDB (kv store)', !!(await idbDump(a))?.bookings?.length);
check('localStorage holds no business data', (await a.evaluate(() => localStorage.getItem('turfmitra.db.v1'))) === null);
await a.click('a[href="#/customers"]'); await a.click('#newCustomerBtn'); await a.fill('#customerForm [name=name]', 'Isolation Test Customer'); await a.fill('#customerForm [name=phone]', '9000011111'); await a.click('#customerForm button[type=submit]');
await a.waitForTimeout(300); await a.reload(); await a.waitForSelector('#view-customers:not([hidden])');
check('data and login survive a reload', (await a.textContent('#customerList')).includes('Isolation Test Customer'));
// device B: separate storage → must not see A's data
const B = await b.newContext(); const c = await B.newPage(); await c.goto(url); await c.waitForSelector('#langSwitch button'); await login(c); await c.click('a[href="#/customers"]');
check('another device does not see this customer', !(await c.textContent('#customerList')).includes('Isolation Test Customer'));
// legacy migration
const L = await b.newContext(); const l = await L.newPage();
await l.addInitScript(() => { if (!localStorage.getItem('x')) { localStorage.setItem('x', '1'); const d = { users: [{ id: 'u1', name: 'Legacy Owner', email: 'owner@turfmitra.demo', password: 'owner123', role: 'owner', preferredLanguage: null, onboarded: true }], business: { name: 'Legacy Turf', phone: '9' }, grounds: [], customers: [{ id: 'c1', name: 'Old Customer', phone: '9111122222', email: '' }], bookings: [] }; localStorage.setItem('turfmitra.db.v1', JSON.stringify(d)); } });
await l.goto(url); await l.waitForSelector('#langSwitch button'); const dump = await idbDump(l);
check('older localStorage data is migrated into IndexedDB', dump?.customers?.[0]?.name === 'Old Customer' && Array.isArray(dump.expenses));
await b.close(); srv.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
