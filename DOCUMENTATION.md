# Dokumentasi Integrasi SI Data Pegawai

## Backend (Node/Express + Google Sheets)
- File: `server.js`
- Port: 5002 (hardcode di front-end)
- Spreadsheet ID: `1Bjz0kVWodHQUr0O9FiVPd7Z9LrQVY4GG6nZiczlv_Vw`
- Sheet data: `DATA PEGAWAI!A:AB` (28 kolom)
- Sheet login: `username!A:D` (Nama UKPD, Username, Password, Hak akses)
- Service account: file JSON di folder (mis. `update-bezetting-8055dfe44912.json`), spreadsheet harus dibagikan ke `data-pegawai-2025@update-bezetting.iam.gserviceaccount.com` (Editor).

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
- `GET /health` — cek status server.
- `POST /login` — body {username,password}; respon {user: {username, role, namaUkpd}}.
- `GET /pegawai` — dukung query: `offset` (default 0), `limit` (default 20000), `search` (NIP/NIK/Nama), `unit` (nama_ukpd), `jabatan` (contains), `status` (comma). Respon: {rows, total, summary, units, jabs, statuses}.
- `POST /pegawai` — tambah baris sesuai urutan kolom (28 field).
- `PUT /pegawai/:id` — update berdasarkan NIP/NIK.
- `DELETE /pegawai/:id` — hapus berdasarkan NIP/NIK.

### Catatan backend
- Header sheet di-normalisasi (trim + lowercase) dan ada fallback index, sehingga tetap terbaca meski ada spasi tersembunyi.
- Role filter di front-end juga normalisasi nama_ukpd (trim + lowercase).

## Front-end
- File utama: `index.html`, `dashboard.html`, `data-pegawai.html`, `profil.html`.
- `API_BASE` hardcode: `http://127.0.0.1:5002` (ubah jika port/host berbeda).
- Sidebar/header diinject dari `sidebar.html` dan `header.html`; menu aktif disesuaikan per halaman.
- Login via `index.html` ? simpan `authUser` (username, role, namaUkpd) di localStorage.

### Dashboard (`dashboard.html`)
- Auto fetch `/pegawai?limit=20000` (atau dengan `unit` jika role bukan superadmin).
- Stat cards by status (PNS/CPNS/PPPK/PROFESIONAL/PJLP), filter bar (search, UKPD, jabatan, chips status), tabel ringkas.

### Data Pegawai (`data-pegawai.html`)
- Fetch `/pegawai` dengan limit besar (20000) + filter UKPD jika admin UKPD.
- Filter: search, UKPD, jabatan, status chips; pagination (page info, prev/next, page size).
- Tabel lengkap, actions Edit/Hapus, modal tambah/edit (manual trigger via tombol +).

### Profil (`profil.html`)
- Menampilkan profil singkat pegawai (baris pertama sesuai role filter).

## Menjalankan
1. Pastikan key JSON ada di folder; spreadsheet dibagikan ke service account (Editor).
2. Jalankan backend (PowerShell):
   ```
   $env:PORT=5002; npm start
   ```
3. Buka front-end (file:// atau via server statis); refresh. Front-end sudah mengarah ke port 5002.

## Perubahan utama yang dilakukan
- Menyesuaikan layout sesuai contoh Dinkes: dashboard dan data pegawai dengan sidebar/header konsisten, stat cards, filter bar, tabel.
- Menambah pagination di front-end dan query filter di backend.
- Memperbaiki mapping kolom (trim header + fallback index) agar `nama_ukpd`, NIP/NIK, dll. terbaca.
- Hardcode API_BASE ke port 5002 di semua halaman.
