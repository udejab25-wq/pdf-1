# PDF Studio: one codebase for web, Windows, macOS, Linux and Android

`www/` is the whole app. `npm install` copies the libraries into `www/vendor`, so every build works fully offline.

## Get the Android APK (about 10 minutes, nothing to install)
1. Make a free GitHub account, create a repository, and upload this folder's contents.
2. Settings > Pages > Source: "GitHub Actions". Then open the Actions tab and run "Build all platforms" (it also runs on every push).
3. When it turns green, open the repository's **Releases** page. `PDF-Studio.apk` is there, with the Windows, macOS and Linux installers beside it. Open that page on your phone, tap the APK, and allow "install unknown apps" if asked.
No GitHub? Host the `www` folder anywhere over https and paste its address into PWABuilder.com, which returns an Android package.

## Easiest: let GitHub build and host everything (no local tools)
1. Create a GitHub repository and upload this folder. In Settings > Pages, set Source to "GitHub Actions".
2. Push to `main` (or run the "Build all platforms" workflow by hand).
3. When it finishes:
   - **Web app / PWA:** the Pages URL. Open it and install (below).
   - **Windows / macOS / Linux installers** and the **Android APK:** download from the run's Artifacts.

## Installing the web app (PWA)
- **Android (Chrome):** open the URL, tap "Install app" (or menu > Install app). It becomes a normal app icon and works offline.
- **Windows / macOS / Linux / ChromeOS (Chrome or Edge):** click "Install app" or the install icon in the address bar. It also offers itself as a handler for .pdf files.
- **iPhone / iPad (Safari):** Share > Add to Home Screen.
Any static host works: Netlify (`netlify.toml` included), Cloudflare Pages, or `npm run serve`. It must be served over https.

## Android APK
The workflow builds a debug-signed APK: copy it to the phone and open it (allow "install unknown apps"). For Google Play, generate a signed bundle from the hosted URL with PWABuilder.com, or sign the Capacitor build in Android Studio (`npm run android:add`, `npm run android:open`). Saving on Android opens the share sheet (Save to Files, Drive, email).

## Desktop builds locally
    npm install
    npm start          # run
    npm run dist       # installer in dist/ (build on the target OS)
macOS builds are unsigned: right-click > Open the first time. Windows may show SmartScreen for unsigned installers.

## Optional Python engine (desktop only)
Original-font editing, true Word layout, OCR and text-preserving compression: see `backend/server.py`. `pip install -r backend/requirements.txt`, install LibreOffice and Tesseract, then `npm start`.

Bump `V` in `www/sw.js` on each release so installed copies refresh.
