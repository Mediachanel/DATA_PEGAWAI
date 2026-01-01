﻿# Dokumentasi Integrasi SI Data Pegawai

## Log Kegiatan Terbaru (Des 2025)
- Perbaikan pencarian Data Pegawai: semua filter dinormalisasi ke string sebelum `toLowerCase()` sehingga tidak error saat nilai numerik/undefined.
- Pengambilan data/aksi API dibungkus `safeHandle_()` agar error selalu JSON (tidak lagi HTML/DOCTYPE) dan login/search tidak gagal parse.
- Pencarian Data Pegawai di UI hanya dijalankan saat klik tombol Terapkan (atau Enter), tidak lagi auto-run setiap ketik.
- Revert branding MANDALA ke Dinas Kesehatan; hapus menu Verifikasi & Validasi serta Master Data dari sidebar (tersisa QnA untuk superadmin).
- Percepatan Apps Script `code.js`: cache untuk `list`, `mutasi_list`, `pemutusan_jf_list`, `bezetting_list`, `qna_list`, dan `dashboard_stats`. TTL default: list 20s, dashboard 30s, bezetting 60s, meta 300s.
- Cache invalidasi otomatis via `bumpCacheVersion()` pada create/update/delete (pegawai, mutasi, pemutusan JF, bezetting, QnA). Bisa bypass cache dengan query `nocache=1` atau `cache=0`.
- Mapping UKPD->wilayah sekarang di-cache untuk filter wilayah (mutasi/pemutusan JF).
- Cloudflare Worker mendukung TTL khusus bezetting via env `CACHE_TTL_BEZETTING`.
- Backend Node men-cache bezetting in-memory (env `BEZETTING_CACHE_TTL`) dan invalidasi saat create/update/delete.
- Frontend bezetting memakai API lokal saat localhost dan input search sudah debounce; loader global diperbarui (orbital + skeleton shimmer).
- Usulan Mutasi: status dan keterangan hanya bisa diubah oleh superadmin; admin UKPD/wilayah dikunci di UI dan di backend (status non-super dipaksa `DIUSULKAN`, update status/keterangan diabaikan).
- Pemutusan JF: tombol "Cetak Word" hanya untuk superadmin dan memakai template DOCX `templates/Putus JF Batch 3.docx` dengan pengisian placeholder.
- Template kajian mutasi disimpan di `templates/usulan-mutasi-kajian.html`.

## Backend (Node/Express + Google Sheets)
- File: `server.js`
- Port: 5002 (dipakai bila menjalankan backend Node; front-end default kini langsung ke Web App Apps Script)
- Spreadsheet ID: `1Bjz0kVWodHQUr0O9FiVPd7Z9LrQVY4GG6nZiczlv_Vw`
- Sheet data: `DATA PEGAWAI!A:AD` (30 kolom)
- Sheet login: `username!A:E` (Nama UKPD, Username, Password, Hak akses, Wilayah)
- Service account: file JSON di folder (mis. `update-bezetting-8055dfe44912.json`), spreadsheet harus dibagikan ke `data-pegawai-2025@update-bezetting.iam.gserviceaccount.com` (Editor).

## Frontend
- Halaman berada di folder index-based: `/DATA_PEGAWAI/` (login), `/DATA_PEGAWAI/dashboard/`, `/DATA_PEGAWAI/data-pegawai/`, `/DATA_PEGAWAI/profil/`, `/DATA_PEGAWAI/usulan-mutasi/`, `/DATA_PEGAWAI/pemutusan-jf/`, `/DATA_PEGAWAI/bezetting/`, `/DATA_PEGAWAI/ubah-password/`. Base path dihitung otomatis: jika di GitHub Pages akan memakai `/DATA_PEGAWAI/`, jika lokal cukup `/`.
- Header/sidebar/footer di-root (`header.html`, `sidebar.html`, `footer.html`) diambil dengan BASE dinamis; logo/favikon juga di-set ulang via BASE + `foto/Dinkes.png`.

### Kolom data (urutan A:AD)
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
Catatan:
- NIP bersifat opsional. Jika NIP kosong, identifikasi data memakai kombinasi `nama_pegawai + tanggal_lahir`, jadi pastikan kombinasi tersebut unik agar proses edit/hapus tidak ambigu.

### Usulan Mutasi (USULAN_MUTASI!A:AC, 29 kolom)
1. id
2. nip
3. nama_pegawai
4. gelar_depan
5. gelar_belakang
6. pangkat_golongan
7. jabatan
8. abk_j_lama
9. bezetting_j_lama
10. nonasn_bezetting_lama
11. nonasn_abk_lama
12. jabatan_baru
13. abk_j_baru
14. bezetting_j_baru
15. nonasn_bezetting_baru
16. nonasn_abk_baru
17. nama_ukpd
18. ukpd_tujuan
19. alasan
20. tanggal_usulan
21. status
22. berkas_path
23. created_by_ukpd
24. created_at
25. updated_at
26. keterangan
27. mutasi_id
28. jenis_mutasi
29. verif_checklist
Catatan usulan mutasi:
- Tombol "Validasi" dan "Cetak Word" hanya muncul untuk superadmin.
- Admin UKPD/wilayah tidak bisa mengubah `status` dan `keterangan` (dikunci di UI dan di-backend).
- Status untuk non-superadmin selalu diset ke `DIUSULKAN` saat create/update.

### Usulan Pemutusan JF (USULAN_PEMUTUSAN_JF!A:U, 21 kolom)
1. id
2. nip
3. pangkat_golongan
4. nama_pegawai
5. jabatan
6. jabatan_baru
7. angka_kredit
8. alasan_pemutusan
9. nomor_surat
10. tanggal_surat
11. hal
12. pimpinan
13. asal_surat
14. nama_ukpd
15. tanggal_usulan
16. status
17. berkas_path
18. created_by_ukpd
19. created_at
20. updated_at
21. keterangan

Catatan pemutusan JF:
- Backend dan front-end melakukan normalisasi header (lowercase + underscore). Jika sheet masih memakai nama lama, fallback dilakukan:
  - `id_usulan` -> `id`
  - `pangkat_gol` -> `pangkat_golongan`
  - `jabatan_lama` -> `jabatan`
  - `ukpd` -> `nama_ukpd`
  - `alasan_usulan` -> `alasan_pemutusan`
  - `link_dokumen` -> `berkas_path`
- Urutan tampil di tabel: status `DIUSULKAN`, `DIPROSES`, `SELESAI`, `DITOLAK`; di dalam status disortir terbaru berdasarkan `created_at` -> `tanggal_usulan` -> `updated_at` -> `tanggal_surat`.

### Aturan Akses Wilayah/UKPD
- Superadmin: lihat semua data.
- Admin Wilayah: data dibatasi sesuai `wilayah` login.
- Admin UKPD: data dibatasi UKPD login.
- Frontend mengirim query `wilayah`/`ukpd` otomatis saat load; backend memfilter ulang sesuai query.
- Penambahan data otomatis mengisi `tanggal_usulan`, `created_at`, `updated_at` (pemutusan JF). Untuk mutasi, filter wilayah dihitung dari mapping `nama_ukpd` -> `wilayah` di sheet `username` (kolom wilayah tidak disimpan di sheet mutasi).
- Filter wilayah untuk pemutusan JF dihitung dari mapping `nama_ukpd` -> `wilayah` di sheet `username` (kolom wilayah tidak disimpan di sheet pemutusan).

### Endpoint utama (action-based)
Semua request lewat Cloudflare Worker, gunakan query/body `action`.

GET
- `?action=health` - cek status.
- `?action=list` - daftar pegawai (query: `offset`, `limit`, `search`, `unit`, `jabatan`, `status`).
- `?action=dashboard_stats` - ringkasan dashboard (query sama seperti `list`).
- `?action=get&id=...` - detail pegawai.
- `?action=mutasi_list`, `?action=pemutusan_jf_list`, `?action=bezetting_list`, `?action=qna_list`.

POST (JSON)
- `action=login`
- `action=password_change`
- `action=create|update|delete` (pegawai)
- `action=mutasi_create|mutasi_update|mutasi_delete`
- `action=pemutusan_jf_create|pemutusan_jf_update|pemutusan_jf_delete`
- `action=bezetting_create|bezetting_update|bezetting_delete`
- `action=upload`

Keamanan:
- Frontend mengirim header `X-Proxy-Key` ke Worker.
- Worker menambahkan query `key` untuk Apps Script (harus sama dengan `API_KEY` di `code.js`).
- Password disimpan hash `sha256$<salt>$<hash>`; login menerima plaintext/hashed dan akan upgrade otomatis ke hash saat login sukses.
- Untuk migrasi massal password lama di sheet `username`, jalankan `npm run migrate-passwords` (opsional `--dry-run`) di backend Node.

### Catatan backend
- Header sheet di-normalisasi (trim + lowercase) dan ada fallback index, sehingga tetap terbaca meski ada spasi tersembunyi.
- Untuk pemutusan JF, ada fallback nama kolom lama (id_usulan, pangkat_gol, jabatan_lama, ukpd, alasan_usulan, link_dokumen) agar data lama tetap terbaca.
- Role filter di front-end juga normalisasi nama_ukpd (trim + lowercase).

## Front-end
- File utama: `index.html`, `dashboard.html`, `data-pegawai.html`, `profil.html`, `usulan-mutasi.html`, `pemutusan-jf/index.html`, `bezetting/index.html`, `ubah-password/index.html`.
- `API_BASE` default: `https://sikepeg.seftianh23.workers.dev` (Cloudflare Worker). Frontend hanya memanggil Worker.
- Sidebar dan header diinject dari `sidebar.html` dan `header.html` (sticky). Footer dari `footer.html` dipakai di dashboard dan data-pegawai.
- Auth disimpan di `localStorage` (`authUser`: username, role, namaUkpd) setelah login di `index.html`.
- Role filter: non-super/dinkes otomatis hanya melihat data UKPD login; super admin/dinkes dapat melihat semua.

### Dashboard (`dashboard.html`)
- Memuat header/footer/sidebar dinamis; menampilkan badge role/UKPD dari `authUser`.
- Fetch `?action=list` (limit default 20000, role non-superadmin otomatis filter `unit`), render KPI per status, chart status/UKPD/pendidikan/rumpun, tabel UKPD.
- Compact mode, tombol unduh PNG chart, sticky header.

### Data Pegawai (`data-pegawai.html`)
- Server-side pagination: query `?action=list` dengan `limit`, `offset`, `search`, `unit`, `jabatan`, `status` (chips). Non-superadmin otomatis kirim `unit`.
- Form validasi: dropdown status rumpun, jenis kontrak, agama, status aktif, jenis kelamin, golongan darah, jenjang pendidikan, status pernikahan. Semua field wajib; tanggal pakai `type=date`; UKPD otomatis sesuai login (readonly untuk non-superadmin).
- Tabel aksi dengan ikon (lihat profil → simpan ke `localStorage` dan buka `profil.html`, edit, hapus). Footer konsisten.

### Profil (`profil.html`)
- Membaca `selectedPegawai` dari `localStorage` (klik "lihat profil"). Jika tidak ada, fallback fetch pertama sesuai role filter.
- Menampilkan profil lengkap: identitas, kepegawaian, pendidikan/gelar, kontak/alamat, catatan.

### Pemutusan JF (`pemutusan-jf/index.html`)
- List dan form mengikuti kolom baru (pangkat_golongan, jabatan, nama_ukpd, dll).
- Filter status + UKPD, sorting status berurutan dan terbaru (lihat catatan pemutusan JF di atas).
- Aksi per baris muncul via dropdown (Lihat/Ubah/Hapus + link berkas jika ada).
- Cetak Word: hanya superadmin, memakai template `templates/Putus JF Batch 3.docx`.
- Placeholder template pemutusan JF:
  - `Nomor_Surat`, `Tanggal_Surat`, `Hal`, `Pimpinan`, `ASAL_SURAT`, `Nama_`, `NIP`,
    `Pangkatgolongan`, `Nama_Jabatan_fungsional`, `UKPD`, `Alasan_Pemutusan`.

## Menjalankan (lokal)
1. Pastikan file key service account JSON ada di folder; spreadsheet dibagikan ke service account (Editor).
2. Jalankan backend (PowerShell):
   ```
   cd "D:\SI DATA PEGAWAI"
   $env:PORT=5002
   npm start
   ```
3. Jika ingin memakai backend lokal ini, ubah `API_BASE` di front-end menjadi `http://127.0.0.1:5002` (default repo mengarah ke Cloudflare Worker), lalu buka front-end (file:// atau server statis).

## Catatan percobaan proxy (Des 2025)
- Sudah dibuat fungsi proxy Vercel di `api/proxy.js` dan konfigurasi `vercel.json` untuk build route `/api/proxy` dengan env `WEB_APP_BASE` ke Apps Script. Deployment Vercel project `data` masih gagal (500) karena project terhubung ke repo lain yang belum memuat commit `api/proxy.js`/`vercel.json` atau belum redeploy dari commit terbaru.
- Cloudflare Worker proxy (`cf-worker-proxy.js`) aktif; set env `WEB_APP_BASE`, `PROXY_KEY`, `APPS_SCRIPT_KEY`, lalu gunakan URL Worker (mis. `https://sikepeg.seftianh23.workers.dev`).
- API_BASE di repo sekarang diarahkan ke Cloudflare Worker `https://sikepeg.seftianh23.workers.dev`.
- Jika ingin pakai proxy/backend publik lagi: pastikan deployment Vercel memakai repo commit terbaru (ada `api/proxy.js` + `vercel.json`) atau backend Render/Fly, set env `WEB_APP_BASE`, redeploy, lalu set `API_BASE` sesuai URL backend/proxy (mis. `https://<domain-vercel>/api/proxy` atau `https://nama-app.onrender.com`).

## Menjalankan via ngrok (sementara)
1. Backend di port 5002.
2. Jalankan `ngrok http 5002`, catat URL https ngrok.
3. Ubah `API_BASE` di `index.html`, `dashboard.html`, `data-pegawai.html`, `profil.html` ke URL ngrok tersebut; hard refresh halaman. (Hanya perlu jika memakai backend lokal; default repo sudah ke Cloudflare Worker.)

## Catatan UI
- Header sticky, logout merah, badge role/UKPD dari `authUser`.
- Sidebar logo 38px konsisten di semua halaman.
- Footer seragam via `footer.html` (dashboard, data-pegawai).

## Ringkasan Perubahan & Deployment
- Backend proxy: `server.js` mendukung `WEB_APP_BASE` (URL Apps Script /exec), CORS `*`, port default 5002. Env lain: `SPREADSHEET_ID`, `RANGE`, `USER_RANGE`.
- Endpoint baru usulan mutasi:
  - Sheet: `USULAN_MUTASI!A:AC` (id, nip, nama_pegawai, gelar_depan, gelar_belakang, pangkat_golongan, jabatan, abk_j_lama, bezetting_j_lama, nonasn_bezetting_lama, nonasn_abk_lama, jabatan_baru, abk_j_baru, bezetting_j_baru, nonasn_bezetting_baru, nonasn_abk_baru, nama_ukpd, ukpd_tujuan, alasan, tanggal_usulan, status, berkas_path, created_by_ukpd, created_at, updated_at, keterangan, mutasi_id, jenis_mutasi, verif_checklist).
  - API: `GET /mutasi` (filter: search, status, jenis_mutasi, ukpd, tujuan), `GET /mutasi/:id`, `POST /mutasi`, `PUT /mutasi/:id`, `DELETE /mutasi/:id`.
  - Upload berkas: `POST /upload` body `{filename,mimeType,dataBase64}`; simpan ke Google Drive (folder `DRIVE_FOLDER_ID` jika di-set), permission public reader; balikan `{url}` untuk diisi ke `berkas_url`.
- Front-end:
  - `dashboard.html`, `data-pegawai.html`, `profil.html`: sidebar/header/footer standar via include; sidebar fixed + toggle mobile/backdrop; layout responsif; logout nav pakai `data-logout`.
  - `sidebar.html`: ikon huruf sederhana, item Keluar pakai `data-logout`.
  - `data-pegawai.html`: textarea form distyling, panel responsif.
  - `profil.html`: footer include, sidebar mobile toggle.
- `usulan-mutasi.html`: halaman usulan mutasi (form tambah/ubah via modal, filter, tabel, metrik ringkas), `API_BASE` default ke Cloudflare Worker, upload PDF ke Drive via `/upload` (link disimpan di `berkas_path`).
- Tambahan file:
  - `DEPLOY.md`: panduan deploy backend (Render/Fly/Heroku), set `WEB_APP_BASE`, update `API_BASE` front-end.
  - `cf-worker-proxy.js`: Cloudflare Worker proxy ke Apps Script dengan CORS `*` (butuh var `WEB_APP_BASE` di Worker).

### Cara pakai Cloudflare Worker (opsi tanpa backend Node)
1) Cloudflare Dashboard → Workers & Pages → Create Worker → paste isi `cf-worker-proxy.js`.
2) Settings → Variables:
   - `WEB_APP_BASE=https://script.google.com/macros/s/AKfycbzUwGHAdQGsTu7Lh0E1zxPeLAFl3t7lgMeSvv6uB4WfS8mYn_dCC45TGI72t9I74ol_sw/exec`
   - `PROXY_KEY` sama dengan `PROXY_KEY` di front-end.
   - `APPS_SCRIPT_KEY` sama dengan `API_KEY` di `code.js` Apps Script.
3) Deploy, catat URL Worker, mis. `https://nama-worker.subdomain.workers.dev`.
4) Set `API_BASE` di `index.html`, `dashboard.html`, `data-pegawai.html`, `profil.html` ke URL Worker.
5) Hard refresh dan uji `action=health` dengan header `X-Proxy-Key`.

### Cara deploy backend Node (opsi Render)
1) Repo punya `server.js` dan `package.json` (`npm start`).
2) Render → New Web Service → Build `npm install`, Start `npm start`.
3) Env: `WEB_APP_BASE` (URL Apps Script /exec), `PORT` (boleh kosong).
4) Dapatkan URL publik, set `API_BASE` di semua HTML ke URL ini, push ke GitHub Pages.

### Menjalankan lokal
- Pastikan tidak ada proses lain di port 5002 (matikan server lama sebelum `npm start`).
- Jalankan backend: `npm start` (PORT default 5002).
- Jika memakai backend lokal ini, set `API_BASE` di front-end ke `http://127.0.0.1:5002`, lalu cek `http://127.0.0.1:5002/health` harus `{ok:true}`, `http://127.0.0.1:5002/mutasi` untuk usulan mutasi.
- Front-end lokal via `http-server` di port 5500/5501 (default repo `API_BASE` ke Cloudflare Worker; ganti ke localhost/ngrok/backend publik sesuai kebutuhan).
- Untuk upload berkas, set env `SERVICE_ACCOUNT_PATH` ke file JSON service account dan `DRIVE_FOLDER_ID` ke folder di Shared Drive yang sudah dibagikan Editor ke service account.

## Perubahan utama yang dilakukan
- Menyesuaikan layout sesuai contoh Dinkes: dashboard dan data pegawai dengan sidebar/header konsisten, stat cards, filter bar, tabel.
- Menambah pagination di front-end dan query filter di backend.
- Memperbaiki mapping kolom (trim header + fallback index) agar `nama_ukpd`, NIP, dll. terbaca.
- API_BASE di repo saat ini diarahkan ke Cloudflare Worker; ganti bila memakai backend lain (Render/ngrok/localhost).
