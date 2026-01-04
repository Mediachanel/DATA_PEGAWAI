# Sistem Informasi Data Pegawai (Spreadsheet)

## Front-end via Cloudflare Worker proxy (recommended)
- File: `index.html`
- Default `API_BASE` disetel ke Cloudflare Worker `https://sikepeg.seftianh23.workers.dev`.
- Set `PROXY_KEY` di semua halaman (header `X-Proxy-Key`) dan samakan dengan env `PROXY_KEY` di Worker.
- Worker meneruskan `key` ke Apps Script (env `APPS_SCRIPT_KEY` harus sama dengan `API_KEY` di `code.js`).
- Frontend hanya memanggil Worker (tidak langsung ke Apps Script).
- Endpoint memakai `action`: `GET ?action=health|list|get`, `POST {action:create|update|delete|login|upload|password_change}`.

## Backend Node (service account)
- File: `server.js`
- Letakkan key JSON service account di folder ini (contoh: `update-bezetting-XXXX.json`) atau set env `SERVICE_ACCOUNT_PATH`.
- Script otomatis mencari file `.json` yang mengandung `update-bezetting` atau fallback `service-account.json`.
- Share spreadsheet ke email service account dengan hak Edit.
- Install deps: `npm install`.
- Jalankan: `npm start` (opsional: `PORT=4000 SPREADSHEET_ID=... RANGE="DATA PEGAWAI!A:AD"`).
- Migrasi password lama ke hash (sekali jalan): `npm run migrate-passwords` (opsional `--dry-run`).
- Endpoint:
  - GET `/health` (cek status).
  - POST `/login` dengan `{"username":"","password":""}` memakai sheet `username!A:E`.
  - GET `/pegawai` (baca data pegawai).
  - POST `/pegawai` body JSON sesuai urutan kolom (lihat "Struktur sheet" atau `DOCUMENTATION.md`).
  - PUT `/pegawai/:id` dan DELETE `/pegawai/:id` (backend Node).

## Dashboard
- File: `dashboard.html`
- `API_BASE` diarahkan ke Cloudflare Worker (lihat bagian atas).
- Gunakan login dari sheet `username`.

## Update terbaru
- Perbaikan tampilan status pada `data-pegawai/index.html`: ringkasan, chip filter, dan kolom status kini memakai `nama_status_aktif` (bukan `nama_jenis_pegawai`).
- Sinkronisasi nama/role user pada header `bezetting/index.html` agar mengikuti `authUser`.
- Pemutusan JF: layout sidebar/header dikembalikan seperti semula dan media query diperbaiki (file `pemutusan-jf/index.html`).

## Struktur sheet
- Data: `DATA PEGAWAI` (A:AD)
  1. nama_pegawai
  2. npwp
  3. no_bpjs
  4. nama_jabatan_orb
  5. nama_jabatan_prb
  6. nama_status_aktif
  7. nama_status_rumpun
  8. jenis_kontrak
  9. nip
  10. jenis_kelamin
  11. tmt_kerja_ukpd
  12. tempat_lahir
  13. tanggal_lahir
  14. agama
  15. jenjang_pendidikan
  16. jurusan_pendidikan
  17. no_tlp
  18. email
  19. nama_ukpd
  20. wilayah_ukpd
  21. golongan_darah
  22. gelar_depan
  23. gelar_belakang
  24. status_pernikahan
  25. nama_jenis_pegawai
  26. catatan_revisi_biodata
  27. alamat_ktp
  28. alamat_domisili
  29. created_at
  30. updated_at
- Catatan: NIP bersifat opsional. Jika NIP kosong, identifikasi data memakai kombinasi `nama_pegawai + tanggal_lahir`, jadi pastikan kombinasi tersebut unik agar proses edit/hapus tidak ambigu.
- Login: `username` (A:E) kolom Nama UKPD, Username, Password, Hak akses, Wilayah. Password disimpan hash `sha256$<salt>$<hash>` (login akan upgrade jika masih plaintext).

## Troubleshooting
- Response `forbidden`: cek `PROXY_KEY` (frontend vs Worker) dan `APPS_SCRIPT_KEY` (Worker) harus sama dengan `API_KEY` di `code.js`.
- Front-end tidak tersambung: pastikan `API_BASE` adalah URL Worker dan Worker sudah Deploy.
- Range salah: sesuaikan konstanta `RANGE` atau `USER_RANGE` di `server.js` (jika memakai backend Node).

## Panduan Upload ke GitHub
1. Pastikan file `.gitignore` sudah ada (untuk menyembunyikan `node_modules` dan file rahasia).
2. Inisialisasi Git: `git init`
3. Tambahkan file: `git add .`
4. Commit pertama: `git commit -m "Initial commit"`
5. Ubah branch ke main: `git branch -M main`
6. Tambahkan remote (ganti URL dengan repo Anda): `git remote add origin https://github.com/USERNAME/REPO.git`
7. Push code: `git push -u origin main`

## Panduan Deploy ke Render (Gratis)
1. Buka dashboard.render.com dan login.
2. Klik **New +** -> **Web Service**.
3. Pilih **Build and deploy from a Git repository** dan connect ke repo GitHub Anda.
4. Beri nama service, pilih Region (misal: Singapore).
5. **Build Command**: `npm install`
6. **Start Command**: `node server.js`
7. Scroll ke bawah ke bagian **Environment Variables**:
   - Key: `SPREADSHEET_ID`, Value: `(ID Spreadsheet Anda)`
   - Key: `SESSION_TTL`, Value: `3600`
8. Bagian **Secret Files** (Penting untuk Service Account):
   - Klik **Add Secret File**.
   - Filename: `service-account.json`
   - Content: (Copy paste isi file JSON service account Anda di sini).
9. Klik **Create Web Service**.
