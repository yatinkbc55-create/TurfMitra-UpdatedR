# TurfMitra demo - Android APK + iPhone link (by JNMSoftwares)

Every phone keeps its OWN data in its own IndexedDB database. Nothing is sent to any server,
so one client can never see another client's data.

## A. Get the Android APK (about 6 minutes, no software to install)
1. Upload ALL files of this folder to your GitHub repository (same repo as the demo link), including the folders
   `css`, `js`, `assets`, `icons`, `android-signing`, and the files `package.json`, `capacitor.config.json`.
2. Create the workflow file (hidden folders are easier to add this way):
   GitHub repo -> **Add file -> Create new file** -> in the name box type `.github/workflows/android-apk.yml`
   -> paste the full content of the same file from this zip -> **Commit changes**.
3. Open the **Actions** tab. "Build Android APK" starts by itself (or click it -> **Run workflow**). Wait for the green tick (about 5-8 minutes).
4. Download the APK:
   - Repo home page -> **Releases** (right side) -> **TurfMitra demo APK** -> `TurfMitra-demo.apk`  (this link can be shared), or
   - Actions -> the finished run -> **Artifacts** -> TurfMitra-APK.
5. Send `TurfMitra-demo.apk` to the client on WhatsApp. Preferred for clients: share the web link - open in Chrome -> menu -> **Install app**.

If step 3 fails with a permission error: repo **Settings -> Actions -> General -> Workflow permissions -> Read and write** -> Save, then Run workflow again.

New versions: upload the changed files again; the APK is rebuilt automatically. The same signing key is used, so
clients can install the new APK over the old one and **keep their data**.

## B. iPhone / iPad (no APK possible)
Send the GitHub Pages link. Client opens it in **Safari -> Share -> Add to Home Screen**.
Use the Home Screen icon every time (data in a Home Screen app is kept safely by iOS).

## C. Demo logins (inside the app)
Owner: owner@turfmitra.demo / owner123    Receptionist: reception@turfmitra.demo / desk123
Settings -> "Reset demo data" gives the client fresh sample data any time; "Download backup" saves their own entries.

## D. Notes
- First open needs internet once for the fonts (the app still works without them, with the phone's own font). The app itself works offline.
- Share buttons (report, receipt, backup) use the Android share sheet; WhatsApp reminders open WhatsApp with the message ready.

## E. 7-day demo lock (new)
Each client needs a DEMO CODE (made by you with `JNM-License-Generator/generator.html` - keep that folder private, never upload it).
- The code contains the client name and the exact end time (default 7 days). After that the app locks: no login, no changes.
- Reinstalling, re-downloading or clearing the app does NOT give another 7 days - the same code is already expired.
- Setting the phone clock back does not help (the app remembers the latest time it has seen).
- To extend a client: make a new code and send it - the app accepts it on the lock screen.
- Limit: this is an offline lock (no server). A person who sets the clock back AND reinstalls on a phone that never ran the app can get the remaining days of the same code only. A server-based licence is the next step if you need stronger control.

## F. Easiest install for clients
Open the web link in Chrome on Android -> menu -> **Install app**. Works offline, data stays private on that phone. For a Play Store release, ask JNMSoftwares for a Play-ready build.
