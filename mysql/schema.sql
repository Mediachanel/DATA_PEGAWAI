-- MySQL schema for SI DATA PEGAWAI (Hybrid)
-- Spreadsheet = master, MySQL = read DB, Cloudflare Worker = sync engine

-- Mirror kolom sheet `DATA PEGAWAI` + kolom hybrid (`sid`, `sync_*`) agar "sama persis".
-- Catatan: `db_synced_at` adalah waktu sinkronisasi ke DB (bukan kolom sheet).
CREATE TABLE IF NOT EXISTS pegawai (
  sid VARCHAR(36) NOT NULL,

  -- Kolom-kolom sesuai sheet (A:AD)
  nama_pegawai VARCHAR(255) NOT NULL,
  npwp VARCHAR(50) NULL,
  no_bpjs VARCHAR(50) NULL,
  nama_jabatan_orb VARCHAR(255) NULL,
  nama_jabatan_prb VARCHAR(255) NULL,
  nama_status_aktif VARCHAR(100) NULL,
  nama_status_rumpun VARCHAR(100) NULL,
  jenis_kontrak VARCHAR(100) NULL,
  nip VARCHAR(30) NULL,
  jenis_kelamin VARCHAR(30) NULL,
  tmt_kerja_ukpd VARCHAR(50) NULL,
  tempat_lahir VARCHAR(100) NULL,
  tanggal_lahir DATE NULL,
  agama VARCHAR(50) NULL,
  jenjang_pendidikan VARCHAR(100) NULL,
  jurusan_pendidikan VARCHAR(255) NULL,
  no_tlp VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  nama_ukpd VARCHAR(255) NULL,
  wilayah_ukpd VARCHAR(100) NULL,
  golongan_darah VARCHAR(10) NULL,
  gelar_depan VARCHAR(50) NULL,
  gelar_belakang VARCHAR(50) NULL,
  status_pernikahan VARCHAR(50) NULL,
  nama_jenis_pegawai VARCHAR(100) NULL,
  catatan_revisi_biodata TEXT NULL,
  alamat_ktp TEXT NULL,
  alamat_domisili TEXT NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,

  -- Kolom hybrid di sheet (akan ditambahkan otomatis oleh Apps Script)
  sync_status VARCHAR(20) NULL,
  sync_error VARCHAR(1000) NULL,
  synced_at DATETIME NULL,

  -- Kolom internal untuk rekonsiliasi & audit
  row_hash CHAR(64) NULL,
  db_synced_at DATETIME NOT NULL,

  PRIMARY KEY (sid),
  UNIQUE KEY uq_pegawai_nip (nip),
  KEY idx_pegawai_ukpd (nama_ukpd),
  KEY idx_pegawai_status (nama_status_aktif),
  KEY idx_pegawai_nama (nama_pegawai)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pegawai_stage (
  sid VARCHAR(36) NOT NULL,

  nama_pegawai VARCHAR(255) NOT NULL,
  npwp VARCHAR(50) NULL,
  no_bpjs VARCHAR(50) NULL,
  nama_jabatan_orb VARCHAR(255) NULL,
  nama_jabatan_prb VARCHAR(255) NULL,
  nama_status_aktif VARCHAR(100) NULL,
  nama_status_rumpun VARCHAR(100) NULL,
  jenis_kontrak VARCHAR(100) NULL,
  nip VARCHAR(30) NULL,
  jenis_kelamin VARCHAR(30) NULL,
  tmt_kerja_ukpd VARCHAR(50) NULL,
  tempat_lahir VARCHAR(100) NULL,
  tanggal_lahir DATE NULL,
  agama VARCHAR(50) NULL,
  jenjang_pendidikan VARCHAR(100) NULL,
  jurusan_pendidikan VARCHAR(255) NULL,
  no_tlp VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  nama_ukpd VARCHAR(255) NULL,
  wilayah_ukpd VARCHAR(100) NULL,
  golongan_darah VARCHAR(10) NULL,
  gelar_depan VARCHAR(50) NULL,
  gelar_belakang VARCHAR(50) NULL,
  status_pernikahan VARCHAR(50) NULL,
  nama_jenis_pegawai VARCHAR(100) NULL,
  catatan_revisi_biodata TEXT NULL,
  alamat_ktp TEXT NULL,
  alamat_domisili TEXT NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,

  sync_status VARCHAR(20) NULL,
  sync_error VARCHAR(1000) NULL,
  synced_at DATETIME NULL,

  row_hash CHAR(64) NULL,
  db_synced_at DATETIME NOT NULL,

  KEY idx_stage_sid (sid),
  KEY idx_stage_nip (nip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sync_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sid VARCHAR(36) NULL,
  nip VARCHAR(30) NULL,
  action VARCHAR(20) NOT NULL,
  ok TINYINT(1) NOT NULL,
  message VARCHAR(1000) NULL,
  row_hash CHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_sync_log_sid (sid),
  KEY idx_sync_log_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_runs (
  refresh_id CHAR(36) NOT NULL,
  entity VARCHAR(50) NULL,
  status VARCHAR(20) NOT NULL, -- STARTED|RECEIVING|COMMITTED|FAILED
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  committed_at DATETIME NULL,
  expected_row_count INT NULL,
  received_row_count INT NOT NULL DEFAULT 0,
  last_chunk_index INT NOT NULL DEFAULT -1,
  error VARCHAR(2000) NULL,

  PRIMARY KEY (refresh_id),
  KEY idx_refresh_runs_entity (entity),
  KEY idx_refresh_runs_status (status),
  KEY idx_refresh_runs_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- Mirror sheet: username
-- =========================
CREATE TABLE IF NOT EXISTS username (
  sid VARCHAR(36) NOT NULL,
  nama_ukpd VARCHAR(255) NULL,
  username VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  hak_akses VARCHAR(50) NULL,
  wilayah VARCHAR(100) NULL,

  sync_status VARCHAR(20) NULL,
  sync_error VARCHAR(1000) NULL,
  synced_at DATETIME NULL,
  row_hash CHAR(64) NULL,
  db_synced_at DATETIME NOT NULL,

  PRIMARY KEY (sid),
  UNIQUE KEY uq_username_username (username),
  KEY idx_username_ukpd (nama_ukpd),
  KEY idx_username_wilayah (wilayah)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- Mirror sheet: USULAN_MUTASI
-- =========================
CREATE TABLE IF NOT EXISTS usulan_mutasi (
  sid VARCHAR(36) NOT NULL,
  id VARCHAR(50) NULL,
  nip VARCHAR(30) NULL,
  nama_pegawai VARCHAR(255) NULL,
  gelar_depan VARCHAR(50) NULL,
  gelar_belakang VARCHAR(50) NULL,
  pangkat_golongan VARCHAR(50) NULL,
  jabatan VARCHAR(255) NULL,
  abk_j_lama VARCHAR(50) NULL,
  bezetting_j_lama VARCHAR(50) NULL,
  nonasn_bezetting_lama VARCHAR(50) NULL,
  nonasn_abk_lama VARCHAR(50) NULL,
  jabatan_baru VARCHAR(255) NULL,
  abk_j_baru VARCHAR(50) NULL,
  bezetting_j_baru VARCHAR(50) NULL,
  nonasn_bezetting_baru VARCHAR(50) NULL,
  nonasn_abk_baru VARCHAR(50) NULL,
  nama_ukpd VARCHAR(255) NULL,
  ukpd_tujuan VARCHAR(255) NULL,
  alasan TEXT NULL,
  tanggal_usulan DATETIME NULL,
  status VARCHAR(50) NULL,
  berkas_path VARCHAR(500) NULL,
  created_by_ukpd VARCHAR(255) NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  keterangan TEXT NULL,
  mutasi_id VARCHAR(50) NULL,
  jenis_mutasi VARCHAR(50) NULL,
  verif_checklist TEXT NULL,

  sync_status VARCHAR(20) NULL,
  sync_error VARCHAR(1000) NULL,
  synced_at DATETIME NULL,
  row_hash CHAR(64) NULL,
  db_synced_at DATETIME NOT NULL,

  PRIMARY KEY (sid),
  KEY idx_mutasi_nip (nip),
  KEY idx_mutasi_status (status),
  KEY idx_mutasi_ukpd (nama_ukpd),
  KEY idx_mutasi_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- Mirror sheet: USULAN_PEMUTUSAN_JF
-- =========================
CREATE TABLE IF NOT EXISTS usulan_pemutusan_jf (
  sid VARCHAR(36) NOT NULL,
  id VARCHAR(50) NULL,
  nip VARCHAR(30) NULL,
  pangkat_golongan VARCHAR(50) NULL,
  nama_pegawai VARCHAR(255) NULL,
  jabatan VARCHAR(255) NULL,
  jabatan_baru VARCHAR(255) NULL,
  angka_kredit VARCHAR(50) NULL,
  alasan_pemutusan TEXT NULL,
  nomor_surat VARCHAR(100) NULL,
  tanggal_surat DATETIME NULL,
  hal VARCHAR(255) NULL,
  pimpinan VARCHAR(255) NULL,
  asal_surat VARCHAR(255) NULL,
  nama_ukpd VARCHAR(255) NULL,
  tanggal_usulan DATETIME NULL,
  status VARCHAR(50) NULL,
  berkas_path VARCHAR(500) NULL,
  created_by_ukpd VARCHAR(255) NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,
  keterangan TEXT NULL,

  sync_status VARCHAR(20) NULL,
  sync_error VARCHAR(1000) NULL,
  synced_at DATETIME NULL,
  row_hash CHAR(64) NULL,
  db_synced_at DATETIME NOT NULL,

  PRIMARY KEY (sid),
  KEY idx_putus_nip (nip),
  KEY idx_putus_status (status),
  KEY idx_putus_ukpd (nama_ukpd),
  KEY idx_putus_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- Mirror sheet: Q n A
-- =========================
CREATE TABLE IF NOT EXISTS qna (
  sid VARCHAR(36) NOT NULL,
  id VARCHAR(50) NULL,
  category VARCHAR(100) NULL,
  question TEXT NULL,
  answer TEXT NULL,
  status VARCHAR(50) NULL,
  created_at DATETIME NULL,
  updated_at DATETIME NULL,

  sync_status VARCHAR(20) NULL,
  sync_error VARCHAR(1000) NULL,
  synced_at DATETIME NULL,
  row_hash CHAR(64) NULL,
  db_synced_at DATETIME NOT NULL,

  PRIMARY KEY (sid),
  KEY idx_qna_status (status),
  KEY idx_qna_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- Mirror sheet: bezetting
-- (kolom disesuaikan dengan output API `toBezettingRecord` di `code.js`)
-- =========================
CREATE TABLE IF NOT EXISTS bezetting (
  sid VARCHAR(36) NOT NULL,
  no VARCHAR(50) NULL,
  bidang VARCHAR(255) NULL,
  subbidang VARCHAR(255) NULL,
  nama_jabatan_pergub VARCHAR(255) NULL,
  nama_jabatan_permenpan VARCHAR(255) NULL,
  jabatan_orb VARCHAR(255) NULL,
  pangkat_golongan VARCHAR(50) NULL,
  rumpun_jabatan VARCHAR(255) NULL,
  kode VARCHAR(50) NULL,
  abk VARCHAR(50) NULL,
  eksisting VARCHAR(50) NULL,
  selisih VARCHAR(50) NULL,
  nama_pegawai VARCHAR(255) NULL,
  nip VARCHAR(30) NULL,
  nrk VARCHAR(30) NULL,
  status_formasi VARCHAR(100) NULL,
  pendidikan VARCHAR(100) NULL,
  keterangan TEXT NULL,
  sisa_formasi_2026 VARCHAR(50) NULL,
  kebutuhan_asn_2026 VARCHAR(50) NULL,
  perencanaan_kebutuhan VARCHAR(255) NULL,
  program_studi VARCHAR(255) NULL,
  perencanaan_pendidikan_lanjutan VARCHAR(255) NULL,
  ukpd VARCHAR(255) NULL,
  wilayah VARCHAR(100) NULL,

  sync_status VARCHAR(20) NULL,
  sync_error VARCHAR(1000) NULL,
  synced_at DATETIME NULL,
  row_hash CHAR(64) NULL,
  db_synced_at DATETIME NOT NULL,

  PRIMARY KEY (sid),
  KEY idx_bezetting_nip (nip),
  KEY idx_bezetting_ukpd (ukpd),
  KEY idx_bezetting_wilayah (wilayah)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
