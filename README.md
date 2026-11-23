# TurfMitra – trilingual demo (English · मराठी · हिंदी)

Backend-free demo. All data lives in the browser (`localStorage`). Installable on Android as a PWA.

## Run
```
cd turfmitra-demo
python3 -m http.server 8080      # or: npx serve .
# open http://localhost:8080
```
Clean start: no dummy data. The client registers as owner and the setup wizard guides them (business, logo, ground, first booking).

## Put it on an Android phone (no APK needed)
1. Host the folder over **HTTPS** (Netlify Drop, GitHub Pages, Cloudflare Pages – drag-and-drop the folder).
2. Open the URL in Chrome on the phone → ⋮ → **Install app** / *Add to Home screen*.
3. For a real `.apk`/`.aab`: paste the hosted URL into https://www.pwabuilder.com (Android package), or wrap with Capacitor (`npx cap add android`, needs Android Studio).

## Structure
```
assets/i18n/{en,mr,hi}.json   centralized dictionaries (key-based, no strings in code)
js/i18n.js                    runtime switching, lazy load, English fallback, missing-key detection
js/logic.js                   pure business rules + language validation (en/mr/hi only)
js/store.js                   localStorage persistence (profile language, guest language, data)
js/app.js                     screens and routing
tests/                        i18n + logic tests, browser e2e
QA-CHECKLIST.md               manual multilingual checklist
```

## Language behaviour
- Guest: saved in `localStorage` (`turfmitra.lang`). Logged in: saved to the user profile (`preferredLanguage`).
- On login: profile language is applied; if none saved, the language chosen on the login page is kept and saved. Default English.
- Switching is instant, in place (no reload), and does not reset open forms.
- Fonts: Noto Sans Devanagari / Mukta (mr, hi) and Inter (en) from Google Fonts, with system Devanagari fallbacks.

## Honest limitations of this demo (vs the full spec)
- Not Angular and no server: the architecture mirrors the spec, but server-side `PreferredLanguage`, API validation, localized server errors and notifications are **not** implemented (validation runs client-side).
- Passwords are stored in plain text in localStorage – demo only.
- Fonts need internet on first load (then cached by the service worker). Bundle the woff2 files for fully offline use.
- PDF export uses the browser's *Print → Save as PDF*, which embeds the fonts the browser used; it is not a server-generated PDF.
- Translations were written carefully but should be reviewed by a native speaker for turf-business terminology before launch.
- Date pickers inside dialogs use the phone's own locale format (browser-controlled).

## Premium features (v2, by JNMSoftwares)
Live availability board (tap a free slot to book) · weekend pricing per ground · discount on booking · weekly recurring bookings (4/8/12 weeks) · WhatsApp click-to-chat messages (reminder, confirmation, due, receipt — WhatsApp opens with the text ready; the user presses send) · printable receipt · Dues list · VIP customer tag (5+ bookings) · dashboard 7-day collection chart and occupancy · insights (busiest hours, daily collection) · expenses and net profit · backup/restore/reset · activity log. All strings exist in English, Marathi and Hindi.

## Roles
- **Owner**: full access (grounds & pricing, reports, expenses, backup/restore, activity log, business profile, managers).
- **Manager** (created by the owner in Settings → Managers): bookings, live board, payments/dues, customers, WhatsApp reminders, receipts. The owner switches on per manager: *can give discount*, *can cancel bookings*, *can view reports & expenses*. A manager can be suspended, given a new password, or deleted. Managers never see Grounds, backup or business settings; the rules are also enforced on direct links.

## Premium design, turf details & Admin (v6)
- New look: soft greige canvas, white rounded cards, black pill buttons with an olive arrow, floating nav, bottom-sheet dialogs.
- Each ground has address, size, about text, facility tiles (parking, floodlights, synthetic grass, boundary net, washroom, water, changing room, seating, cafe, first aid, CCTV, scoreboard, equipment, Wi-Fi, coaching), a photo gallery (photos are shrunk and stored on the phone) and an Active / Inactive switch. Inactive turfs cannot be booked.
- **Admin** role: sees and controls everything: all owners, managers and turfs, active/inactive for every account, roles and permissions, passwords, and the full activity log. Owners and managers can also be switched Active/Inactive; inactive accounts cannot log in.
