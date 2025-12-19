# Sistem Informasi Data Pegawai (Spreadsheet)

## Front-end via backend (tanpa API key di browser)
- File: `index.html`
- Default `API_BASE` disetel ke Web App Apps Script `https://script.google.com/macros/s/AKfycbxpYfK6Q2_GQzMM0_sTD7ts_SMz2z8aMa-pDd_WfGfuCLagwxf-UjNJDyV1TTLIk0AKxQ/exec` agar bisa langsung dipakai di GitHub Pages.
- Jika memakai backend Node (lihat bawah), jalankan server lalu ubah `API_BASE` di `index.html` ke URL backend (mis. `http://127.0.0.1:5002` atau URL Render/ngrok), kemudian buka `index.html` di browser.
- Klik **Cek Koneksi Server**, isi form, kirim. Data dikirim ke endpoint backend `/pegawai`.

## Backend Node (service account)
- File: `server.js`
- Letakkan key JSON service account di folder ini (contoh: `update-bezetting-XXXX.json`) atau set env `SERVICE_ACCOUNT_PATH`.
- Script otomatis mencari file `.json` yang mengandung `update-bezetting` atau fallback `service-account.json`.
- Share spreadsheet ke email service account dengan hak Edit.
- Install deps: `npm install`.
- Jalankan: `npm start` (opsional: `PORT=4000 SPREADSHEET_ID=... RANGE="DATA PEGAWAI!A:AC"`).
- Endpoint:
  - GET `/health` (cek status).
  - POST `/login` dengan `{"username":"","password":""}` memakai sheet `username!A:E`.
  - GET `/pegawai` (baca data pegawai).
  - POST `/pegawai` body JSON sesuai urutan kolom (lihat "Struktur sheet" atau `DOCUMENTATION.md`).
  - PUT `/pegawai/:id` dan DELETE `/pegawai/:id` (backend Node).

## Dashboard
- File: `dashboard.html`
- Default `API_BASE` mengarah ke Web App Apps Script di atas; jika memakai backend sendiri ubah ke URL backend (mis. `http://127.0.0.1:5002` atau Render/ngrok).
- Gunakan backend (cek koneksi server, lalu login dengan username/password dari sheet `username`).

## Struktur sheet
- Data: `DATA PEGAWAI` (A:AC)
  1. nama_pegawai
  2. npwp
  3. no_bpjs
  4. nama_jabatan_orb
  5. nama_jabatan_prb
  6. nama_status_aktif
  7. nama_status_rumpun
  8. jenis_kontrak
  9. nip
  10. nik
  11. jenis_kelamin
  12. tmt_kerja_ukpd
  13. tempat_lahir
  14. tanggal_lahir
  15. agama
  16. jenjang_pendidikan
  17. jurusan_pendidikan
  18. no_tlp
  19. email
  20. nama_ukpd
  21. wilayah_ukpd
  22. golongan_darah
  23. gelar_depan
  24. gelar_belakang
  25. status_pernikahan
  26. nama_jenis_pegawai
  27. catatan_revisi_biodata
  28. alamat_ktp
  29. alamat_domisili
- Login: `username` (A:E) kolom Nama UKPD, Username, Password, Hak akses, Wilayah.

## Troubleshooting
- Gagal append/baca: cek share ke service account, path file key, Sheets API aktif.
- Front-end tidak tersambung: pastikan `API_BASE` sudah benar (Web App Apps Script atau backend yang Anda pakai) dan backend/Apps Script dapat diakses.
- Range salah: sesuaikan konstanta `RANGE` atau `USER_RANGE` di `server.js`.
