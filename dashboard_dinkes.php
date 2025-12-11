<?php 
// dashboard_dinkes.php — Dashboard Dinkes (dengan CPNS terpisah) + interaksi, animasi UI, & COMPACT MODE

session_start();
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
  header("Location: index.php"); exit();
}
require_once __DIR__ . '/includes/init_superadmin.php';

$conn->set_charset('utf8mb4');
date_default_timezone_set('Asia/Jakarta');

function id_number($n){ return number_format((int)$n, 0, ',', '.'); }

// aktifkan menu
$active = 'dashboard';

/* =========================
   0) Normalisasi STATUS_PEGAWAI (CPNS dipisah dari PNS)
   ========================= */
$CANON_STATUS = "
  CASE
    WHEN UPPER(TRIM(status_pegawai)) IN ('PNS') THEN 'PNS'
    WHEN UPPER(TRIM(status_pegawai)) IN ('CPNS') THEN 'CPNS'
    WHEN UPPER(TRIM(status_pegawai)) IN ('PPPK','P3K','PPPK NAKES','PPPK TEKNIS') THEN 'PPPK'
    WHEN UPPER(TRIM(status_pegawai)) IN (
      'NON PNS','NON ASN','PROFESIONAL','PROFESIONAL (NON PNS)',
      'PROFESIONAL/NON PNS','TENAGA PROFESIONAL'
    ) THEN 'NON PNS'
    WHEN UPPER(TRIM(status_pegawai)) IN ('PJLP','P J L P') THEN 'PJLP'
    ELSE 'LAINNYA'
  END
";
$BASE_FROM = " FROM pegawai WHERE UPPER(TRIM(kondisi))='AKTIF' ";

/* Urutan status yang dipakai di UI */
$recognized = ['PNS','CPNS','PPPK','NON PNS','PJLP'];
$status_label_map = [
  'PNS'     => 'PNS',
  'CPNS'    => 'CPNS',
  'PPPK'    => 'PPPK',
  'NON PNS' => 'PROFESIONAL',
  'PJLP'    => 'PJLP'
];

/* ====== WARNA: HANYA CPNS DIGANTI CYAN SENADA ====== */
$status_colors = [
  'PNS'     => '#0EA5E9', // sky-500
  'CPNS'    => '#06B6D4', // cyan-500
  'PPPK'    => '#22C55E', // green-500
  'NON PNS' => '#14B8A6', // teal-500
  'PJLP'    => '#8B5CF6'  // violet-500
];

/* =========================
   1) KPI ringkasan
   ========================= */
$data_kpi = ['PNS'=>0,'CPNS'=>0,'PPPK'=>0,'NON PNS'=>0,'PJLP'=>0];
$q = $conn->query("
  SELECT s, COUNT(*) total FROM (
    SELECT ($CANON_STATUS) AS s $BASE_FROM
  ) t
  WHERE s <> 'LAINNYA'
  GROUP BY s
");
foreach ($q as $r) { $data_kpi[$r['s']] = (int)$r['total']; }
$data_status = [
  'PNS'         => $data_kpi['PNS'],
  'CPNS'        => $data_kpi['CPNS'],
  'PPPK'        => $data_kpi['PPPK'],
  'PROFESIONAL' => $data_kpi['NON PNS'],
  'PJLP'        => $data_kpi['PJLP'],
];

/* =========================
   2) Wilayah x Status (stacked bar)
   ========================= */
$data_wilayah_status = [];
$res = $conn->query("
  SELECT w, s AS status_pegawai, COUNT(*) total FROM (
    SELECT
      COALESCE(NULLIF(TRIM(Wilayah),''),'(Tidak Tercatat)') AS w,
      ($CANON_STATUS) AS s
      $BASE_FROM
  ) t
  WHERE s <> 'LAINNYA'
  GROUP BY w, s
  ORDER BY w
");
foreach ($res as $r) {
  $data_wilayah_status[$r['w']][$r['status_pegawai']] = (int)$r['total'];
}
$wilayah_labels = array_keys($data_wilayah_status);
$wilayah_datasets = [];
foreach ($recognized as $st) {
  $d=[]; foreach ($wilayah_labels as $w) { $d[] = $data_wilayah_status[$w][$st] ?? 0; }
  $wilayah_datasets[] = [
    'label' => $status_label_map[$st],
    'data'  => $d,
    'backgroundColor' => $status_colors[$st],
    'borderRadius' => 6
  ];
}

/* =========================
   3) UKPD (stacked bar, semua UKPD)
   ========================= */
$data_ukpd_status = []; $ukpd_labels = [];
$res = $conn->query("
  SELECT u, s AS status_pegawai, COUNT(*) total FROM (
    SELECT
      COALESCE(NULLIF(TRIM(nama_ukpd),''),'(Tidak Tercatat)') AS u,
      ($CANON_STATUS) AS s
      $BASE_FROM
  ) t
  WHERE s <> 'LAINNYA'
  GROUP BY u, s
  ORDER BY u
");
foreach ($res as $r) {
  if (!in_array($r['u'], $ukpd_labels, true)) $ukpd_labels[] = $r['u'];
  $data_ukpd_status[$r['u']][$r['status_pegawai']] = (int)$r['total'];
}
$ukpd_datasets = [];
foreach ($recognized as $st) {
  $d=[]; foreach ($ukpd_labels as $u) { $d[] = $data_ukpd_status[$u][$st] ?? 0; }
  $ukpd_datasets[] = [
    'label' => $status_label_map[$st],
    'data'  => $d,
    'backgroundColor' => $status_colors[$st],
    'borderRadius' => 6
  ];
}

/* =========================
   4) Tabel UKPD per Wilayah (grouped)
   ========================= */
$data_wilayah_ukpd_status = [];
$res = $conn->query("
  SELECT w, u, s, COUNT(*) total FROM (
    SELECT
      COALESCE(NULLIF(TRIM(Wilayah),''),'(Tidak Tercatat)') AS w,
      COALESCE(NULLIF(TRIM(nama_ukpd),''),'(Tidak Tercatat)') AS u,
      ($CANON_STATUS) AS s
      $BASE_FROM
  ) t
  WHERE s <> 'LAINNYA'
  GROUP BY w, u, s
  ORDER BY w, u
");
foreach ($res as $r) {
  $w = $r['w']; $u = $r['u']; $s = $r['s'];
  if (!isset($data_wilayah_ukpd_status[$w])) $data_wilayah_ukpd_status[$w] = [];
  if (!isset($data_wilayah_ukpd_status[$w][$u])) $data_wilayah_ukpd_status[$w][$u] = ['PNS'=>0,'CPNS'=>0,'PPPK'=>0,'NON PNS'=>0,'PJLP'=>0];
  if (in_array($s, $recognized, true)) { $data_wilayah_ukpd_status[$w][$u][$s] = (int)$r['total']; }
}
$total_wilayah_ukpd = [];
foreach ($data_wilayah_ukpd_status as $wilayah => $ukpd_list) {
  $total_wilayah_ukpd[$wilayah] = ['PNS'=>0,'CPNS'=>0,'PPPK'=>0,'NON PNS'=>0,'PJLP'=>0,'TOTAL'=>0];
  foreach ($ukpd_list as $ukpd => $sts) {
    foreach ($recognized as $st) { $total_wilayah_ukpd[$wilayah][$st] += $sts[$st] ?? 0; }
    $total_wilayah_ukpd[$wilayah]['TOTAL'] += ($sts['PNS'] ?? 0) + ($sts['CPNS'] ?? 0) + ($sts['PPPK'] ?? 0) + ($sts['NON PNS'] ?? 0) + ($sts['PJLP'] ?? 0);
  }
}
$total_keseluruhan = ['PNS'=>0,'CPNS'=>0,'PPPK'=>0,'NON PNS'=>0,'PJLP'=>0,'TOTAL'=>0];
foreach ($total_wilayah_ukpd as $t) {
  foreach ($recognized as $st) { $total_keseluruhan[$st] += $t[$st]; }
  $total_keseluruhan['TOTAL'] += $t['TOTAL'];
}

/* =========================
   5) RUMPUN — apa adanya dari kolom status_rumpun (TANPA normalisasi)
   ========================= */
$rumpun_total_raw = [];
$res = $conn->query("
  SELECT r, COUNT(*) total FROM (
    SELECT status_rumpun AS r, ($CANON_STATUS) AS s $BASE_FROM
  ) t
  WHERE s <> 'LAINNYA'
  GROUP BY r
  ORDER BY total DESC
");
foreach($res as $row){
  $label = $row['r'];
  $rumpun_total_raw[$label] = (int)$row['total'];
}
arsort($rumpun_total_raw);
$rumpun_labels_raw = array_keys($rumpun_total_raw);
$rumpun_totals     = array_values($rumpun_total_raw);

/* b) Rumpun × Status */
$raw_map = [];
$res = $conn->query("
  SELECT r, s, COUNT(*) total FROM (
    SELECT status_rumpun AS r, ($CANON_STATUS) AS s $BASE_FROM
  ) t
  WHERE s <> 'LAINNYA'
  GROUP BY r, s
  ORDER BY r
");
foreach($res as $row){
  $r = $row['r']; $s = $row['s'];
  if (!isset($raw_map[$r])) $raw_map[$r] = [];
  $raw_map[$r][$s] = (int)$row['total'];
}
$rumpun_status_map = [];
foreach ($recognized as $st){
  $arr = [];
  foreach ($rumpun_labels_raw as $lab){
    $arr[] = $raw_map[$lab][$st] ?? 0;
  }
  $rumpun_status_map[$st] = $arr;
}
$rumpun_datasets = [];
foreach ($recognized as $st){
  $rumpun_datasets[] = [
    'label' => $status_label_map[$st],
    'data'  => $rumpun_status_map[$st],
    'backgroundColor' => $status_colors[$st],
    'borderRadius' => 6
  ];
}

/* =========================
   6) JENJANG PENDIDIKAN (pendidikan_sk_pangkat) + Status
   ========================= */

/* a) Total per jenjang, untuk urutan */
$pendidikan_total_raw = [];
$res = $conn->query("
  SELECT j, COUNT(*) total FROM (
    SELECT
      COALESCE(
        NULLIF(TRIM(pendidikan_sk_pangkat),''),
        '(Tidak Tercatat)'
      ) AS j,
      ($CANON_STATUS) AS s
      $BASE_FROM
  ) t
  WHERE s <> 'LAINNYA'
  GROUP BY j
  ORDER BY total DESC
");
foreach ($res as $row) {
  $pendidikan_total_raw[$row['j']] = (int)$row['total'];
}
arsort($pendidikan_total_raw);
$pendidikan_labels = array_keys($pendidikan_total_raw);

/* b) Pendidikan × Status */
$pendidikan_map = [];
$res = $conn->query("
  SELECT j, s, COUNT(*) total FROM (
    SELECT
      COALESCE(
        NULLIF(TRIM(pendidikan_sk_pangkat),''),
        '(Tidak Tercatat)'
      ) AS j,
      ($CANON_STATUS) AS s
      $BASE_FROM
  ) t
  WHERE s <> 'LAINNYA'
  GROUP BY j, s
  ORDER BY j, s
");
foreach ($res as $row) {
  $j = $row['j'];
  $s = $row['s'];
  if (!isset($pendidikan_map[$j])) $pendidikan_map[$j] = [];
  $pendidikan_map[$j][$s] = (int)$row['total'];
}

/* c) datasets per status (urut sesuai $recognized) */
$pendidikan_status_map = [];
foreach ($recognized as $st) {
  $arr = [];
  foreach ($pendidikan_labels as $lab) {
    $arr[] = $pendidikan_map[$lab][$st] ?? 0;
  }
  $pendidikan_status_map[$st] = $arr;
}
$pendidikan_datasets = [];
foreach ($recognized as $st) {
  $pendidikan_datasets[] = [
    'label' => $status_label_map[$st],
    'data'  => $pendidikan_status_map[$st],
    'backgroundColor' => $status_colors[$st],
    'borderRadius' => 6
  ];
}

?>
<!DOCTYPE html>
<html lang="id" class="scroll-smooth">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kepegawaian Dinkes DKI</title>
<link rel="icon" type="image/png" sizes="32x32" href="/SISDMK/Foto/Dinkes.png?v=3">
<link rel="apple-touch-icon" href="/SISDMK/Foto/Dinkes.png?v=3">
<meta name="theme-color" content="#0EA5E9">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    darkMode: 'class',
    theme: {
      extend: {
        fontFamily: { sans: ['Plus Jakarta Sans','system-ui','sans-serif'] },
        colors: { brand:'#0EA5E9', cpns:'#06B6D4', pppk:'#22C55E', pro:'#14B8A6', pjlp:'#8B5CF6', cardLight:'#ffffff', cardDark:'#0B1220' },
        boxShadow: { soft: '0 10px 30px -10px rgba(15,23,42,.25)' }
      }
    }
  }
</script>

<!-- Chart.js & plugin -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0" defer></script>

<style>
  :root{
    --sidebar-w: 18rem; /* 288px */
    /* tinggi chart default */
    --h-wilayah: 360px;
    --h-status: 320px;
    --h-rumpun: 520px;
    --h-ukpd:    540px;
    --tbl-font:  0.875rem; /* 14px */
    --tbl-pad-y: .5rem;    /* 8px */
  }
  body{
    background:
      radial-gradient(1100px 600px at 0% 0%, rgba(56,189,248,.10), transparent 35%),
      radial-gradient(900px 500px at 100% 0%, rgba(139,92,246,.08), transparent 40%),
      var(--bg, #f8fafc);
  }
  .dark body{ --bg: #020617; }
  #mainWrap{ margin-left: var(--sidebar-w); transition: margin .2s ease; }
  @media (max-width: 991.98px){ #mainWrap{ margin-left: 0; } }
  body.sidebar-collapsed #mainWrap{ margin-left: 0 !important; }

  /* === COMPACT MODE === */
  body.compact{
    --h-wilayah: 240px;
    --h-status:  220px;
    --h-rumpun:  360px;
    --h-ukpd:    360px;
    --tbl-font:  0.8125rem; /* 13px */
    --tbl-pad-y: .375rem;   /* 6px */
  }

  /* progress bar */
  #scrollProg{ position: fixed; inset: 0 auto auto 0; height:3px; width:0; background:#fbbf24; z-index:60; }

  /* reveal on scroll */
  [data-animate]{ opacity:0; transform: translateY(16px) scale(.98); transition: opacity .6s ease, transform .6s cubic-bezier(.22,.7,.26,1); will-change: transform, opacity; }
  .in-view{ opacity:1; transform: none; }
  .slide-left[data-animate]{ transform: translateX(20px); }
  .slide-right[data-animate]{ transform: translateX(-20px); }

  /* KPI hover */
  .kpi:hover{ transform: translateY(-2px); transition: transform .2s ease; }

  /* tabel sizing ikut var */
  table#ukpdTable th, table#ukpdTable td{ font-size: var(--tbl-font); padding-top: var(--tbl-pad-y); padding-bottom: var(--tbl-pad-y); }
</style>
</head>
<body class="font-sans text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950">

<!-- Progress bar -->
<div id="scrollProg"></div>

<?php include __DIR__ . '/includes/sidebar_dinkes.php'; ?>
<?php include __DIR__ . '/includes/header_superadmin.php'; ?>
<?php include __DIR__ . '/includes/layout_head.php'; ?>

<!-- Toolbar kecil -->
<div class="px-4 sm:px-6 mt-3">
  <div class="flex items-center gap-2 justify-start">
     <h1 class="text-xl font-semibold">DASHBOARD DINAS KESEHATAN</h1>
    <button id="compactToggle" class="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
      <span>Compact mode</span>
      <span id="compactDot" class="inline-block h-2.5 w-2.5 rounded-full bg-slate-300"></span>
    </button>
  </div>
</div>

<!-- Content -->
<main class="flex-1 px-4 sm:px-6 py-6 space-y-4" id="contentRoot">

  <!-- KPI (animated counters) -->
  <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4" data-animate>
    <div class="kpi rounded-2xl shadow-soft p-5 text-white bg-gradient-to-br from-sky-600 to-brand">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-white/20 grid place-items-center">🪪</div>
        <div><p class="text-xs/4 opacity-90">Jenis Pegawai</p><p class="text-sm font-semibold">PNS</p></div>
      </div>
      <div class="mt-3 text-3xl font-bold" data-count="<?= (int)$data_status['PNS'] ?>">0</div>
    </div>

    <div class="kpi rounded-2xl shadow-soft p-5 text-white bg-gradient-to-br from-cyan-500 to-cpns" data-animate>
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-white/20 grid place-items-center">🎓</div>
        <div><p class="text-xs/4 opacity-90">Jenis Pegawai</p><p class="text-sm font-semibold">CPNS</p></div>
      </div>
      <div class="mt-3 text-3xl font-bold" data-count="<?= (int)$data_status['CPNS'] ?>">0</div>
    </div>

    <div class="kpi rounded-2xl shadow-soft p-5 text-white bg-gradient-to-br from-green-600 to-pppk" data-animate>
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-white/20 grid place-items-center">⚙️</div>
        <div><p class="text-xs/4 opacity-90">Jenis Pegawai</p><p class="text-sm font-semibold">PPPK</p></div>
      </div>
      <div class="mt-3 text-3xl font-bold" data-count="<?= (int)$data_status['PPPK'] ?>">0</div>
    </div>

    <div class="kpi rounded-2xl shadow-soft p-5 text-white bg-gradient-to-br from-teal-700 to-pro" data-animate>
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-white/20 grid place-items-center">👥</div>
        <div><p class="text-xs/4 opacity-90">Jenis Pegawai</p><p class="text-sm font-semibold">PROFESIONAL</p></div>
      </div>
      <div class="mt-3 text-3xl font-bold" data-count="<?= (int)$data_status['PROFESIONAL'] ?>">0</div>
    </div>

    <div class="kpi rounded-2xl shadow-soft p-5 text-white bg-gradient-to-br from-violet-700 to-pjlp" data-animate>
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-white/20 grid place-items-center">🛡️</div>
        <div><p class="text-xs/4 opacity-90">Jenis Pegawai</p><p class="text-sm font-semibold">PJLP</p></div>
      </div>
      <div class="mt-3 text-3xl font-bold" data-count="<?= (int)$data_status['PJLP'] ?>">0</div>
    </div>
  </section>

  <!-- CHARTS: Wilayah & Status -->
  <section class="grid grid-cols-1 lg:grid-cols-2 gap-4" data-animate>
    <!-- Wilayah -->
    <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-cardLight dark:bg-cardDark shadow-soft p-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">Distribusi Pegawai per Wilayah (Aktif)</h3>
        <button id="dlWilayah" class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">Unduh PNG</button>
      </div>
      <div class="mt-3 flex items-center justify-center" style="height: var(--h-wilayah);">
        <canvas id="wilayahChart" class="max-w-[900px] w-full h-full"></canvas>
      </div>
    </div>
    <!-- Status -->
    <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-cardLight dark:bg-cardDark shadow-soft p-4" data-animate>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">Distribusi Pegawai per Status (Aktif)</h3>
        <button id="dlPie" class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">Unduh PNG</button>
      </div>
      <div class="mt-3 flex items-center justify-center" style="height: var(--h-status);">
        <canvas id="statusPegawaiChart" class="max-w-[520px] w-full h-full"></canvas>
      </div>
    </div>
  </section>

  <!-- PENDIDIKAN + RUMPUN×STATUS -->
  <section class="grid grid-cols-1 lg:grid-cols-2 gap-4" data-animate>
    <!-- Pendidikan × Status (stacked) -->
    <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-cardLight dark:bg-cardDark shadow-soft p-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">Distribusi Pegawai per Jenjang Pendidikan (SK Pangkat, Aktif)</h3>
        <button id="dlPendidikan" class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">Unduh PNG</button>
      </div>
      <div class="mt-3 flex items-center justify-center" style="height: var(--h-rumpun);">
        <canvas id="pendidikanChart" class="max-w-[1000px] w-full h-full"></canvas>
      </div>
    </div>

    <!-- Rumpun × Status (stacked) -->
    <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-cardLight dark:bg-cardDark shadow-soft p-4" data-animate>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold">Rumpun × Status Pegawai (Aktif)</h3>
        <button id="dlRumpunStatus" class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">Unduh PNG</button>
      </div>
      <div class="mt-3 flex items-center justify-center" style="height: var(--h-rumpun);">
        <canvas id="rumpunStatusChart" class="max-w-[1000px] w-full h-full"></canvas>
      </div>
    </div>
  </section>

  <!-- UKPD -->
  <section class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-cardLight dark:bg-cardDark shadow-soft p-4" data-animate>
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <h3 class="text-sm font-semibold">Distribusi Pegawai Berdasarkan UKPD (Aktif)</h3>
      <button id="dlUkpd" class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">Unduh PNG</button>
    </div>
    <div class="mt-3 flex items-center justify-center" style="height: var(--h-ukpd);">
      <canvas id="ukpdChart" class="max-w-[1100px] w-full h-full"></canvas>
    </div>
  </section>

  <!-- TABEL: UKPD per Wilayah -->
  <section class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-cardLight dark:bg-cardDark shadow-soft p-4" data-animate>
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <h3 class="text-sm font-semibold">Daftar UKPD (Aktif)</h3>
      <input id="tableFilter" type="search" placeholder="Cari UKPD/Wilayah..." class="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 px-3 py-1.5 text-sm">
    </div>
    <div class="overflow-x-auto mt-2">
      <table class="min-w-full text-sm" id="ukpdTable">
        <thead class="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th class="px-3 py-2 text-center w-16">NO</th>
            <th class="px-3 py-2 text-left">Nama UKPD</th>
            <th class="px-3 py-2 text-center">PNS</th>
            <th class="px-3 py-2 text-center">CPNS</th>
            <th class="px-3 py-2 text-center">PPPK</th>
            <th class="px-3 py-2 text-center">PROFESIONAL</th>
            <th class="px-3 py-2 text-center">PJLP</th>
            <th class="px-3 py-2 text-center">Total</th>
          </tr>
        </thead>
        <tbody>
        <?php foreach ($data_wilayah_ukpd_status as $wilayah => $ukpd_list): ?>
          <tr class="bg-slate-50 dark:bg-slate-800/50 wilayah-row">
            <td class="px-3 py-2" colspan="8">📍 <strong>Wilayah <?= htmlspecialchars($wilayah, ENT_QUOTES, 'UTF-8') ?></strong></td>
          </tr>
          <?php $no=1; foreach ($ukpd_list as $ukpd => $st): ?>
            <tr class="border-b border-slate-100 dark:border-slate-800 ukpd-data-row" data-wilayah="<?= htmlspecialchars($wilayah, ENT_QUOTES, 'UTF-8') ?>" data-ukpd="<?= htmlspecialchars($ukpd, ENT_QUOTES, 'UTF-8') ?>">
              <td class="px-3 py-2 text-center"><?= $no++ ?></td>
              <td class="px-3 py-2"><?= htmlspecialchars($ukpd, ENT_QUOTES, 'UTF-8') ?></td>
              <td class="px-3 py-2 text-center"><?= id_number($st['PNS'] ?? 0) ?></td>
              <td class="px-3 py-2 text-center"><?= id_number($st['CPNS'] ?? 0) ?></td>
              <td class="px-3 py-2 text-center"><?= id_number($st['PPPK'] ?? 0) ?></td>
              <td class="px-3 py-2 text-center"><?= id_number($st['NON PNS'] ?? 0) ?></td>
              <td class="px-3 py-2 text-center"><?= id_number($st['PJLP'] ?? 0) ?></td>
              <td class="px-3 py-2 text-center font-semibold"><?= id_number(($st['PNS']??0)+($st['CPNS']??0)+($st['PPPK']??0)+($st['NON PNS']??0)+($st['PJLP']??0)) ?></td>
            </tr>
          <?php endforeach; ?>
          <tr class="bg-slate-100/70 dark:bg-slate-800/70 font-semibold total-wilayah-row" data-wilayah="<?= htmlspecialchars($wilayah, ENT_QUOTES, 'UTF-8') ?>">
            <td class="px-3 py-2 text-right" colspan="2">Total Wilayah <?= htmlspecialchars($wilayah, ENT_QUOTES, 'UTF-8') ?></td>
            <td class="px-3 py-2 text-center"><?= id_number($total_wilayah_ukpd[$wilayah]['PNS']) ?></td>
            <td class="px-3 py-2 text-center"><?= id_number($total_wilayah_ukpd[$wilayah]['CPNS']) ?></td>
            <td class="px-3 py-2 text-center"><?= id_number($total_wilayah_ukpd[$wilayah]['PPPK']) ?></td>
            <td class="px-3 py-2 text-center"><?= id_number($total_wilayah_ukpd[$wilayah]['NON PNS']) ?></td>
            <td class="px-3 py-2 text-center"><?= id_number($total_wilayah_ukpd[$wilayah]['PJLP']) ?></td>
            <td class="px-3 py-2 text-center"><?= id_number($total_wilayah_ukpd[$wilayah]['TOTAL']) ?></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
        <tfoot>
          <tr class="bg-sky-50 dark:bg-sky-900/30 font-bold">
            <td class="px-3 py-2 text-right" colspan="2">Total Keseluruhan</td>
            <td class="px-3 py-2 text-center"><?= id_number($total_keseluruhan['PNS']) ?></td>
            <td class="px-3 py-2 text-center"><?= id_number($total_keseluruhan['CPNS']) ?></td>
            <td class="px-3 py-2 text-center"><?= id_number($total_keseluruhan['PPPK']) ?></td>
            <td class="px-3 py-2 text-center"><?= id_number($total_keseluruhan['NON PNS']) ?></td>
            <td class="px-3 py-2 text-center"><?= id_number($total_keseluruhan['PJLP']) ?></td>
            <td class="px-3 py-2 text-center"><?= id_number($total_keseluruhan['TOTAL']) ?></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </section>

</main>

<!-- Footer -->
<footer class="py-3 px-4 sm:px-6 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
  <span>© <?= date('Y') ?> Dinas Kesehatan Provinsi DKI Jakarta</span>
  <span>SUBKELOMPOK KEPEGAWAIAN</span>
</footer>
</div>

<script>
// ===== Tema & Jam =====
const root = document.documentElement;
const savedTheme = localStorage.getItem('themeClass') || 'light';
if(savedTheme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
document.getElementById('themeToggle')?.addEventListener('click', () => {
  const isDark = root.classList.toggle('dark');
  localStorage.setItem('themeClass', isDark ? 'dark' : 'light');
});
const clockEl = document.getElementById('clock');
function tick(){ const d=new Date(); if(clockEl) clockEl.textContent = d.toLocaleString('id-ID'); }
tick(); setInterval(tick, 1000);

// ===== Scroll progress bar =====
const prog = document.getElementById('scrollProg');
function onScrollProg(){
  const t = window.scrollY || document.documentElement.scrollTop;
  const h = document.documentElement.scrollHeight - window.innerHeight;
  prog.style.width = (Math.max(0, Math.min(1, h? t/h : 0))*100) + '%';
}
onScrollProg();
window.addEventListener('scroll', onScrollProg, {passive:true});

// ===== Reveal on scroll =====
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in-view'); io.unobserve(e.target); }});
},{threshold:.12, rootMargin:'0px 0px -40px 0px'});
document.querySelectorAll('[data-animate]').forEach(el=>io.observe(el));

// ===== KPI counters =====
const kpis = document.querySelectorAll('[data-count]');
const ioKpi = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(!entry.isIntersecting) return;
    const el = entry.target;
    const target = +el.getAttribute('data-count') || 0;
    const dur = 1000 + Math.min(2000, target*0.2);
    const start = performance.now();
    const fmt = (n)=>n.toLocaleString('id-ID');
    function step(now){
      const p = Math.min(1, (now-start)/dur);
      const val = Math.floor(target * (0.2 + 0.8*(1 - Math.pow(1-p,3))));
      el.textContent = fmt(val);
      if(p<1) requestAnimationFrame(step);
      else el.textContent = fmt(target);
    }
    requestAnimationFrame(step);
    ioKpi.unobserve(el);
  });
},{threshold:.5});
kpis.forEach(el=>ioKpi.observe(el));

// ===== Tabel filter =====
const filterInput = document.getElementById('tableFilter');
filterInput?.addEventListener('input', ()=>{
  const q = filterInput.value.trim().toLowerCase();
  const rows = document.querySelectorAll('#ukpdTable tbody tr');
  let currentWilayah = '';
  let wilayahHasVisible = {};
  rows.forEach(tr=>{
    if(tr.classList.contains('wilayah-row')){
      currentWilayah = tr.textContent.toLowerCase();
      wilayahHasVisible[currentWilayah] = false;
      tr.style.display = '';
      return;
    }
    if(tr.classList.contains('total-wilayah-row')){ 
      tr.style.display = wilayahHasVisible[currentWilayah] ? '' : 'none';
      return;
    }
    if(tr.classList.contains('ukpd-data-row')){
      const ukpd = (tr.dataset.ukpd || '').toLowerCase();
      const wil  = (tr.dataset.wilayah || '').toLowerCase();
      const show = !q || ukpd.includes(q) || wil.includes(q);
      tr.style.display = show ? '' : 'none';
      if(show) wilayahHasVisible[currentWilayah] = true;
    }
  });
  document.querySelectorAll('#ukpdTable tbody .wilayah-row').forEach(tr=>{
    const key = tr.textContent.toLowerCase();
    tr.style.display = wilayahHasVisible[key] ? '' : 'none';
  });
});

// ===== Chart.js =====
let wilayahChart, pieChart, ukpdChart, pendidikanChart, rumpunStatusChart;
window.addEventListener('load', () => {
  if (typeof Chart === 'undefined') return;
  if (typeof ChartDataLabels !== 'undefined') { Chart.register(ChartDataLabels); }

  const WILAYAH_LABELS   = <?= json_encode($wilayah_labels) ?>;
  const WILAYAH_DATASETS = <?= json_encode($wilayah_datasets) ?>;
  const STATUS_LABELS    = <?= json_encode(array_keys($data_status)) ?>;
  const STATUS_DATA      = <?= json_encode(array_values($data_status)) ?>;
  const UKPD_LABELS      = <?= json_encode($ukpd_labels) ?>;
  const UKPD_DATASETS    = <?= json_encode($ukpd_datasets) ?>;

  const RUMPUN_LABELS_RAW = <?= json_encode($rumpun_labels_raw) ?>;
  const RUMPUN_LABELS = (RUMPUN_LABELS_RAW || []).map(x => (x === null || x === '') ? '(kosong)' : x);
  const RUMPUN_TOTALS = <?= json_encode($rumpun_totals) ?>;
  const RUMPUN_DATASETS = <?= json_encode($rumpun_datasets) ?>;

  const PENDIDIKAN_LABELS   = <?= json_encode($pendidikan_labels) ?>;
  const PENDIDIKAN_DATASETS = <?= json_encode($pendidikan_datasets) ?>;

  const isDark = () => document.documentElement.classList.contains('dark');
  const gridColor = () => isDark() ? '#334155' : '#e5e7eb';
  const commonAnim = { duration: 800, easing: 'easeOutQuart' };

  const EmptyPlugin = {
    id: 'empty',
    afterDraw(chart) {
      const total = (chart.data.datasets||[]).reduce((s,ds)=>s + (ds.data||[]).reduce((a,b)=>a+(+b||0),0), 0);
      if (!total) {
        const {ctx, chartArea} = chart; if (!chartArea) return;
        ctx.save(); ctx.fillStyle = getComputedStyle(document.body).color; ctx.globalAlpha = .6;
        ctx.textAlign = 'center'; ctx.font = '600 14px "Plus Jakarta Sans", system-ui';
        ctx.fillText('Tidak ada data', (chartArea.left+chartArea.right)/2, (chartArea.top+chartArea.bottom)/2);
        ctx.restore();
      }
    }
  };
  Chart.register(EmptyPlugin);

  // ===== helper: total hanya dari slice yang masih terlihat =====
  function visibleTotal(chart, dsIndex){
    const ds = chart.data.datasets[dsIndex];
    let sum = 0;
    ds.data.forEach((v,i)=>{
      if (chart.getDataVisibility(i)) sum += (+v || 0);
    });
    return sum || 1;
  }

  wilayahChart = new Chart(document.getElementById('wilayahChart'), {
    type: 'bar',
    data: { labels: WILAYAH_LABELS, datasets: JSON.parse(JSON.stringify(WILAYAH_DATASETS)) },
    options: {
      responsive:true, maintainAspectRatio:false, indexAxis:'x',
      plugins:{ legend:{ position:'top', align:'start', labels:{ usePointStyle:true } }, datalabels:{ display:false }, tooltip:{ callbacks:{ label:(c)=>`${c.dataset.label}: ${(+c.raw).toLocaleString('id-ID')}` } }, empty:{} },
      scales:{ x:{ stacked:true, grid:{ color:gridColor } }, y:{ stacked:true, beginAtZero:true, grid:{ color:gridColor } } },
      animation: commonAnim
    }
  });

  // ===== PIE / DOUGHNUT =====
  pieChart = new Chart(document.getElementById('statusPegawaiChart'), {
    type: 'doughnut',
    data: { labels: STATUS_LABELS, datasets: [{ data: STATUS_DATA, backgroundColor: ['#0EA5E9', '#06B6D4', '#22C55E', '#14B8A6', '#8B5CF6'] }] },
    options: {
      responsive:true, cutout:'58%',
      plugins:{
        legend:{ position:'bottom' },
        tooltip:{ 
          callbacks:{ 
            label:(c)=>{
              const v = +c.raw || 0;
              const tot = visibleTotal(c.chart, c.datasetIndex);
              const p = (v / tot * 100);
              return `${c.label}: ${v.toLocaleString('id-ID')} (${p.toFixed(1)}%)`;
            }
          } 
        },
        datalabels:{ 
          color:'#fff', font:{weight:'bold'},
          formatter:(v,ctx)=>{
            const tot = visibleTotal(ctx.chart, ctx.datasetIndex);
            const p = v / tot * 100;
            return p >= 4 ? p.toFixed(1) + '%' : '';
          }
        },
        empty:{} 
      },
      animation:{ animateRotate:true, duration:900, easing:'easeOutQuart' }
    }
  });

  ukpdChart = new Chart(document.getElementById('ukpdChart'), {
    type: 'bar',
    data: { labels: UKPD_LABELS, datasets: JSON.parse(JSON.stringify(UKPD_DATASETS)) },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'top', align:'start', labels:{ usePointStyle:true } }, datalabels:{ display:false }, tooltip:{ callbacks:{ label:(c)=>`${c.dataset.label}: ${(+c.raw).toLocaleString('id-ID')}` } }, empty:{} },
      scales:{ x:{ stacked:true, ticks:{ autoSkip:false, maxRotation:60 }, grid:{ color:gridColor } }, y:{ stacked:true, beginAtZero:true, grid:{ color:gridColor } } },
      animation: commonAnim
    }
  });

  // ===== Pendidikan × Status (stacked horizontal) =====
  pendidikanChart = new Chart(document.getElementById('pendidikanChart'), {
    type: 'bar',
    data: {
      labels: PENDIDIKAN_LABELS,
      datasets: JSON.parse(JSON.stringify(PENDIDIKAN_DATASETS))
    },
    options: {
      indexAxis: 'y',
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ position:'top', align:'start', labels:{ usePointStyle:true } },
        datalabels:{ display:false },
        tooltip:{ callbacks:{ label:(c)=>`${c.dataset.label}: ${(+c.raw).toLocaleString('id-ID')}` } },
        empty:{}
      },
      scales:{
        x:{ stacked:true, beginAtZero:true, grid:{ color:gridColor } },
        y:{ stacked:true, grid:{ color:gridColor } }
      },
      animation: commonAnim
    }
  });

  // ===== Rumpun × Status =====
  rumpunStatusChart = new Chart(document.getElementById('rumpunStatusChart'), {
    type: 'bar',
    data: { labels: RUMPUN_LABELS, datasets: JSON.parse(JSON.stringify(RUMPUN_DATASETS)) },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'top', align:'start', labels:{ usePointStyle:true } }, datalabels:{ display:false }, tooltip:{ callbacks:{ label:(c)=>`${c.dataset.label}: ${(+c.raw).toLocaleString('id-ID')}` } }, empty:{} },
      scales:{ x:{ stacked:true, grid:{ color:gridColor } }, y:{ stacked:true, beginAtZero:true, grid:{ color:gridColor } } },
      animation: commonAnim
    }
  });

  // Unduh PNG
  const dl = (id, name)=>{ const a=document.createElement('a'); a.href=document.getElementById(id).toDataURL('image/png',1); a.download=name; a.click(); }
  document.getElementById('dlWilayah')?.addEventListener('click', ()=>dl('wilayahChart','wilayah.png'));
  document.getElementById('dlPie')?.addEventListener('click', ()=>dl('statusPegawaiChart','status.png'));
  document.getElementById('dlUkpd')?.addEventListener('click', ()=>dl('ukpdChart','ukpd.png'));
  document.getElementById('dlPendidikan')?.addEventListener('click', ()=>dl('pendidikanChart','pendidikan.png'));
  document.getElementById('dlRumpunStatus')?.addEventListener('click', ()=>dl('rumpunStatusChart','rumpun_status.png'));

  // === Compact mode state on load ===
  const savedCompact = localStorage.getItem('compactMode') === '1';
  setCompact(savedCompact);
});

// ===== Compact Mode Toggle =====
const compactBtn = document.getElementById('compactToggle');
const compactDot = document.getElementById('compactDot');

function setCompact(enabled){
  document.body.classList.toggle('compact', !!enabled);
  localStorage.setItem('compactMode', enabled ? '1' : '0');
  if(compactDot){
    compactDot.classList.toggle('bg-emerald-500', enabled);
    compactDot.classList.toggle('bg-slate-300', !enabled);
  }
  // Resize charts supaya canvas menyesuaikan tinggi baru
  setTimeout(()=>{ 
    try{ wilayahChart?.resize(); }catch(e){}
    try{ pieChart?.resize(); }catch(e){}
    try{ ukpdChart?.resize(); }catch(e){}
    try{ pendidikanChart?.resize(); }catch(e){}
    try{ rumpunStatusChart?.resize(); }catch(e){}
  }, 0);
}

compactBtn?.addEventListener('click', ()=>{
  const now = !document.body.classList.contains('compact');
  setCompact(now);
});
</script>
</body>
</html>
