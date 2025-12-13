# Dokumentasi Integrasi SI Data Pegawai

## Backend (Node/Express + Google Sheets)
- File: `server.js`
- Port: 5002 (hardcode di front-end)
- Spreadsheet ID: `1Bjz0kVWodHQUr0O9FiVPd7Z9LrQVY4GG6nZiczlv_Vw`
- Sheet data: `DATA PEGAWAI!A:AB` (28 kolom)
- Sheet login: `username!A:D` (Nama UKPD, Username, Password, Hak akses)
- Service account: file JSON di folder (mis. `update-bezetting-8055dfe44912.json`), spreadsheet harus dibagikan ke `data-pegawai-2025@update-bezetting.iam.gserviceaccount.com` (Editor).

## Frontend
- Halaman berada di folder index-based: `/DATA_PEGAWAI/` (login), `/DATA_PEGAWAI/dashboard/`, `/DATA_PEGAWAI/data-pegawai/`, `/DATA_PEGAWAI/profil/`, `/DATA_PEGAWAI/usulan-mutasi/`. Base path dihitung otomatis: jika di GitHub Pages akan memakai `/DATA_PEGAWAI/`, jika lokal cukup `/`.
- Header/sidebar/footer di-root (`header.html`, `sidebar.html`, `footer.html`) diambil dengan BASE dinamis; logo/favikon juga di-set ulang via BASE + `foto/Dinkes.png`.

### Kolom data (urutan A:AB)
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
21. golongan_darah
22. gelar_depan
23. gelar_belakang
24. status_pernikahan
25. nama_jenis_pegawai
26. catatan_revisi_biodata
27. alamat_ktp
28. alamat_domisili

### Endpoint utama
- `GET /health` - cek status server.
- `POST /login` - body {username,password}; respon {user: {username, role, namaUkpd}}.
- `GET /pegawai` - dukung query: `offset`, `limit`, `search` (NIP/NIK/Nama), `unit` (nama_ukpd), `jabatan` (contains), `status` (comma). Respon: {rows, total, summary, units, jabs, statuses}.
- `POST /pegawai` - tambah baris sesuai urutan kolom (28 field).
- `PUT /pegawai/:id` - update berdasarkan NIP/NIK.
- `DELETE /pegawai/:id` - hapus berdasarkan NIP/NIK.

### Catatan backend
- Header sheet di-normalisasi (trim + lowercase) dan ada fallback index, sehingga tetap terbaca meski ada spasi tersembunyi.
- Role filter di front-end juga normalisasi nama_ukpd (trim + lowercase).

## Front-end
- File utama: `index.html`, `dashboard.html`, `data-pegawai.html`, `profil.html`, `usulan-mutasi.html`.
- `API_BASE` default: `http://127.0.0.1:5002` (ubah jika port/host berbeda, mis. URL ngrok/host publik).
- Sidebar dan header diinject dari `sidebar.html` dan `header.html` (sticky). Footer dari `footer.html` dipakai di dashboard dan data-pegawai.
- Auth disimpan di `localStorage` (`authUser`: username, role, namaUkpd) setelah login di `index.html`.
- Role filter: non-super/dinkes otomatis hanya melihat data UKPD login; super admin/dinkes dapat melihat semua.

### Dashboard (`dashboard.html`)
- Memuat header/footer/sidebar dinamis; menampilkan badge role/UKPD dari `authUser`.
- Fetch `/pegawai` (limit default 20000, role non-superadmin otomatis filter `unit`), render KPI per status, chart status/UKPD/pendidikan/rumpun, tabel UKPD.
- Compact mode, tombol unduh PNG chart, sticky header.

### Data Pegawai (`data-pegawai.html`)
- Server-side pagination: query `/pegawai` dengan `limit`, `offset`, `search`, `unit`, `jabatan`, `status` (chips). Non-superadmin otomatis kirim `unit`.
- Form validasi: dropdown status rumpun, jenis kontrak, agama, status aktif, jenis kelamin, golongan darah, jenjang pendidikan, status pernikahan. Semua field wajib; tanggal pakai `type=date`; UKPD otomatis sesuai login (readonly untuk non-superadmin).
- Tabel aksi dengan ikon (lihat profil → simpan ke `localStorage` dan buka `profil.html`, edit, hapus). Footer konsisten.

### Profil (`profil.html`)
- Membaca `selectedPegawai` dari `localStorage` (klik “lihat profil”). Jika tidak ada, fallback fetch pertama sesuai role filter.
- Menampilkan profil lengkap: identitas, kepegawaian, pendidikan/gelar, kontak/alamat, catatan.

## Menjalankan (lokal)
1. Pastikan file key service account JSON ada di folder; spreadsheet dibagikan ke service account (Editor).
2. Jalankan backend (PowerShell):
   ```
   cd "D:\SI DATA PEGAWAI"
   $env:PORT=5002
   npm start
   ```
3. Buka front-end (file:// atau server statis). `API_BASE` default ke `http://127.0.0.1:5002`.

## Catatan percobaan proxy (Des 2025)
- Sudah dibuat fungsi proxy Vercel di `api/proxy.js` dan konfigurasi `vercel.json` untuk build route `/api/proxy` dengan env `WEB_APP_BASE` ke Apps Script. Deployment Vercel project `data` masih gagal (500) karena project terhubung ke repo lain yang belum memuat commit `api/proxy.js`/`vercel.json` atau belum redeploy dari commit terbaru.
- Cloudflare Worker proxy (`cf-worker-proxy.js`) juga disiapkan, tetapi subdomain workers.dev belum aktif, sehingga tetap NXDOMAIN/1101.
- Akhirnya `API_BASE` front-end dikembalikan ke server lokal `http://127.0.0.1:5002`. Jalankan backend lokal sebelum mengakses front-end.
- Jika ingin pakai proxy publik lagi: pastikan deployment Vercel memakai repo commit terbaru (ada `api/proxy.js` + `vercel.json`), set env `WEB_APP_BASE`, redeploy, lalu set `API_BASE` ke `https://<domain-vercel>/api/proxy`.

## Menjalankan via ngrok (sementara)
1. Backend di port 5002.
2. Jalankan `ngrok http 5002`, catat URL https ngrok.
3. Ubah `API_BASE` di `index.html`, `dashboard.html`, `data-pegawai.html`, `profil.html` ke URL ngrok tersebut; hard refresh halaman.

## Catatan UI
- Header sticky, logout merah, badge role/UKPD dari `authUser`.
- Sidebar logo 38px konsisten di semua halaman.
- Footer seragam via `footer.html` (dashboard, data-pegawai).

## Ringkasan Perubahan & Deployment
- Backend proxy: `server.js` mendukung `WEB_APP_BASE` (URL Apps Script /exec), CORS `*`, port default 5002. Env lain: `SPREADSHEET_ID`, `RANGE`, `USER_RANGE`.
- Endpoint baru usulan mutasi:
  - Sheet: `USULAN_MUTASI!A:Q` (id, nip, nama_pegawai, jabatan_asal, jabatan_baru, nama_ukpd_asal, nama_ukpd_tujuan, jenis_mutasi, alasan, tanggal_usulan, status, keterangan, abk_j_lama, bezetting_j_lama, abk_j_baru, bezetting_j_baru, berkas_url).
  - API: `GET /mutasi` (filter: search, status, jenis_mutasi, ukpd, tujuan), `GET /mutasi/:id`, `POST /mutasi`, `PUT /mutasi/:id`, `DELETE /mutasi/:id`.
  - Upload berkas: `POST /upload` body `{filename,mimeType,dataBase64}`; simpan ke Google Drive (folder `DRIVE_FOLDER_ID` jika di-set), permission public reader; balikan `{url}` untuk diisi ke `berkas_url`.
- Front-end:
  - `dashboard.html`, `data-pegawai.html`, `profil.html`: sidebar/header/footer standar via include; sidebar fixed + toggle mobile/backdrop; layout responsif; logout nav pakai `data-logout`.
  - `sidebar.html`: ikon huruf sederhana, item Keluar pakai `data-logout`.
  - `data-pegawai.html`: textarea form distyling, panel responsif.
  - `profil.html`: footer include, sidebar mobile toggle.
- `usulan-mutasi.html`: halaman usulan mutasi (form tambah/ubah via modal, filter, tabel, metrik ringkas), `API_BASE` default ke `http://127.0.0.1:5002`, upload PDF ke Drive via `/upload` (link disimpan di `berkas_url`).
- Tambahan file:
  - `DEPLOY.md`: panduan deploy backend (Render/Fly/Heroku), set `WEB_APP_BASE`, update `API_BASE` front-end.
  - `cf-worker-proxy.js`: Cloudflare Worker proxy ke Apps Script dengan CORS `*` (butuh var `WEB_APP_BASE` di Worker).

### Cara pakai Cloudflare Worker (opsi tanpa backend Node)
1) Cloudflare Dashboard → Workers & Pages → Create Worker → paste isi `cf-worker-proxy.js`.
2) Settings → Variables: `WEB_APP_BASE=https://script.google.com/macros/s/AKfycbxFgN7dWixltKIgVGtURC8H8FtQamzym4Scmd4sjN7-oZMel4b0Gg5aVdKF6iz_XnI66g/exec`.
3) Deploy, catat URL Worker, mis. `https://nama-worker.subdomain.workers.dev`.
4) Set `API_BASE` di `index.html`, `dashboard.html`, `data-pegawai.html`, `profil.html` ke URL Worker.
5) Hard refresh dan uji `/health`/login.

### Cara deploy backend Node (opsi Render)
1) Repo punya `server.js` dan `package.json` (`npm start`).
2) Render → New Web Service → Build `npm install`, Start `npm start`.
3) Env: `WEB_APP_BASE` (URL Apps Script /exec), `PORT` (boleh kosong).
4) Dapatkan URL publik, set `API_BASE` di semua HTML ke URL ini, push ke GitHub Pages.

### Menjalankan lokal
- Pastikan tidak ada proses lain di port 5002 (matikan server lama sebelum `npm start`).
- Jalankan backend: `npm start` (PORT default 5002).
- Cek `http://127.0.0.1:5002/health` harus `{ok:true}`, `http://127.0.0.1:5002/mutasi` untuk usulan mutasi.
- Front-end lokal via `http-server` di port 5500/5501 (pastikan `API_BASE` bukan localhost:5002 jika pakai proxy publik).
- Untuk upload berkas, set env `SERVICE_ACCOUNT_PATH` ke file JSON service account dan `DRIVE_FOLDER_ID` ke folder di Shared Drive yang sudah dibagikan Editor ke service account.

## Perubahan utama yang dilakukan
- Menyesuaikan layout sesuai contoh Dinkes: dashboard dan data pegawai dengan sidebar/header konsisten, stat cards, filter bar, tabel.
- Menambah pagination di front-end dan query filter di backend.
- Memperbaiki mapping kolom (trim header + fallback index) agar `nama_ukpd`, NIP/NIK, dll. terbaca.
- Hardcode API_BASE ke port 5002 di semua halaman.
