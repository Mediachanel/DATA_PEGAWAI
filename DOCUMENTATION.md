# Dokumentasi Integrasi SI Data Pegawai

## Backend (Node/Express + Google Sheets)
- File: `server.js`
- Port: 5002 (dipakai bila menjalankan backend Node; front-end default kini langsung ke Web App Apps Script)
- Spreadsheet ID: `1Bjz0kVWodHQUr0O9FiVPd7Z9LrQVY4GG6nZiczlv_Vw`
- Sheet data: `DATA PEGAWAI!A:AC` (29 kolom)
- Sheet login: `username!A:E` (Nama UKPD, Username, Password, Hak akses, Wilayah)
- Service account: file JSON di folder (mis. `update-bezetting-8055dfe44912.json`), spreadsheet harus dibagikan ke `data-pegawai-2025@update-bezetting.iam.gserviceaccount.com` (Editor).

## Frontend
- Halaman berada di folder index-based: `/DATA_PEGAWAI/` (login), `/DATA_PEGAWAI/dashboard/`, `/DATA_PEGAWAI/data-pegawai/`, `/DATA_PEGAWAI/profil/`, `/DATA_PEGAWAI/usulan-mutasi/`. Base path dihitung otomatis: jika di GitHub Pages akan memakai `/DATA_PEGAWAI/`, jika lokal cukup `/`.
- Header/sidebar/footer di-root (`header.html`, `sidebar.html`, `footer.html`) diambil dengan BASE dinamis; logo/favikon juga di-set ulang via BASE + `foto/Dinkes.png`.

### Kolom data (urutan A:AC)
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

### Usulan Mutasi (USULAN_MUTASI!A:S, 19 kolom)
1. id
2. nip
3. nama_pegawai
4. jabatan_asal
5. jabatan_baru
6. nama_ukpd_asal
7. nama_ukpd_tujuan
8. wilayah_asal
9. wilayah_tujuan
10. jenis_mutasi
11. alasan
12. tanggal_usulan
13. status
14. keterangan
15. abk_j_lama
16. bezetting_j_lama
17. abk_j_baru
18. bezetting_j_baru
19. berkas_url

### Usulan Pemutusan JF (USULAN_PEMUTUSAN_JF!A:T, 20 kolom)
1. id_usulan
2. status
3. nama_pegawai
4. nip
5. pangkat_gol
6. jabatan_lama
7. jabatan_baru
8. angka_kredit
9. ukpd
10. wilayah
11. nomor_surat
12. tanggal_surat
13. alasan_usulan
14. link_dokumen
15. verifikasi_oleh
16. verifikasi_tanggal
17. verifikasi_catatan
18. dibuat_oleh
19. dibuat_pada
20. diupdate_pada

### Aturan Akses Wilayah/UKPD
- Superadmin: lihat semua data.
- Admin Wilayah: data dibatasi sesuai `wilayah` login.
- Admin UKPD: data dibatasi UKPD login.
- Frontend mengirim query `wilayah`/`ukpd` otomatis saat load; backend memfilter ulang sesuai query.
- Penambahan data otomatis mengisi `wilayah` (pemutusan JF) atau `wilayah_asal/tujuan` (mutasi) dari sheet `username` jika kosong.

### Endpoint utama (action-based)
Semua request lewat Cloudflare Worker, gunakan query/body `action`.

GET
- `?action=health` - cek status.
- `?action=list` - daftar pegawai (query: `offset`, `limit`, `search`, `unit`, `jabatan`, `status`).
- `?action=get&id=...` - detail pegawai.
- `?action=mutasi_list`, `?action=pemutusan_jf_list`, `?action=bezetting_list`.

POST (JSON)
- `action=login`
- `action=create|update|delete` (pegawai)
- `action=mutasi_create|mutasi_update|mutasi_delete`
- `action=pemutusan_jf_create|pemutusan_jf_update|pemutusan_jf_delete`
- `action=bezetting_create|bezetting_update|bezetting_delete`
- `action=upload`

Keamanan:
- Frontend mengirim header `X-Proxy-Key` ke Worker.
- Worker menambahkan query `key` untuk Apps Script (harus sama dengan `API_KEY` di `code.js`).

### Catatan backend
- Header sheet di-normalisasi (trim + lowercase) dan ada fallback index, sehingga tetap terbaca meski ada spasi tersembunyi.
- Role filter di front-end juga normalisasi nama_ukpd (trim + lowercase).

## Front-end
- File utama: `index.html`, `dashboard.html`, `data-pegawai.html`, `profil.html`, `usulan-mutasi.html`.
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
  - Sheet: `USULAN_MUTASI!A:S` (id, nip, nama_pegawai, jabatan_asal, jabatan_baru, nama_ukpd_asal, nama_ukpd_tujuan, jenis_mutasi, alasan, tanggal_usulan, status, keterangan, abk_j_lama, bezetting_j_lama, abk_j_baru, bezetting_j_baru, berkas_url).
  - API: `GET /mutasi` (filter: search, status, jenis_mutasi, ukpd, tujuan), `GET /mutasi/:id`, `POST /mutasi`, `PUT /mutasi/:id`, `DELETE /mutasi/:id`.
  - Upload berkas: `POST /upload` body `{filename,mimeType,dataBase64}`; simpan ke Google Drive (folder `DRIVE_FOLDER_ID` jika di-set), permission public reader; balikan `{url}` untuk diisi ke `berkas_url`.
- Front-end:
  - `dashboard.html`, `data-pegawai.html`, `profil.html`: sidebar/header/footer standar via include; sidebar fixed + toggle mobile/backdrop; layout responsif; logout nav pakai `data-logout`.
  - `sidebar.html`: ikon huruf sederhana, item Keluar pakai `data-logout`.
  - `data-pegawai.html`: textarea form distyling, panel responsif.
  - `profil.html`: footer include, sidebar mobile toggle.
- `usulan-mutasi.html`: halaman usulan mutasi (form tambah/ubah via modal, filter, tabel, metrik ringkas), `API_BASE` default ke Cloudflare Worker, upload PDF ke Drive via `/upload` (link disimpan di `berkas_url`).
- Tambahan file:
  - `DEPLOY.md`: panduan deploy backend (Render/Fly/Heroku), set `WEB_APP_BASE`, update `API_BASE` front-end.
  - `cf-worker-proxy.js`: Cloudflare Worker proxy ke Apps Script dengan CORS `*` (butuh var `WEB_APP_BASE` di Worker).

### Cara pakai Cloudflare Worker (opsi tanpa backend Node)
1) Cloudflare Dashboard → Workers & Pages → Create Worker → paste isi `cf-worker-proxy.js`.
2) Settings → Variables: `WEB_APP_BASE=https://script.google.com/macros/s/AKfycbxpYfK6Q2_GQzMM0_sTD7ts_SMz2z8aMa-pDd_WfGfuCLagwxf-UjNJDyV1TTLIk0AKxQ/exec`.
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
- Jika memakai backend lokal ini, set `API_BASE` di front-end ke `http://127.0.0.1:5002`, lalu cek `http://127.0.0.1:5002/health` harus `{ok:true}`, `http://127.0.0.1:5002/mutasi` untuk usulan mutasi.
- Front-end lokal via `http-server` di port 5500/5501 (default repo `API_BASE` ke Cloudflare Worker; ganti ke localhost/ngrok/backend publik sesuai kebutuhan).
- Untuk upload berkas, set env `SERVICE_ACCOUNT_PATH` ke file JSON service account dan `DRIVE_FOLDER_ID` ke folder di Shared Drive yang sudah dibagikan Editor ke service account.

## Perubahan utama yang dilakukan
- Menyesuaikan layout sesuai contoh Dinkes: dashboard dan data pegawai dengan sidebar/header konsisten, stat cards, filter bar, tabel.
- Menambah pagination di front-end dan query filter di backend.
- Memperbaiki mapping kolom (trim header + fallback index) agar `nama_ukpd`, NIP/NIK, dll. terbaca.
- API_BASE di repo saat ini diarahkan ke Cloudflare Worker; ganti bila memakai backend lain (Render/ngrok/localhost).
