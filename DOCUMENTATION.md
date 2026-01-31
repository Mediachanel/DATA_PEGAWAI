# Dokumentasi Integrasi SI Data Pegawai

Dokumen ini adalah **sumber utama** (single source of truth). README hanya ringkas dan mengarah ke dokumen ini.

---

## Links

- Repo: `https://github.com/Mediachanel/DATA_PEGAWAI`
- GitHub Pages: `https://mediachanel.github.io/DATA_PEGAWAI/`

---

## Gambaran Umum

SIKEPEG memakai Google Sheets sebagai database utama. Akses data dilakukan lewat:
- **Apps Script Web App** (`code.js`) dengan endpoint action-based (utama), atau
- **Node/Express** (`server.js`) dengan service account (opsional).

Frontend memanggil API melalui Cloudflare Worker (disarankan), atau langsung ke Apps Script saat lokal.

---

## Struktur Folder Frontend

Halaman utama berada di folder index-based:
- `/` (login / index.html)
- `/home/`
- `/dashboard/`
- `/data-pegawai/`
- `/profil/`
- `/usulan-mutasi/`
- `/pemutusan-jf/`
- `/bezetting/`
- `/ubah-password/`

Komponen bersama:
- `header.html`
- `sidebar.html`
- `footer.html`

Base path dihitung otomatis:
- Lokal: `/`
- GitHub Pages: `/<NAMA_REPO>/` (contoh `/DATA_PEGAWAI/`)

---

## Backend Utama (Apps Script)

File: `code.js`

### Konsep Endpoint (action-based)
Semua request memakai query/body `action`.

**GET**
- `?action=health`
- `?action=list`
- `?action=dashboard_stats`
- `?action=get&id=...`
- `?action=mutasi_list`
- `?action=pemutusan_jf_list`
- `?action=bezetting_list`
- `?action=qna_list`

**POST (JSON)**
- `action=login`
- `action=password_change`
- `action=create|update|delete` (pegawai)
- `action=mutasi_create|mutasi_update|mutasi_delete`
- `action=pemutusan_jf_create|pemutusan_jf_update|pemutusan_jf_delete`
- `action=bezetting_create|bezetting_update|bezetting_delete`
- `action=upload`

### Keamanan
- Frontend mengirim header `X-Proxy-Key` ke Worker.
- Worker menambahkan `key` ke Apps Script.
- `key` harus sama dengan `API_KEY` di `code.js`.

### Cache
- `list`: 20s
- `dashboard_stats`: 30s
- `bezetting_list`: 60s
- `meta/ukpd map`: 300s

Bisa bypass cache dengan query `nocache=1` atau `cache=0`.

---

## Backend Opsional (Node/Express)

File: `server.js`

Digunakan jika ingin akses Google Sheets via service account.

### Setup
- Taruh file service account JSON di folder ini.
- Spreadsheet harus di-share ke email service account (Editor).

### Jalankan
- `npm install`
- `npm start`

### Endpoint
- `GET /health`
- `POST /login`
- `GET /pegawai`
- `POST /pegawai`
- `PUT /pegawai/:id`
- `DELETE /pegawai/:id`

---

## Struktur Sheet

### DATA PEGAWAI (A:AD, 30 kolom)
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
- NIP opsional. Jika kosong, identifikasi pakai kombinasi `nama_pegawai + tanggal_lahir` (harus unik).

### USERNAME (A:E)
- Nama UKPD | Username | Password | Hak akses | Wilayah
- Password disimpan hash `sha256$<salt>$<hash>` (auto-upgrade saat login jika masih plaintext).

### USULAN_MUTASI (A:AC, 29 kolom)
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

### USULAN_PEMUTUSAN_JF (A:U, 21 kolom)
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

Fallback header untuk pemutusan (legacy):
- `id_usulan` -> `id`
- `pangkat_gol` -> `pangkat_golongan`
- `jabatan_lama` -> `jabatan`
- `ukpd` -> `nama_ukpd`
- `alasan_usulan` -> `alasan_pemutusan`
- `link_dokumen` -> `berkas_path`

---

## Aturan Akses

- **Superadmin/Dinkes**: lihat semua data.
- **Admin Wilayah**: data sesuai wilayah login.
- **Admin UKPD**: data sesuai UKPD login.

Filter wilayah dihitung dari mapping `nama_ukpd -> wilayah` di sheet `username`.

---

## Cloudflare Worker (Recommended)

Frontend sebaiknya memanggil Worker, bukan Apps Script langsung.

- Frontend kirim `X-Proxy-Key`.
- Worker menambahkan query `key` ke Apps Script.
- `PROXY_KEY` (frontend/worker) harus sama dengan `API_KEY` di Apps Script.

---

## Troubleshooting

- **forbidden**: cek `PROXY_KEY` dan `API_KEY`.
- **Data tidak muncul**: cek role filter UKPD/Wilayah.
- **Sheet kosong/offset kolom**: pastikan header mulai dari kolom A dan urut sesuai struktur.

---

## Catatan UI

- Sidebar/Header/Footer di-load dari file root (`sidebar.html`, `header.html`, `footer.html`).
- `BASE` otomatis menyesuaikan GitHub Pages atau lokal.
- Data Pegawai: filter client-side setelah load awal.
- Profil: membaca `selectedPegawai` dari localStorage.

---

## Changelog Singkat (Des 2025)

- Perbaikan sidebar/header, tampilan status, dan pencarian client-side.
- Cache API untuk list, dashboard, bezetting, qna.
- Filter wilayah/role diseragamkan.
