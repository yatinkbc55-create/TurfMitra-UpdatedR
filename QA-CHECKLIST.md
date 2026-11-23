# TurfMitra – Multilingual QA Checklist

Run every workflow once in **English (en)**, **मराठी (mr)** and **हिंदी (hi)**. Tick each cell.
Fresh start: register a new owner (no demo accounts, no dummy data).

| # | Workflow | en | mr | hi |
|---|----------|----|----|----|
| 1 | Login (also try wrong password and empty fields → error in selected language) | ☐ | ☐ | ☐ |
| 2 | Dashboard (4 stat tiles, upcoming list, welcome text) | ☐ | ☐ | ☐ |
| 3 | Create ground (Grounds → Create Ground; save empty → validation) | ☐ | ☐ | ☐ |
| 4 | Configure slots (add slot; overlapping slot → error; end before start → error; remove slot) | ☐ | ☐ | ☐ |
| 5 | Add customer (bad phone / bad email → errors; Devanagari + Latin names kept as typed) | ☐ | ☐ | ☐ |
| 6 | Create booking (required-field errors; already-booked slot → error) | ☐ | ☐ | ☐ |
| 7 | Record advance payment (amount 0 and over-balance → errors) | ☐ | ☐ | ☐ |
| 8 | Record remaining payment (button label switches from Advance to Remaining) | ☐ | ☐ | ☐ |
| 9 | Generate report (change dates, Export PDF → Save as PDF) | ☐ | ☐ | ☐ |
| 10 | Change profile settings (name, language, change password with wrong/short/mismatch) | ☐ | ☐ | ☐ |
| 11 | Logout, log in again (language restored from profile) | ☐ | ☐ | ☐ |
| 12 | Registration + onboarding wizard (3 steps, validation on each step) | ☐ | ☐ | ☐ |
| 13 | Receptionist login (language selector visible, no Grounds/Reports) | ☐ | ☐ | ☐ |

## Cross-cutting checks
- ☐ Language selector visible on: public home, login, register, onboarding, owner dashboard, receptionist dashboard, settings, and **inside every form dialog**
- ☐ No missing translation keys (browser console shows no `[i18n] missing` warnings; `window.__turfmitra.missingKeys.size === 0`)
- ☐ No untranslated English labels in mr/hi (only brand "TurfMitra", "UPI", customer-entered data)
- ☐ No broken Devanagari (conjuncts such as क्ष, त्र, ज्ञ, द्ध, श्र render joined); no clipped text
- ☐ No horizontal scroll on 360 px, tablet and desktop widths
- ☐ Switching language **while a form/dialog is half-filled keeps the typed values and selected options**
- ☐ Error messages already on screen change language immediately
- ☐ Language persists after page refresh (guest) and after logout/login (profile)
- ☐ Amounts show ₹ with Indian grouping (₹1,25,000); dates/times are IST and match the booking
- ☐ Customer names and booking data are not translated
- ☐ Printed/PDF report: headings, columns, status labels in selected language; Devanagari glyphs embedded (open the PDF on another device)
- ☐ Installed PWA on Android phone: all of the above on a real device

## Automated
```
node tests/i18n.test.mjs      # key parity, placeholders, Devanagari presence, keys used in code, business logic, formatting
node tests/e2e.mjs [outdir]   # headless Chrome: 33 checks across all three languages (needs Playwright + Chromium)
```

## v2 premium checks
- [ ] Board: free slot tap opens booking dialog prefilled; weekend price note shows on Sat/Sun
- [ ] Booking: discount > price rejected; repeat 4 weeks creates 4 bookings, taken dates skipped with message
- [ ] Receipt prints; WhatsApp link opens wa.me with message in current language
- [ ] Dues list total equals dashboard pending amount
- [ ] Expenses add/delete; profit = collected − expenses
- [ ] Backup downloads JSON; restore accepts it; invalid file shows error; reset returns to a clean empty app
- [ ] All new screens switch language instantly (en/mr/hi), no horizontal overflow
