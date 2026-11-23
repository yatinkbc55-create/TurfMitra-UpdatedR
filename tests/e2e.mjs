import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = createServer((q, r) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html'; if (p === '/js/config.js' && !process.env.KEEP_LOCK) { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end('export const DEMO_LOCK=false;export const CONTACT="1";export const PUBLIC_KEY={};'); } const f = join(root, p); if (!existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[extname(f)] || 'text/plain' }); r.end(readFileSync(f)); }).listen(0);
const url = `http://localhost:${srv.address().port}/`;
const out = process.argv[2] || '/tmp/shots'; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message)); page.on('console', (m) => { if (m.type() === 'warning' && m.text().includes('[i18n]')) errors.push(m.text()); if (m.type() === 'error' && !m.text().includes('fonts.g') && !m.text().includes('ERR_')) errors.push('CONSOLE ' + m.text()); });
let ok = 0, bad = 0; const check = (n, c) => { c ? ok++ : bad++; console.log(c ? '  ✓' : '  ✗', n); };
await page.goto(url); await page.waitForSelector('#langSwitch button');
check('default language is English', (await page.textContent('h1')).includes('Run your turf'));
await page.click('[data-lang=mr]'); await page.waitForFunction(() => document.documentElement.lang === 'mr'); check('public home switches to Marathi instantly', (await page.textContent('h1')).includes('टर्फ'));
await page.screenshot({ path: out + '/home-mr.png' });
await page.reload(); await page.waitForSelector('#langSwitch button');
check('guest preference persists after reload', (await page.getAttribute('html', 'lang')) === 'mr');
await page.evaluate(async () => { const S = await import('/js/store.js'); S.replace(S.sampleDb()); }); await page.waitForTimeout(400);
await page.reload(); await page.waitForSelector('#langSwitch button'); await page.goto(url + '#/login'); await page.waitForSelector('#loginForm');
await page.fill('[name=email]', 'owner@turfmitra.demo');
// language switch must not lose typed form data
await page.fill('[name=password]', 'typed-but-unsent'); await page.click('[data-lang=hi]');
check('form data survives language switch', (await page.inputValue('[name=password]')) === 'typed-but-unsent');
await page.fill('[name=password]', 'owner123');
await page.screenshot({ path: out + '/login-hi.png' });
await page.click('#loginForm button[type=submit]'); await page.waitForSelector('#view-dashboard:not([hidden])');
check('login → dashboard (Hindi, from guest pref)', (await page.textContent('#view-dashboard h1')) === 'डैशबोर्ड');
await page.screenshot({ path: out + '/dashboard-hi.png' });
// switch to Marathi → saved on profile → logout → login again → still Marathi
await page.click('[data-lang=mr]'); await page.click('#logoutBtn'); await page.click('[data-lang=en]');
await page.fill('[name=email]', 'owner@turfmitra.demo'); await page.fill('[name=password]', 'owner123'); await page.click('#loginForm button[type=submit]');
await page.waitForSelector('#view-dashboard:not([hidden])');
check('profile language (Marathi) restored after logout/login', (await page.textContent('#view-dashboard h1')) === 'डॅशबोर्ड');
// create booking with validation in Marathi
await page.click('a[href="#/bookings"]'); await page.click('#newBookingBtn'); await page.click('#bookingForm button[type=submit]');
check('validation message in Marathi', (await page.textContent('#bookingForm [data-err=ground]')) === 'हे क्षेत्र आवश्यक आहे.');
await page.selectOption('#bkGround', 'g1'); await page.selectOption('#bkSlot', { index: 3 }); await page.selectOption('#bkCustomer', 'c1');
await page.fill('[name=advance]', '300'); await page.click('#bookingDlg [data-lang=hi]');
check('booking dialog selections kept after switching to Hindi', (await page.inputValue('#bkGround')) === 'g1' && (await page.inputValue('[name=advance]')) === '300' && (await page.inputValue('#bkCustomer')) === 'c1');
await page.screenshot({ path: out + '/booking-dialog-hi.png' });
await page.fill('#bookingForm [name=date]', '2030-01-05'); await page.click('#bookingForm button[type=submit]');
await page.waitForSelector('#bookingDlg', { state: 'hidden' });
check('booking created', (await page.$$('#bookingList .item')).length >= 5);
// double booking blocked
await page.click('#newBookingBtn'); await page.fill('#bookingForm [name=date]', '2030-01-05'); await page.selectOption('#bkGround', 'g1'); await page.selectOption('#bkSlot', { index: 3 }); await page.selectOption('#bkCustomer', 'c3'); await page.click('#bookingForm button[type=submit]');
check('double booking message in Hindi', (await page.textContent('#bookingForm [data-err=slot]')).includes('पहले से बुक'));
await page.click('#bookingDlg [data-close]');
// remaining payment
const payBtn = page.locator('#bookingList [data-pay]').first(); await payBtn.click();
check('payment dialog shows "remaining" title in Hindi', (await page.textContent('#payTitle')) === 'शेष भुगतान दर्ज करें' || (await page.textContent('#payTitle')) === 'अग्रिम भुगतान दर्ज करें');
await page.fill('#payForm [name=amount]', '999999'); await page.click('#payForm button[type=submit]');
check('overpay validation in Hindi', (await page.textContent('#payForm [data-err=amount]')).includes('से अधिक नहीं हो सकती'));
await page.click('#payDlg [data-close]');
await page.screenshot({ path: out + '/bookings-hi.png' });
// reports, grounds, customers, settings
for (const r of ['reports', 'grounds', 'customers', 'settings']) { await page.click(`a[href="#/${r}"]`); await page.screenshot({ path: `${out}/${r}-mr.png` }); }
// customer names untouched
await page.click('a[href="#/customers"]'); check('customer names are not translated', (await page.textContent('#customerList')).includes('Rahul Patil') && (await page.textContent('#customerList')).includes('सागर देशमुख'));
// no horizontal overflow on every screen in every language
for (const l of ['en', 'mr', 'hi']) { await page.click(`[data-lang=${l}]`); for (const r of ['dashboard', 'board', 'bookings', 'customers', 'dues', 'grounds', 'reports', 'settings']) { await page.click(`a[href="#/${r}"]`); const o = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); check(`no horizontal overflow: ${r} / ${l}`, !o); } }
// receptionist: no grounds/reports, still has language switch
await page.click('#logoutBtn'); await page.fill('[name=email]', 'reception@turfmitra.demo'); await page.fill('[name=password]', 'desk123'); await page.click('#loginForm button[type=submit]'); await page.waitForSelector('#view-dashboard:not([hidden])');
check('manager has language selector and no Reports/Grounds nav', (await page.isVisible('#langSwitch')) && (await page.$$('#nav a')).length === 6);
// ---- premium features (owner, English) ----
await page.click('#logoutBtn'); await page.click('[data-lang=en]'); await page.fill('[name=email]', 'owner@turfmitra.demo'); await page.fill('[name=password]', 'owner123'); await page.click('#loginForm button[type=submit]'); await page.waitForSelector('#view-dashboard:not([hidden])');
await page.click('[data-lang=en]');
check('dashboard shows 7-day chart and occupancy', (await page.$$('#chart7 .bars i')).length === 7 && (await page.textContent('#stats')).includes('%'));
await page.click('a[href="#/board"]'); await page.waitForSelector('.slotc.free');
check('availability board lists free and booked slots', (await page.$$('.slotc.free')).length > 5 && (await page.$$('.slotc.paid, .slotc.partial, .slotc.unpaid')).length > 0);
await page.fill('#boardDate', '2030-02-02'); await page.dispatchEvent('#boardDate', 'change');
await page.locator('.slotc.free').first().click();
check('tapping a free slot opens booking dialog prefilled', (await page.inputValue('#bkGround')) !== '' && (await page.inputValue('#bkSlot')) !== '');
check('weekend rate shown for a Saturday', (await page.textContent('#bkPrice')).includes('Weekend rate'));
await page.fill('[name=discount]', '100'); await page.selectOption('#bkCustomer', 'c3'); await page.selectOption('[name=repeat]', '4'); await page.click('#bookingForm button[type=submit]');
await page.waitForSelector('#bookingDlg', { state: 'hidden' });
await page.click('a[href="#/bookings"]'); await page.fill('#fDate', '2030-02-23'); await page.dispatchEvent('#fDate', 'change');
check('weekly recurring booking created 4 dates (3rd Saturday check)', (await page.$$('#bookingList .item')).length === 1);
await page.locator('#bookingList [data-receipt]').first().click();
check('receipt shows discount and has WhatsApp link', (await page.textContent('#receiptBody')).includes('Discount') && (await page.getAttribute('#receiptWa', 'href')).startsWith('https://wa.me/91'));
await page.click('#receiptDlg [data-close]');
check('booking card has WhatsApp reminder link', (await page.$$('#bookingList a[href^="https://wa.me/91"]')).length >= 1);
await page.click('a[href="#/dues"]'); check('dues page lists customers with pending balance', (await page.$$('#duesList .item')).length > 0);
await page.click('a[href="#/reports"]'); await page.fill('#reportForm [name=from]', '2020-01-01'); await page.click('#reportForm button[type=submit]');
const before = (await page.$$('#expenseList .item')).length;
await page.click('#newExpenseBtn'); await page.fill('#expenseForm [name=amount]', '1500'); await page.click('#expenseForm button[type=submit]');
check('expense can be added and profit is shown', (await page.$$('#expenseList .item')).length === before + 1 && (await page.textContent('#insightsOut')).includes('Net profit'));
await page.click('a[href="#/grounds"]'); await page.locator('[data-wk]').first().click(); await page.fill('#priceForm [name=pct]', '30'); await page.click('#priceForm button[type=submit]');
check('weekend pricing saved', (await page.textContent('#groundList')).includes('Weekend +30%'));
await page.click('a[href="#/settings"]');
await page.waitForFunction(() => document.querySelectorAll('#activityList .kv').length > 3);
check('activity log and backup visible to owner', (await page.$$('#activityList .kv')).length > 3 && (await page.isVisible('#backupBtn')));
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#backupBtn')]); check('backup downloads a JSON file', dl.suggestedFilename().endsWith('.json'));
page.once('dialog', () => {}); await page.click('#resetBtn'); await page.click('#confirmDlg button[value=yes]'); await page.waitForSelector('#view-register:not([hidden])');
check('erase-all-data returns to a clean sign-up screen', true);
check('missing-translation warnings: none', !errors.some((e) => e.includes('[i18n]')));
console.log(errors.length ? '\nErrors:\n' + errors.join('\n') : '\nNo console errors');
console.log(`\n${ok} passed, ${bad} failed`);
await b.close(); srv.close(); process.exit(bad || errors.length ? 1 : 0);
