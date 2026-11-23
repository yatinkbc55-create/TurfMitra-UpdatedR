// Demo-lock tests: activation, expiry, reinstall (new storage) and clock roll-back.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { createServer } from 'node:http'; import { readFileSync, existsSync } from 'node:fs'; import { extname, join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url'; import { webcrypto as wc } from 'node:crypto';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'); const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const kp = await wc.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']); const pub = await wc.subtle.exportKey('jwk', kp.publicKey);
const b64u = (u8) => Buffer.from(u8).toString('base64url');
const makeCode = async (e, i = Date.now(), c = 'Test Turf') => { const p = new TextEncoder().encode(JSON.stringify({ c, i, e })); return b64u(p) + '.' + b64u(new Uint8Array(await wc.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, p))); };
const cfg = `export const DEMO_LOCK=true;export const CONTACT="8657198996";export const PUBLIC_KEY=${JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y })};`;
const srv = createServer((q, r) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html'; if (p === '/js/config.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(cfg); } const f = join(root, p); if (!existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); }).listen(0);
const url = `http://localhost:${srv.address().port}/#/login`;
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] });
let pass = 0, fail = 0; const check = (n, ok) => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + n); };
const open = async (shift = 0) => { const c = await b.newContext(); const p = await c.newPage(); if (shift) await p.addInitScript((s) => { const n = Date.now.bind(Date); Date.now = () => n() + s; }, shift); await p.goto(url); await p.waitForSelector('#lockScreen, #loginForm', { state: 'attached' }); await p.waitForTimeout(400); return p; };
const submit = async (p, code) => { await p.fill('#lockForm [name=code]', code); await p.click('#lockForm button[type=submit]'); await p.waitForTimeout(500); };
const locked = (p) => p.isVisible('#lockScreen');
const D = 86400000;
let p = await open();
check('fresh install shows the activation screen', await locked(p));
check('app behind the lock screen is inert (no clicks possible)', await p.evaluate(() => document.querySelector('.shell').inert === true));
await submit(p, 'abc'); check('garbage code is rejected', (await p.textContent('#lockErr')).length > 3 && await locked(p));
const forged = (await makeCode(Date.now() + 7 * D)).split('.')[0] + '.' + b64u(new Uint8Array(64)); await submit(p, forged); check('forged signature is rejected', await locked(p));
await submit(p, await makeCode(Date.now() - 1000, Date.now() - 8 * D)); check('already-expired code is rejected', await locked(p));
const good = await makeCode(Date.now() + 7 * D); await submit(p, good);
check('valid 7-day code unlocks the app', !(await locked(p)) && (await p.evaluate(() => !!document.querySelector('.view:not([hidden])'))));
check('badge shows 7 days left', (await p.textContent('#demoBadge')).includes('7'));
await p.reload(); await p.waitForTimeout(500); check('activation survives restart', !(await locked(p)));
// expiry while running
const short = await makeCode(Date.now() + 3500); const q = await open(); await submit(q, short); check('short code activates', !(await locked(q)));
await q.waitForTimeout(4200); await q.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await q.waitForTimeout(400);
check('app locks itself when the code expires', await locked(q) && (await q.textContent('#lockTitle')).length > 5);
// reinstall = brand-new storage, same expired code
const r = await open(); await submit(r, short); check('reinstall + same expired code stays blocked', await locked(r));
// clock roll-back on the same device
await q.reload(); await q.waitForTimeout(400); check('expired state persists after restart', await locked(q));
const c2 = q.context(); const rb = await c2.newPage(); await rb.addInitScript(() => { const n = Date.now.bind(Date); Date.now = () => n() - 10 * 86400000; }); await rb.goto(url); await rb.waitForTimeout(600);
check('setting the phone clock back does not unlock', await locked(rb));
// a later, longer code can extend
await submit(q, await makeCode(Date.now() + 7 * D)); check('a new longer code extends the demo', !(await locked(q)));
await b.close(); srv.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
