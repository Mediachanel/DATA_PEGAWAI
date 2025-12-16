# Sistem Informasi Data Pegawai (Spreadsheet)

## Front-end via backend (tanpa API key di browser)
- File: `index.html`
- Default `API_BASE` disetel ke Web App Apps Script `https://script.google.com/macros/s/AKfycbxFgN7dWixltKIgVGtURC8H8FtQamzym4Scmd4sjN7-oZMel4b0Gg5aVdKF6iz_XnI66g/exec` agar bisa langsung dipakai di GitHub Pages.
- Jika memakai backend Node (lihat bawah), jalankan server lalu ubah `API_BASE` di `index.html` ke URL backend (mis. `http://127.0.0.1:5002` atau URL Render/ngrok), kemudian buka `index.html` di browser.
- Klik **Cek Koneksi Server**, isi form, kirim. Data dikirim ke endpoint backend `/pegawai`.

## Backend Node (service account)
- File: `server.js`
- Letakkan key JSON service account di folder ini (contoh: `update-bezetting-XXXX.json`) atau set env `SERVICE_ACCOUNT_PATH`.
- Script otomatis mencari file `.json` yang mengandung `update-bezetting` atau fallback `service-account.json`.
- Share spreadsheet ke email service account dengan hak Edit.
- Install deps: `npm install`.
- Jalankan: `npm start` (opsional: `PORT=4000 SPREADSHEET_ID=... RANGE="DATA PEGAWAI!A:M"`).
- Endpoint:
  - POST `/pegawai` (buat data pegawai) body JSON:
    ```json
    {
      "nama": "...",
      "nik": "...",
      "jabatan": "...",
      "unit": "...",
      "statusKaryawan": "Tetap|Kontrak|Magang",
      "tanggalMasuk": "YYYY-MM-DD",
      "tanggalKeluar": "YYYY-MM-DD",
      "email": "...",
      "telepon": "...",
      "statusAktif": "Y|T",
      "catatan": "..."
    }
    ```
  - GET `/pegawai` (baca semua data).
  - POST `/login` dengan `{"username":"","password":""}` memakai sheet `USERNAME!A:C`.

## Dashboard
- File: `dashboard.html`
- Default `API_BASE` mengarah ke Web App Apps Script di atas; jika memakai backend sendiri ubah ke URL backend (mis. `http://127.0.0.1:5002` atau Render/ngrok).
- Gunakan backend (cek koneksi server, lalu login dengan username/password dari sheet `USERNAME`).

## Struktur sheet
- Data: `DATA PEGAWAI` (A-M)
  1. ID (rumus contoh: `="EMP-"&TEXT(ROW()-1,"0000")`)
  2. Nama
  3. NIK
  4. Jabatan
  5. Unit
  6. Status Karyawan
  7. Tanggal Masuk
  8. Tanggal Keluar
  9. Masa Kerja (rumus DATEDIF)
  10. Email
  11. Telepon
  12. Status Aktif (Y/T)
  13. Catatan
- Login: `USERNAME` (A:C) kolom Username, Password, Role (opsional).

## Troubleshooting
- Gagal append/baca: cek share ke service account, path file key, Sheets API aktif.
- Front-end tidak tersambung: pastikan `API_BASE` sudah benar (Web App Apps Script atau backend yang Anda pakai) dan backend/Apps Script dapat diakses.
- Range salah: sesuaikan konstanta `RANGE` atau `USER_RANGE` di `server.js`.
