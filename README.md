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

## Hybrid mode (Spreadsheet = master, MySQL = read DB)
Target: setiap edit baris di sheet `DATA PEGAWAI`, sistem memastikan ada `sid` (unik & stabil), update `updated_at`, lalu push ke Cloudflare Worker untuk upsert ke MySQL. Full refresh bisa dijalankan harian untuk safety.

## Status s.d. 2025-12-29
- MySQL lokal `pegawai` masih kosong (contoh: tabel `username` total_rows = 0).
- `DB_HTTP_URL` saat ini: `https://database.kepegawaian.media/db/query`.
- Health check gateway `https://database.kepegawaian.media/health` balas `502`.
- Reconcile worker balas `db_error: 500 internal_error` (indikasi gateway/DB belum sehat).
- MySQL client ditemukan di `C:\xampp\mysql\bin\mysql.exe`.

## Cek data MySQL lokal (langsung)
Gunakan MySQL client lokal:
```sql
SELECT username, db_synced_at
FROM username
WHERE DATE(db_synced_at) = CURDATE()
ORDER BY db_synced_at DESC;
```

### 1) Siapkan MySQL
- Jalankan schema: `mysql/schema.sql` (ini mirror semua sheet utama: `DATA PEGAWAI`, `username`, `USULAN_MUTASI`, `USULAN_PEMUTUSAN_JF`, `Q n A`, `bezetting`).
- Pastikan tabel: `pegawai`, `pegawai_stage`, `sync_log`, `refresh_runs` tersedia.
- Jika MySQL kamu versi lama (MySQL 5.7 / MariaDB) dan muncul error collation `utf8mb4_0900_ai_ci`, schema di repo sudah memakai `utf8mb4_unicode_ci`.

### 2) Jalankan MySQL HTTP gateway (Worker -> DB)
Worker butuh cara query MySQL. Opsi paling simpel: jalankan gateway ini.
- Masuk folder: `mysql-gateway/`
- Install: `npm install`
- Set env (contoh PowerShell):
  - `$env:DB_HOST="127.0.0.1"`
  - `$env:DB_PORT="3306"`
  - `$env:DB_USER="root"`
  - `$env:DB_PASS="..."`
  - `$env:DB_NAME="si_data_pegawai"`
  - `$env:DB_HTTP_TOKEN="replace-with-strong-token"`
- Start: `npm start`
- Health check: `GET http://localhost:8788/health`

### 3) Deploy Cloudflare Worker (pakai Worker yang sama)
- File Worker: `cf-worker-proxy.js` (sudah ditambah endpoint sync/refresh).
- Buat project wrangler: lihat `wrangler.toml` (sesuaikan `name` dan `WEB_APP_BASE`).
- Set secrets:
  - `wrangler secret put PROXY_KEY`
  - `wrangler secret put APPS_SCRIPT_KEY`
  - `wrangler secret put SYNC_KEY`
  - `wrangler secret put DB_HTTP_TOKEN`
- Set vars (contoh):
  - `wrangler deploy --var WEB_APP_BASE:https://script.google.com/macros/s/.../exec --var DB_HTTP_URL:https://<gateway>/db/query`

### 4) Update Apps Script (Spreadsheet side)
File Apps Script di repo: `code.js` (tambahan fungsi hybrid sudah ada).
- Deploy ulang Apps Script Web App seperti biasa.
- Buka Apps Script editor -> jalankan sekali:
  - `setHybridSyncConfig("https://<worker>.workers.dev", "<SYNC_KEY>")`
  - `backfillSID()` (sekali untuk isi `sid` untuk baris lama)
  - `auditNipDuplicates()` (opsional: cek NIP duplikat sebelum trigger diaktifkan)
  - `installTriggers()` (pasang onEdit installable trigger)

### 5) Full refresh harian (opsional, safety)
- Jalankan: `fullRefreshToMySQL()` dari Apps Script editor.

### Catatan penting
- Kolom baru akan ditambahkan otomatis ke header sheet `DATA PEGAWAI`: `sid`, `sync_status`, `sync_error`, `synced_at`.
- `nip` tetap opsional, tapi jika diisi akan dipaksa unik (create/update/onEdit).

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
