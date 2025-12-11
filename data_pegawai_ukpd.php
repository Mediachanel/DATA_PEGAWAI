<?php
// data_pegawai_ukpd.php — Daftar pegawai per UKPD + indikator kelengkapan
// - NIP & NRK gabung
// - Warning "!" di Nama kalau data belum lengkap
// - Aksi (Lihat / Edit / Hapus) pakai fallback nik -> nip -> nama+ukpd
// - KPI status pegawai

$DEBUG = false;
if ($DEBUG) {
  ini_set('display_errors',1);
  ini_set('display_startup_errors',1);
  error_reporting(E_ALL);
}

/* ===== Bootstrap & koneksi ===== */
require_once __DIR__ . '/includes/init.php';
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

if (session_status() !== PHP_SESSION_ACTIVE) { session_start(); }
if (!isset($conn) || !($conn instanceof mysqli)) {
  http_response_code(500);
  die('Koneksi database tidak tersedia.');
}

$conn->set_charset('utf8mb4');
$conn->query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
$conn->query("SET collation_connection = 'utf8mb4_unicode_ci'");
date_default_timezone_set('Asia/Jakarta');

/* ===== Helpers ===== */
if (!function_exists('e')) {
  function e($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
}
function fail($msg){ http_response_code(500); die($msg); }

/* ===== Halaman & Session ===== */
$page_title     = 'Data Pegawai';
$active         = 'data-pegawai';
$logged_in_ukpd = $_SESSION['nama_ukpd'] ?? '';

if ($logged_in_ukpd === '') {
  http_response_code(403);
  die('<div class="p-4 text-danger">Akses ditolak: sesi UKPD tidak ditemukan.</div>');
}

/* CSRF untuk hapus */
if (empty($_SESSION['csrf'])) { $_SESSION['csrf'] = bin2hex(random_bytes(32)); }
$CSRF = $_SESSION['csrf'];

/* ===== Kanonisasi status pegawai ===== */
$CANON_STATUS = "
  CASE
    WHEN UPPER(TRIM(p.status_pegawai)) = 'PNS' THEN 'PNS'
    WHEN UPPER(TRIM(p.status_pegawai)) = 'CPNS' THEN 'CPNS'
    WHEN UPPER(TRIM(p.status_pegawai)) IN ('PPPK','P3K','PPPK NAKES','PPPK TEKNIS') THEN 'PPPK'
    WHEN UPPER(TRIM(p.status_pegawai)) IN ('PJLP','P J L P') THEN 'PJLP'
    WHEN UPPER(TRIM(p.status_pegawai)) IN (
      'NON PNS','NON ASN','PROFESIONAL','PROFESIONAL (NON PNS)',
      'PROFESIONAL/NON PNS','TENAGA PROFESIONAL'
    ) THEN 'NON PNS'
    ELSE 'LAINNYA'
  END
";

/* ===== Ambil filter GET ===== */
$allowed_status = ['PNS','CPNS','PPPK','NON PNS','PJLP'];
$st = (isset($_GET['st']) && is_array($_GET['st']))
  ? array_values(array_intersect($allowed_status, array_map('strtoupper', $_GET['st'])))
  : $allowed_status;

$allowed_kond = ['AKTIF','PENSIUN','RESIGN','TUBEL','CLTN','MENINGGAL'];
$kond = (isset($_GET['kond']) && is_array($_GET['kond']))
  ? array_values(array_intersect($allowed_kond, array_map('strtoupper', $_GET['kond'])))
  : ['AKTIF'];

$filter_jabatan = trim((string)($_GET['filter_jabatan'] ?? ''));
$q              = trim((string)($_GET['q'] ?? ''));

/* ===== WHERE builder ===== */
$whereParts = [];
$bindVals   = [];
$bindTypes  = '';

/* wajib batasi hanya UKPD login ini */
$whereParts[] = "(COALESCE(NULLIF(TRIM(p.nama_ukpd),''),'')) COLLATE utf8mb4_unicode_ci = ?";
$bindVals[]   = $logged_in_ukpd;
$bindTypes   .= 's';

/* filter jabatan ORB */
if ($filter_jabatan !== '') {
  $whereParts[] = "(COALESCE(NULLIF(TRIM(p.jabatan_orb),''),'')) COLLATE utf8mb4_unicode_ci = ?";
  $bindVals[]   = $filter_jabatan;
  $bindTypes   .= 's';
}

/* pencarian nama / NIP (server-side, tambahan selain DataTables) */
if ($q !== '') {
  $whereParts[] = "(p.nip LIKE ? OR (p.nama COLLATE utf8mb4_unicode_ci) LIKE ?)";
  $like = '%'.$q.'%';
  $bindVals[] = $like;  $bindTypes .= 's';
  $bindVals[] = $like;  $bindTypes .= 's';
}

/* kondisi (AKTIF / PENSIUN / ...) */
if (count($kond)) {
  $place = implode(',', array_fill(0, count($kond), '?'));
  $whereParts[] = "UPPER(TRIM(p.kondisi)) COLLATE utf8mb4_unicode_ci IN ($place)";
  foreach($kond as $v){ $bindVals[] = $v; $bindTypes .= 's'; }
}

/* simpan versi tanpa status_pegawai utk KPI */
$wherePartsNoStatus = $whereParts;
$bindValsNoStatus   = $bindVals;
$bindTypesNoStatus  = $bindTypes;

/* filter status pegawai (PNS/CPNS/...) */
if (count($st)) {
  $statusConds = [];
  $stUpper = array_map('strtoupper', $st);
  foreach (['PNS','CPNS','PPPK','NON PNS','PJLP'] as $lab) {
    if (in_array($lab, $stUpper, true)) {
      $statusConds[] = "( $CANON_STATUS ) COLLATE utf8mb4_unicode_ci = ?";
      $bindVals[]    = $lab;
      $bindTypes    .= 's';
    }
  }
  if ($statusConds) $whereParts[] = '('.implode(' OR ', $statusConds).')';
}

$whereSql = $whereParts ? ('WHERE '.implode(' AND ', $whereParts)) : '';

/* ===== Helper KPI counter ===== */
$makeCount = function($extraCond) use ($wherePartsNoStatus,$bindValsNoStatus,$bindTypesNoStatus,$conn){
  $parts = $wherePartsNoStatus;
  if ($extraCond) $parts[] = $extraCond;
  $sql = "SELECT COUNT(*) c FROM pegawai p ".($parts? 'WHERE '.implode(' AND ', $parts):'');
  $ps = $conn->prepare($sql);
  if ($bindTypesNoStatus !== '') $ps->bind_param($bindTypesNoStatus, ...$bindValsNoStatus);
  $ps->execute();
  $r = $ps->get_result()->fetch_assoc();
  return (int)($r['c'] ?? 0);
};

$jumlah_pns   = $makeCount("( $CANON_STATUS ) = 'PNS'");
$jumlah_cpns  = $makeCount("( $CANON_STATUS ) = 'CPNS'");
$jumlah_pppk  = $makeCount("( $CANON_STATUS ) = 'PPPK'");
$jumlah_pro   = $makeCount("( $CANON_STATUS ) = 'NON PNS'");
$jumlah_pjlp  = $makeCount("( $CANON_STATUS ) = 'PJLP'");

/* ===== Pull data utama + jumlah alamat/keluarga ===== */
$sql = "
SELECT
  p.*,
  ($CANON_STATUS) AS status4,
  COALESCE(a.cnt,0) AS alamat_cnt,
  COALESCE(k.cnt,0) AS keluarga_cnt
FROM pegawai p
LEFT JOIN (
  SELECT pegawai_nik, COUNT(*) AS cnt
  FROM alamat
  GROUP BY pegawai_nik
) a ON (a.pegawai_nik COLLATE utf8mb4_unicode_ci) = (p.nik COLLATE utf8mb4_unicode_ci)
LEFT JOIN (
  SELECT pegawai_nik, COUNT(*) AS cnt
  FROM keluarga
  GROUP BY pegawai_nik
) k ON (k.pegawai_nik COLLATE utf8mb4_unicode_ci) = (p.nik COLLATE utf8mb4_unicode_ci)
{$whereSql}
ORDER BY p.nama ASC
";
$st2 = $conn->prepare($sql);
if ($bindTypes !== '') $st2->bind_param($bindTypes, ...$bindVals);
$st2->execute();
$res = $st2->get_result();

/* ===== Dropdown jabatan unik untuk filter ===== */
$jabOpt = [];
$jSql = "SELECT DISTINCT p.jabatan_orb AS j
         FROM pegawai p
         WHERE (COALESCE(NULLIF(TRIM(p.nama_ukpd),''),'')) COLLATE utf8mb4_unicode_ci = ?
           AND COALESCE(NULLIF(TRIM(p.jabatan_orb),''),'') <> ''
         ORDER BY j";
$st3  = $conn->prepare($jSql);
$st3->bind_param('s', $logged_in_ukpd);
$st3->execute();
$rj = $st3->get_result();
while($rr = $rj->fetch_assoc()){ $jabOpt[] = $rr['j']; }

/* ===== QS utk export .xls ===== */
$qs = http_build_query([
  'q'             => $q,
  'filter_jabatan'=> $filter_jabatan,
  'st'            => $st,
  'kond'          => $kond,
]);

function is_checked($arr, $v){
  return in_array($v, $arr, true) ? 'checked' : '';
}

/* ===== Helper URL (profil / edit / hapus) ===== */
function buildProfilUrl($nik,$nip,$nama,$ukpdNm){
  if ($nik !== '') {
    return 'profil_pegawai_ukpd.php?nik='.urlencode($nik);
  } elseif ($nip !== '') {
    return 'profil_pegawai_ukpd.php?nip='.urlencode($nip);
  } else {
    return 'profil_pegawai_ukpd.php?nama='.urlencode($nama).'&ukpd='.urlencode($ukpdNm);
  }
}
function buildEditUrl($nik,$nip,$nama,$ukpdNm){
  if ($nik !== '') {
    return 'edit.php?nik='.urlencode($nik);
  } elseif ($nip !== '') {
    return 'edit.php?nip='.urlencode($nip);
  } else {
    return 'edit.php?nama='.urlencode($nama).'&ukpd='.urlencode($ukpdNm);
  }
}
function buildDeletePayload($nik,$nip,$nama,$ukpdNm){
  return [
    'nik'     => $nik,
    'nip'     => $nip,
    'nama'    => $nama,
    'ukpd'    => $ukpdNm,
  ];
}

/* ===== Layout start ===== */
include APP_BASE_DIR . '/includes/layout_head.php';
include APP_BASE_DIR . '/includes/sidebar.php';
include APP_BASE_DIR . '/includes/header_bar.php';
?>

<!-- Tailwind untuk styling -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- jQuery + DataTables (untuk pagination & search seperti DUK) -->
<link rel="stylesheet" href="https://cdn.datatables.net/1.13.8/css/jquery.dataTables.min.css">
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdn.datatables.net/1.13.8/js/jquery.dataTables.min.js"></script>

<style>
  #mainWrap{max-width:100%;}
  @media (min-width:992px){
    #mainWrap, header.appbar, footer.appfoot, .wrapper, .page-content{
      margin-left:0!important; left:auto!important; transform:none!important;
    }
  }
  .warn-badge{display:inline-flex;align-items:center;gap:6px}
  .warn-ico{
    display:inline-block;width:18px;height:18px;
    border-radius:999px;background:#f59e0b;color:#111827;
    line-height:18px;text-align:center;font-size:.8rem;font-weight:700
  }
  /* DataTables tweak */
  div.dataTables_wrapper div.dataTables_length label,
  div.dataTables_wrapper div.dataTables_info{
    font-size:11px;
    color:#334155;
  }
  div.dataTables_wrapper div.dataTables_paginate ul.pagination{
    margin-top:4px;
  }
  @media (max-width:640px){
    #mainWrap{padding-left:0.5rem;padding-right:0.5rem;}
    #pegawaiTable{font-size:10px;}
  }
</style>

<main id="mainWrap" class="px-2 sm:px-3 lg:px-4 py-3 bg-slate-50 min-h-screen">
  <div class="w-full">

    <!-- HEADER + KPI -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
      <div>
        <h1 class="text-lg font-bold text-slate-800">Data Pegawai</h1>
        <p class="text-xs text-slate-500">UKPD: <span class="font-semibold text-slate-700"><?= e($logged_in_ukpd) ?></span></p>
      </div>
      <a href="tambah_pegawai.php"
         class="inline-flex items-center justify-center rounded-xl bg-sky-600 px-3 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-sky-700">
        <span class="mr-1">＋</span> Tambah Pegawai
      </a>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-3">
      <div class="rounded-2xl px-3 py-3 text-white shadow-sm bg-gradient-to-tr from-sky-700 to-sky-400">
        <div class="text-[11px] uppercase tracking-wide opacity-85">PNS</div>
        <div class="text-2xl font-extrabold"><?= number_format($jumlah_pns,0,',','.') ?></div>
      </div>
      <div class="rounded-2xl px-3 py-3 text-white shadow-sm bg-gradient-to-tr from-cyan-600 to-sky-400">
        <div class="text-[11px] uppercase tracking-wide opacity-85">CPNS</div>
        <div class="text-2xl font-extrabold"><?= number_format($jumlah_cpns,0,',','.') ?></div>
      </div>
      <div class="rounded-2xl px-3 py-3 text-white shadow-sm bg-gradient-to-tr from-emerald-600 to-lime-500">
        <div class="text-[11px] uppercase tracking-wide opacity-85">PPPK</div>
        <div class="text-2xl font-extrabold"><?= number_format($jumlah_pppk,0,',','.') ?></div>
      </div>
      <div class="rounded-2xl px-3 py-3 text-white shadow-sm bg-gradient-to-tr from-sky-500 to-teal-500">
        <div class="text-[11px] uppercase tracking-wide opacity-85">PROFESIONAL</div>
        <div class="text-2xl font-extrabold"><?= number_format($jumlah_pro,0,',','.') ?></div>
      </div>
      <div class="rounded-2xl px-3 py-3 text-white shadow-sm bg-gradient-to-tr from-violet-600 to-fuchsia-500">
        <div class="text-[11px] uppercase tracking-wide opacity-85">PJLP</div>
        <div class="text-2xl font-extrabold"><?= number_format($jumlah_pjlp,0,',','.') ?></div>
      </div>
    </div>

    <!-- FILTER BAR -->
    <form id="filterForm" method="get" class="mb-3">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div>
          <label for="pegawaiSearch" class="block text-xs font-semibold text-slate-600 mb-1">Cari Pegawai</label>
          <!-- input ini dipakai DataTables (live search) -->
          <input
            id="pegawaiSearch"
            type="text"
            class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            placeholder="Nama / NIP / NRK"
            value="<?= e($q) ?>"
          >
          <!-- tetap kirim q lewat GET saat submit filter (opsional) -->
          <input type="hidden" name="q" id="qHidden" value="<?= e($q) ?>">
        </div>

        <div>
          <label for="filter_jabatan" class="block text-xs font-semibold text-slate-600 mb-1">Filter Jabatan</label>
          <select
            name="filter_jabatan"
            id="filter_jabatan"
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
            <option value="">— Semua Jabatan —</option>
            <?php foreach($jabOpt as $jo): ?>
              <option value="<?= e($jo) ?>" <?= $filter_jabatan===$jo?'selected':'' ?>><?= e($jo) ?></option>
            <?php endforeach; ?>
          </select>
        </div>

        <div class="flex md:justify-end">
          <div class="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
            <button
              type="submit"
              class="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
            >
              Terapkan Filter
            </button>
            <a
              href="export_pegawai_full_xls.php?<?= e($qs) ?>"
              class="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-3 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-emerald-600"
            >
              💾 <span class="ml-1">Export Lengkap (.xls)</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Filter status & kondisi (chip) -->
      <div class="mt-2 flex flex-col gap-1">
        <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Filter Lainnya</div>
        <div class="flex flex-row flex-wrap gap-2 text-[11px]">
          <label class="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1">
            <input type="checkbox" name="st[]" value="PNS"  <?= is_checked($st,'PNS')  ?> class="h-3 w-3">
            <span>PNS</span>
          </label>
          <label class="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1">
            <input type="checkbox" name="st[]" value="CPNS" <?= is_checked($st,'CPNS') ?> class="h-3 w-3">
            <span>CPNS</span>
          </label>
          <label class="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1">
            <input type="checkbox" name="st[]" value="PPPK" <?= is_checked($st,'PPPK') ?> class="h-3 w-3">
            <span>PPPK</span>
          </label>
          <label class="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1">
            <input type="checkbox" name="st[]" value="NON PNS" <?= is_checked($st,'NON PNS') ?> class="h-3 w-3">
            <span>PROFESIONAL</span>
          </label>
          <label class="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1">
            <input type="checkbox" name="st[]" value="PJLP" <?= is_checked($st,'PJLP') ?> class="h-3 w-3">
            <span>PJLP</span>
          </label>

          <label class="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1">
            <input type="checkbox" name="kond[]" value="AKTIF" <?= is_checked($kond,'AKTIF') ?> class="h-3 w-3">
            <span>Kondisi: Aktif</span>
          </label>
          <label class="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1">
            <input type="checkbox" name="kond[]" value="PENSIUN" <?= is_checked($kond,'PENSIUN') ?> class="h-3 w-3">
            <span>Pensiun</span>
          </label>
          <label class="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1">
            <input type="checkbox" name="kond[]" value="RESIGN" <?= is_checked($kond,'RESIGN') ?> class="h-3 w-3">
            <span>Resign</span>
          </label>
          <label class="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1">
            <input type="checkbox" name="kond[]" value="TUBEL" <?= is_checked($kond,'TUBEL') ?> class="h-3 w-3">
            <span>Tubel</span>
          </label>
          <label class="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1">
            <input type="checkbox" name="kond[]" value="CLTN" <?= is_checked($kond,'CLTN') ?> class="h-3 w-3">
            <span>CLTN</span>
          </label>
          <label class="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1">
            <input type="checkbox" name="kond[]" value="MENINGGAL" <?= is_checked($kond,'MENINGGAL') ?> class="h-3 w-3">
            <span>Meninggal</span>
          </label>
        </div>
      </div>
    </form>

    <!-- TABEL DATA PEGAWAI -->
    <div class="bg-white shadow-sm border border-slate-200 rounded-2xl p-2 sm:p-3 lg:p-4 overflow-x-auto">
      <table id="pegawaiTable" class="min-w-full text-[11px] align-middle">
        <thead class="bg-slate-800 text-white">
          <tr>
            <th class="px-2 py-2 text-center">No</th>
            <th class="px-2 py-2 text-left">NIP / NRK</th>
            <th class="px-2 py-2 text-left">Nama</th>
            <th class="px-2 py-2 text-left">Jabatan</th>
            <th class="px-2 py-2 text-left">Kondisi</th>
            <th class="px-2 py-2 text-left">Rumpun Jabatan</th>
            <th class="px-2 py-2 text-left">Status Pegawai</th>
            <th class="px-2 py-2 text-left">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
        <?php
          $baseRequired = [
            'nik','ukpd_id','nama_ukpd','jenis_ukpd','wilayah','nip','nama',
            'kondisi','jabatan_orb','jabatan_permenpan_11','jabatan_permenpan_41','atasan_langsung',
            'status_pegawai','kode_jenis_pegawai','status_rumpun','jenis_kontrak',
            'jenis_kelamin','tmt_kerja_ukpd','tempat_lahir','tanggal_lahir','agama',
            'pendidikan_dumy','pendidikan_sk_pangkat','program_studi','nama_universitas',
            'no_hp_pegawai','email_aktif_pegawai','no_bpjs','status_perkawinan'
          ];
          $requiredASN = ['pangkat_golongan','tmt_pangkat_terakhir'];

          $no=1;
          if ($res && $res->num_rows){
            while($row=$res->fetch_assoc()){
              $nik    = trim((string)($row['nik'] ?? ''));
              $nip    = trim((string)($row['nip'] ?? ''));
              $nrk    = trim((string)($row['nrk'] ?? ''));
              $nama   = $row['nama'] ?? '';
              $ukpdNm = $row['nama_ukpd'] ?? '';
              $jab    = $row['jabatan_orb'] ?? '';
              $kondx  = $row['kondisi'] ?? '';
              $rump   = $row['status_rumpun'] ?? '';
              $stat4  = $row['status4'] ?? '';
              $labelStatus = ($stat4 === 'NON PNS') ? 'PROFESIONAL' : $stat4;

              $missing = [];
              $statusRaw = strtoupper(trim((string)($row['status_pegawai'] ?? '')));

              foreach ($baseRequired as $c) {
                if (!array_key_exists($c, $row)) { $missing[] = strtoupper($c); continue; }
                $v = is_string($row[$c]) ? trim($row[$c]) : $row[$c];
                if (in_array($c, ['tmt_kerja_ukpd','tanggal_lahir'], true)) {
                  if ($v === null || $v === '' || $v === '0000-00-00') $missing[] = strtoupper($c);
                } else {
                  if ($v === null || $v === '') $missing[] = strtoupper($c);
                }
              }

              if (in_array($statusRaw, ['PNS','CPNS','PPPK'], true)) {
                if ($nrk === '') $missing[] = 'NRK';
                foreach ($requiredASN as $c) {
                  if (!array_key_exists($c, $row)) { $missing[] = strtoupper($c); continue; }
                  $v = is_string($row[$c]) ? trim($row[$c]) : $row[$c];
                  if ($c === 'tmt_pangkat_terakhir') {
                    if ($v === null || $v === '' || $v === '0000-00-00') $missing[] = strtoupper($c);
                  } else {
                    if ($v === null || $v === '') $missing[] = strtoupper($c);
                  }
                }
              }

              if ((int)($row['alamat_cnt'] ?? 0)   <= 0) $missing[] = 'ALAMAT';
              if ((int)($row['keluarga_cnt'] ?? 0) <= 0) $missing[] = 'KELUARGA';

              $namaHtml = e($nama);
              if (!empty($missing)) {
                $tip = e('Kelengkapan kurang: '.implode(', ', $missing));
                $namaHtml = "<span class='warn-badge' title=\"{$tip}\">
                               <span class='warn-ico'>!</span>". $namaHtml .
                            "</span>";
              }

              $nipNrk = (trim($nip) !== '' || trim($nrk) !== '')
                ? e($nip.(($nip!=='' && $nrk!=='')?' / ':'').$nrk)
                : '&nbsp;';

              $profilUrl = buildProfilUrl($nik,$nip,$nama,$ukpdNm);
              $editUrl   = buildEditUrl($nik,$nip,$nama,$ukpdNm);
              $delData   = buildDeletePayload($nik,$nip,$nama,$ukpdNm);
        ?>
          <tr class="hover:bg-slate-50">
            <td class="px-2 py-2 text-center align-top"><?= $no++ ?></td>
            <td class="px-2 py-2 align-top" title="<?= e($nip.' '.$nrk) ?>"><?= $nipNrk ?></td>
            <td class="px-2 py-2 align-top whitespace-normal"><?= $namaHtml ?></td>
            <td class="px-2 py-2 align-top whitespace-normal" title="<?= e($jab) ?>"><?= e($jab) ?></td>
            <td class="px-2 py-2 align-top"><?= e($kondx) ?></td>
            <td class="px-2 py-2 align-top whitespace-normal" title="<?= e($rump) ?>"><?= e($rump) ?></td>
            <td class="px-2 py-2 align-top"><?= e($labelStatus) ?></td>
            <td class="px-2 py-2 align-top whitespace-nowrap">
              <a href="<?= $profilUrl ?>"
                 class="inline-flex items-center justify-center rounded-md bg-sky-500 hover:bg-sky-600 text-white text-xs px-2 py-1 mr-1"
                 title="Lihat">
                👁
              </a>
              <a href="<?= $editUrl ?>"
                 class="inline-flex items-center justify-center rounded-md bg-amber-400 hover:bg-amber-500 text-white text-xs px-2 py-1 mr-1"
                 title="Edit">
                ✏️
              </a>
              <button type="button"
                      class="del-btn inline-flex items-center justify-center rounded-md bg-rose-500 hover:bg-rose-600 text-white text-xs px-2 py-1"
                      title="Hapus"
                      data-nik="<?= e($delData['nik']) ?>"
                      data-nip="<?= e($delData['nip']) ?>"
                      data-nama="<?= e($delData['nama']) ?>"
                      data-ukpd="<?= e($delData['ukpd']) ?>">
                🗑
              </button>
            </td>
          </tr>
        <?php
            }
          } else {
            echo '<tr><td colspan="8" class="px-3 py-3 text-center text-slate-500 text-xs">Tidak ada data.</td></tr>';
          }
        ?>
        </tbody>
      </table>
    </div>

    <div class="mt-3">
      <a href="dashboard_ukpd.php"
         class="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100">
        ← Kembali ke Dashboard
      </a>
    </div>

  </div>
</main>

<!-- Modal hapus tetap pakai Bootstrap (layout_foot) -->
<div class="modal fade" id="delModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Konfirmasi Hapus</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button>
      </div>
      <div class="modal-body">
        Hapus data pegawai berikut?
        <div class="mt-2"><strong id="delNama"></strong></div>
        <div class="text-muted small">
          <div>NIK: <span id="delNik"></span></div>
          <div>NIP: <span id="delNip"></span></div>
          <div>UKPD: <span id="delUkpd"></span></div>
        </div>

        <input type="hidden" id="nikToDelete">
        <input type="hidden" id="nipToDelete">
        <input type="hidden" id="ukpdToDelete">
        <input type="hidden" id="namaToDelete">
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
        <button id="confirmDeleteBtn" class="btn btn-danger">Hapus</button>
      </div>
    </div>
  </div>
</div>

<?php include APP_BASE_DIR . '/includes/layout_foot.php'; ?>

<script>
(function(){
  // sinkronkan hidden q dengan input search saat submit
  const qHidden = document.getElementById('qHidden');
  const pegawaiSearch = document.getElementById('pegawaiSearch');
  document.getElementById('filterForm').addEventListener('submit', function(){
    if (qHidden && pegawaiSearch) qHidden.value = pegawaiSearch.value;
  });

  // auto-submit bila ganti filter select/checkbox
  document.querySelectorAll('#filterForm select, #filterForm input[type="checkbox"]').forEach(el=>{
    el.addEventListener('change', ()=> document.getElementById('filterForm').submit());
  });

  // DataTables: seperti DUK (pencarian & pagination)
  let dt = $('#pegawaiTable').DataTable({
    pageLength: 10,
    lengthMenu: [[10,25,50,100,-1],[10,25,50,100,'Semua']],
    dom: 'ltrip',
    language: {
      url: 'https://cdn.datatables.net/plug-ins/1.13.8/i18n/id.json'
    },
    columnDefs:[{orderable:false,targets:-1}]
  });

  // live search DataTables
  $('#pegawaiSearch').on('keyup', function(){
    dt.search(this.value).draw();
  });

  // Hapus: modal + CSRF
  let bootstrapModal;
  const modalEl    = document.getElementById('delModal');

  const nikInp     = document.getElementById('nikToDelete');
  const nipInp     = document.getElementById('nipToDelete');
  const namaInp    = document.getElementById('namaToDelete');
  const ukpdInp    = document.getElementById('ukpdToDelete');

  const labNama    = document.getElementById('delNama');
  const labNik     = document.getElementById('delNik');
  const labNip     = document.getElementById('delNip');
  const labUkpd    = document.getElementById('delUkpd');

  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('.del-btn');
    if(!btn) return;

    const nik  = btn.getAttribute('data-nik')  || '';
    const nip  = btn.getAttribute('data-nip')  || '';
    const nama = btn.getAttribute('data-nama') || '';
    const ukpd = btn.getAttribute('data-ukpd') || '';

    nikInp.value  = nik;
    nipInp.value  = nip;
    namaInp.value = nama;
    ukpdInp.value = ukpd;

    labNama.textContent = nama || '(tanpa nama)';
    labNik.textContent  = nik  || '-';
    labNip.textContent  = nip  || '-';
    labUkpd.textContent = ukpd || '-';

    if (window.bootstrap && bootstrap.Modal) {
      if (!bootstrapModal) bootstrapModal = new bootstrap.Modal(modalEl);
      bootstrapModal.show();
    } else {
      if (confirm(`Hapus data pegawai:\n${nama}\nNIP: ${nip}\nNIK: ${nik}?`)) {
        submitDeleteNow();
      }
    }
  });

  document.getElementById('confirmDeleteBtn')?.addEventListener('click', submitDeleteNow);

  function submitDeleteNow(){
    const nik  = nikInp.value.trim();
    const nip  = nipInp.value.trim();
    const nama = namaInp.value.trim();
    const ukpd = ukpdInp.value.trim();

    const f = document.createElement('form');
    f.method = 'POST';
    f.action = 'hapus.php';
    f.innerHTML =
      `<input type="hidden" name="nik"  value="${nik.replace(/"/g,'&quot;')}">`+
      `<input type="hidden" name="nip"  value="${nip.replace(/"/g,'&quot;')}">`+
      `<input type="hidden" name="nama" value="${nama.replace(/"/g,'&quot;')}">`+
      `<input type="hidden" name="ukpd" value="${ukpd.replace(/"/g,'&quot;')}">`+
      `<input type="hidden" name="csrf" value="<?= e($CSRF) ?>">`;
    document.body.appendChild(f);
    f.submit();
  }
})();
</script>
