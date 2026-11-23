import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { createServer } from 'http'; import { readFileSync, existsSync } from 'fs'; import { join, extname, dirname } from 'path'; import { fileURLToPath } from 'url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'); const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/json' };
const srv = createServer((q, r) => { let p = q.url.split('?')[0]; if (p === '/') p = '/index.html'; if (p === '/js/config.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end('export const DEMO_LOCK=false;export const CONTACT="1";export const PUBLIC_KEY={};'); } const f = join(root, p); if (!existsSync(f)) { r.statusCode = 404; return r.end(); } r.setHeader('content-type', T[extname(f)] || 'application/octet-stream'); r.end(readFileSync(f)); }).listen(0);
const url = `http://localhost:${srv.address().port}/`; const b = await chromium.launch(); const ctx = await b.newContext({ locale: 'en-IN', timezoneId: 'Asia/Kolkata', serviceWorkers: 'block', viewport: { width: 420, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
let ok = 0, bad = 0; const check = (n, c) => { c ? ok++ : bad++; console.log((c ? '  ✓ ' : '  ✗ ') + n); };
const vis = (s) => p.isVisible(s);
const login = async (e, pw) => { if (await p.isVisible('#logoutBtn')) await p.click('#logoutBtn'); else await p.evaluate(() => (location.hash = '#/login')); await p.waitForSelector('#view-login:not([hidden])'); await p.fill('#loginForm [name=email]', e); await p.fill('#loginForm [name=password]', pw); await p.click('#loginForm button[type=submit]'); await p.waitForTimeout(400); };
const nav = () => p.$$eval('#nav a', (a) => a.map((x) => x.getAttribute('href')));
await p.goto(url + '#/register'); await p.waitForSelector('#view-register:not([hidden])');
check('account-type choice is offered on a fresh install', await vis('#acctField'));
await p.selectOption('#registerForm [name=acct]', 'admin'); await p.fill('#registerForm [name=name]', 'Boss'); await p.fill('#registerForm [name=email]', 'admin@t.test'); await p.fill('#registerForm [name=password]', 'admin1'); await p.click('#registerForm button[type=submit]');
await p.waitForSelector('#view-dashboard:not([hidden])');
check('admin skips onboarding and sees Admin tab + Grounds + Reports', (await nav()).includes('#/admin') && (await nav()).includes('#/grounds') && (await nav()).includes('#/reports'));
await p.click('a[href="#/admin"]'); await p.waitForSelector('#view-admin:not([hidden])');
for (const [n, e] of [['Own One', 'o1@t.test'], ['Own Two', 'o2@t.test']]) { await p.fill('#ownerForm [name=oname]', n); await p.fill('#ownerForm [name=oemail]', e); await p.fill('#ownerForm [name=opw]', 'owner1'); await p.click('#ownerForm button[type=submit]'); await p.waitForTimeout(250); }
check('admin created two owners', (await p.$$('#adminOwners .ocard')).length === 2);
await p.selectOption('#amgrOwner', { label: 'Own One' }); await p.fill('#amgrForm [name=mname]', 'Mgr One'); await p.fill('#amgrForm [name=memail]', 'm1@t.test'); await p.fill('#amgrForm [name=mpw]', 'mgr123'); await p.click('#amgrForm button[type=submit]'); await p.waitForTimeout(250);
check('admin created a manager for Own One', await p.evaluate(() => document.querySelector('#adminOwners').textContent.includes('Mgr One')));
// admin creates a turf for Own One with facilities + photo
await p.click('a[href="#/grounds"]'); await p.click('#newGroundBtn'); await p.waitForSelector('#groundDlg[open]');
check('admin must pick an owner for the turf', await vis('#gOwner'));
await p.selectOption('#gOwner', { label: 'Own One' }); await p.fill('#groundForm [name=name]', 'Midtown Goal Park'); await p.fill('#groundForm [name=address]', '490 W 34th St'); await p.fill('#groundForm [name=size]', '100 × 65 ft'); await p.fill('#groundForm [name=about]', 'Premium synthetic turf.');
await p.click('[data-fk=parking]'); await p.click('[data-fk=floodlights]'); await p.click('[data-fk=grass]');
await p.setInputFiles('#gPhotoFile', [join(root, 'icons/icon-192.png'), join(root, 'assets/logo/logo.png')]); await p.waitForSelector('#gThumbs .gth:nth-child(2)');
check('two photos added to the gallery', (await p.$$('#gThumbs .gth')).length === 2);
await p.click('#groundForm button[type=submit]'); await p.waitForSelector('.tcard');
check('turf card shows cover photo, facilities and active pill', await p.evaluate(() => { const c = document.querySelector('.tcard'); return c.querySelector('.tcover img').src.startsWith('data:image/jpeg') && c.querySelectorAll('.ficons svg').length === 3 && c.textContent.includes('Own One') && c.querySelector('.pill.active'); }));
await p.click('.tcard [data-slots]'); await p.fill('#slotForm [name=start]', '06:00'); await p.fill('#slotForm [name=end]', '07:00'); await p.fill('#slotForm [name=price]', '1000'); await p.click('#slotForm button[type=submit]'); await p.waitForTimeout(300); await p.keyboard.press('Escape');
await p.click('.tcard .tcover'); await p.waitForSelector('#turfDlg[open]');
check('details sheet: gallery, address, facilities grid, price and Book Now', await p.evaluate(() => { const d = document.querySelector('#turfBody'); return d.querySelectorAll('.gal img').length === 2 && d.textContent.includes('490 W 34th St') && d.querySelectorAll('.fcell').length === 3 && d.textContent.includes('₹1,000') && !!d.querySelector('.cta-pill'); }));
await p.keyboard.press('Escape');
// owner view
await login('o1@t.test', 'owner1'); await p.waitForSelector('#view-dashboard:not([hidden])');
let n = await nav(); check('owner has no Admin tab', !n.includes('#/admin') && n.includes('#/grounds'));
await p.click('a[href="#/grounds"]'); check('owner sees only own turf', (await p.$$('.tcard')).length === 1);
await p.click('a[href="#/settings"]'); await p.waitForTimeout(300); check('with an admin present, owner has no backup/reset card but can add managers', !(await vis('#backupCard')) && (await vis('#staffForm')) && (await p.textContent('#staffList')).includes('Mgr One'));
// owner books with the new calendar UI
await p.click('a[href="#/customers"]'); await p.click('#newCustomerBtn'); await p.fill('#customerForm [name=name]', 'Rahul'); await p.fill('#customerForm [name=phone]', '9822012345'); await p.click('#customerForm button[type=submit]'); await p.waitForTimeout(400);
await p.click('a[href="#/bookings"]'); await p.click('#newBookingBtn'); await p.waitForSelector('#bookingDlg[open]');
await p.click('#bkGroundChips [data-bkg]'); await p.click('#calGrid .cd.today'); await p.click('#bkSlotChips [data-bks]'); await p.click('#bkPeople [data-pp="10"]'); await p.selectOption('#bkCustomer', { label: 'Rahul' });
check('chips are selected (black) in the booking sheet', await p.evaluate(() => document.querySelectorAll('#bkGroundChips .on, #bkSlotChips .on, #bkPeople .on, #calGrid .on').length === 4));
await p.click('#bookingForm .cta-go'); await p.waitForSelector('#bookingList .item');
check('booking saved with player count', (await p.textContent('#bookingList')).includes('10 players'));
await p.click('#newBookingBtn'); await p.click('#bkGroundChips [data-bkg]'); await p.click('#calGrid .cd.today');
check('booked slot is greyed out and disabled', await p.evaluate(() => document.querySelector('#bkSlotChips .chip-b').disabled)); await p.keyboard.press('Escape');
// owner turns turf off → not bookable
await p.click('a[href="#/grounds"]'); await p.click('.tcard [data-gtoggle]'); await p.waitForTimeout(300);
check('inactive turf is dimmed and hidden from booking', (await p.$$('.tcard.off')).length === 1);
await p.click('a[href="#/bookings"]'); await p.click('#newBookingBtn'); check('inactive turf not in the booking sheet', (await p.$$('#bkGroundChips [data-bkg]')).length === 0); await p.keyboard.press('Escape');
// other owner sees nothing
await login('o2@t.test', 'owner1'); await p.click('a[href="#/grounds"]'); await p.waitForTimeout(300); check('second owner cannot see first owner\'s turf', (await p.$$('.tcard')).length === 0);
await p.click('a[href="#/customers"]'); await p.waitForTimeout(300); check('second owner cannot see first owner\'s customers', (await p.$$('#customerList .item')).length === 0);
// manager
await login('m1@t.test', 'mgr123'); n = await nav(); check('manager of Own One: no grounds/admin/reports', !n.includes('#/grounds') && !n.includes('#/admin') && !n.includes('#/reports'));
// admin: view data of an owner, suspend owner
await login('admin@t.test', 'admin1'); await p.click('a[href="#/admin"]'); await p.click('[data-oid] summary'); await p.waitForTimeout(200);
check('admin sees turfs, managers and stats per owner', await p.evaluate(() => { const t = document.querySelector('#adminOwners').textContent; return t.includes('Midtown Goal Park') && t.includes('Mgr One'); }));
await p.click('[data-oid] [data-focus]'); await p.waitForSelector('#view-dashboard:not([hidden])'); check('admin "view data" shows focus bar', await vis('#focusBar'));
await p.click('a[href="#/customers"]'); await p.waitForTimeout(300); check('admin viewing Own One sees that owner\'s customer', (await p.textContent('#customerList')).includes('Rahul'));
await p.click('[data-exitfocus]'); await p.click('a[href="#/admin"]');
await p.click('[data-oid] summary'); await p.click('[data-oid] [data-toggle]:not([data-delstaff])').catch(() => {});
await p.evaluate(() => document.querySelector('[data-oid] .acts [data-toggle]').click()); await p.waitForTimeout(300);
await login('o1@t.test', 'owner1'); check('suspended owner cannot log in', !(await vis('#view-dashboard')) && (await p.textContent('#loginForm')).includes('suspended'));
await login('m1@t.test', 'mgr123'); check('manager of a suspended owner is blocked too', !(await vis('#view-dashboard')));
check('no script errors', errs.length === 0); if (errs.length) console.log(errs);
console.log(`\n${ok} passed, ${bad} failed`); await b.close(); srv.close(); process.exit(bad ? 1 : 0);
