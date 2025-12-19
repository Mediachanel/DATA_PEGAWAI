# Persiapan Deploy Backend (Render/Fly/Heroku, dsb.)

Backend: `server.js` (Node/Express) bertindak sebagai proxy ke Web App Apps Script agar front-end statis (GitHub Pages) bisa akses data tanpa CORS.

## 1) Pastikan kode siap
- Script start sudah ada: `npm start` menjalankan `node server.js`.
- Env yang dipakai:
  - `PORT` (default 5002, akan dioverride platform).
  - `WEB_APP_BASE` (WAJIB): URL Web App Apps Script Anda, contoh  
    `https://script.google.com/macros/s/AKfycbxpYfK6Q2_GQzMM0_sTD7ts_SMz2z8aMa-pDd_WfGfuCLagwxf-UjNJDyV1TTLIk0AKxQ/exec`.
  - Opsional: `SPREADSHEET_ID`, `RANGE`, `USER_RANGE` kalau mau override.

## 2) Deploy contoh di Render
1. Push backend ke repo GitHub.
2. Render → New Web Service → pilih repo.
3. Runtime: Node.
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Env Vars:
   - `WEB_APP_BASE=<url_web_app_anda>`
   - `PORT=10000` (Render akan atur sendiri)
7. Deploy, catat URL publik, mis. `https://nama-app.onrender.com`.

## 3) Update front-end
- Ubah `API_BASE` di semua halaman utama (`index.html`, `dashboard/index.html`, `data-pegawai/index.html`, `profil/index.html`, `usulan-mutasi/index.html`, `pemutusan-jf/index.html`, `bezetting/index.html`) ke URL publik backend, mis.  
  `const API_BASE = 'https://nama-app.onrender.com';`
- Default repo sekarang memakai Web App Apps Script `https://script.google.com/macros/s/AKfycbxpYfK6Q2_GQzMM0_sTD7ts_SMz2z8aMa-pDd_WfGfuCLagwxf-UjNJDyV1TTLIk0AKxQ/exec`; ganti ke URL backend Anda jika mengikuti langkah ini.
- Commit & push (untuk GitHub Pages).

## 4) Uji
- Buka `https://nama-app.onrender.com/health` harus `{ ok: true }`.
- Di halaman front-end (Pages), cek Network: request harus menuju URL publik tadi, bukan `127.0.0.1`.

## Catatan
- Backend ini hanya proxy; semua operasi CRUD tetap lewat Apps Script. Pastikan Web App Apps Script sudah akses “Anyone” dan spreadsheet dibagikan ke service account (jika memakai akses service account) atau sesuai kebutuhan Anda.
- Bila tidak ingin Render, langkah serupa di Fly.io/Heroku/Vercel serverless: set `WEB_APP_BASE` dan gunakan `npm start` sebagai command.
