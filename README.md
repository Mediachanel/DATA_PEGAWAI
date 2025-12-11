# Sistem Informasi Data Pegawai (Spreadsheet)

## Front-end via backend (tanpa API key di browser)
- File: `index.html`
- Jalankan backend (lihat bawah), buka `index.html` di browser.
- Klik **Cek Koneksi Server**, isi form, kirim. Data dikirim ke endpoint backend `/pegawai`.
- Pastikan `API_BASE` di `index.html` menunjuk ke backend (default `http://localhost:3000`).

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
- Gunakan backend (cek koneksi server, lalu login dengan username/password dari sheet `USERNAME`).
- `API_BASE` di file default `http://localhost:3000`.

## Struktur sheet
- Data: `DATA PEGAWAI` (A–M)
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
- Front-end tidak tersambung: pastikan backend jalan dan `API_BASE` sudah benar.
- Range salah: sesuaikan konstanta `RANGE` atau `USER_RANGE` di `server.js`.
