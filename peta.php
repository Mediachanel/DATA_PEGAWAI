<?php
/* =====================================================================
   /SISDMK/peta/peta.php — Peta Jabatan (checkbox multiselect with search)
   - UI dropdown ala "Cari… + Pilih Semua/Hapus Semua + ceklis"
   - Tanpa library eksternal (murni Tailwind + vanilla JS)
   - Multi-select: UKPD[], Wilayah[], Rumpun[], Jab[] (PERMENPAN+PERGUB)
   - Reworked: tetap mempertahankan fungsi/var yg sama persis
   ===================================================================== */

require_once __DIR__ . '/../includes/init_superadmin.php';
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
  header("Location: /SISDMK/index.php"); exit;
}

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
ini_set('display_errors', 1); error_reporting(E_ALL);
date_default_timezone_set('Asia/Jakarta');

if (!($conn instanceof mysqli)) { die('Koneksi DB tidak tersedia'); }
$conn->set_charset('utf8mb4');
$conn->query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
$conn->query("SET collation_connection = 'utf8mb4_unicode_ci'");

$active = 'master-peta';

/* ==== helpers: dipertahankan nama & perilakunya ==== */
if (!function_exists('e')) { function e($s){ return htmlspecialchars((string)$s, ENT_QUOTES|ENT_SUBSTITUTE, 'UTF-8'); } }
function n($x){ return number_format((int)$x, 0, ',', '.'); }
function s($v){ return trim((string)$v); }
function u($v){ return strtoupper(s($v)); }
function any_f($arr){ foreach($arr as $v){ if(is_array($v)){ if(any_f($v)) return true; } else { if(s($v)!=='') return true; } } return false; }
function get_arr($name){ $raw = $_GET[$name] ?? []; if(!is_array($raw)) $raw = [$raw]; $o=[]; foreach($raw as $v){ $v=s($v); if($v!=='') $o[]=$v; } return array_values(array_unique($o)); }

/* ==== CSRF untuk aksi delete ==== */
if (empty($_SESSION['csrf'])) { $_SESSION['csrf'] = bin2hex(random_bytes(16)); }
$csrf = $_SESSION['csrf'];

/* ===== AKSI HAPUS ===== */
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && ($_POST['do'] ?? '') === 'delete') {
  if (!hash_equals($_SESSION['csrf'] ?? '', $_POST['csrf'] ?? '')) {
    http_response_code(403); die('CSRF token mismatch');
  }
  $id = s($_POST['id'] ?? '');
  if ($id !== '') {
    $st = $conn->prepare("DELETE FROM peta WHERE id = ?");
    $st->bind_param('s', $id);
    $st->execute();
  }
  header("Location: ".($_POST['redirect'] ?? 'peta.php'));
  exit;
}

/* ===== FILTER (multi) ===== */
$F_JABS  = get_arr('jab');   // jabatan gabungan
$F_RMPS  = get_arr('rmp');   // rumpun
$F_UKPDS = get_arr('ukpd');  // ukpd
$F_WILS  = get_arr('wil');   // wilayah
$F_NMNR  = s($_GET['nmnr'] ?? '');

$filters_provided = any_f([$F_JABS,$F_RMPS,$F_UKPDS,$F_WILS,$F_NMNR]);

/* ===== OPTIONS (untuk multiselect) ===== */
$optUKPD=$optWil=$optRmp=$optJab=[];
$r=$conn->query("SELECT DISTINCT ukpd FROM peta WHERE TRIM(COALESCE(ukpd,''))<>'' ORDER BY ukpd");
foreach($r as $row){ $v=s($row['ukpd']??''); if($v!=='') $optUKPD[]=$v; }
$r=$conn->query("SELECT DISTINCT wilayah FROM peta WHERE TRIM(COALESCE(wilayah,''))<>'' ORDER BY wilayah");
foreach($r as $row){ $v=s($row['wilayah']??''); if($v!=='') $optWil[]=$v; }
$r=$conn->query("SELECT DISTINCT rumpun_jabatan_pergub1 AS r FROM peta WHERE TRIM(COALESCE(rumpun_jabatan_pergub1,''))<>'' ORDER BY r");
foreach($r as $row){ $v=s($row['r']??''); if($v!=='') $optRmp[]=$v; }
$r=$conn->query(
  " SELECT DISTINCT nama_jabatan_permenpan AS j FROM peta WHERE TRIM(COALESCE(nama_jabatan_permenpan,''))<>''
     UNION
     SELECT DISTINCT nama_jabatan_pergub1 AS j FROM peta WHERE TRIM(COALESCE(nama_jabatan_pergub1,''))<>'' "
);
foreach($r as $row){ $v=s($row['j']??''); if($v!=='') $optJab[]=$v; }
sort($optUKPD); sort($optWil); sort($optRmp); sort($optJab);

/* ===== WHERE builder (pakai bind param untuk IN) ===== */
$where=[]; $params=[]; $types='';
function build_in_expr($col,$arr,&$types,&$params){
  if(!$arr) return null;
  $place=implode(',',array_fill(0,count($arr),'?'));
  foreach($arr as $v){ $params[]=$v; $types.='s'; }
  return "($col COLLATE utf8mb4_unicode_ci IN ($place))";
}

// Jabatan (gabungan: permenpan/pergub)
if ($F_JABS){
  $t1=$types; $p1=$params;
  $e1=build_in_expr('p.nama_jabatan_permenpan',$F_JABS,$types,$params);
  $e2=build_in_expr('p.nama_jabatan_pergub1',$F_JABS,$types,$params);
  if($e1 && $e2){
    $where[]="($e1 OR $e2)";
  } else {
    // fallback: pairwise OR
    $types=$t1; $params=$p1;
    foreach($F_JABS as $j){
      $where[]="((p.nama_jabatan_permenpan COLLATE utf8mb4_unicode_ci)=? OR (p.nama_jabatan_pergub1 COLLATE utf8mb4_unicode_ci)=?)";
      $params[]=$j; $params[]=$j; $types.='ss';
    }
  }
}
if ($F_RMPS){ $e=build_in_expr('p.rumpun_jabatan_pergub1',$F_RMPS,$types,$params); if($e) $where[]=$e; }
if ($F_UKPDS){ $e=build_in_expr('p.ukpd',$F_UKPDS,$types,$params); if($e) $where[]=$e; }
if ($F_WILS){ $e=build_in_expr('p.wilayah',$F_WILS,$types,$params); if($e) $where[]=$e; }
if ($F_NMNR!==''){
  $where[]="((p.nama_pegawai COLLATE utf8mb4_unicode_ci) LIKE CONCAT('%', ?, '%') OR (p.nrk COLLATE utf8mb4_unicode_ci)=?)";
  array_push($params,$F_NMNR,$F_NMNR); $types.='ss';
}
$sqlWhere= $where?('WHERE '.implode(' AND ',$where)):'';

/* ===== Query data + agregasi ABK/Eksisting kelompok ===== */
$limit=300; $limitSql=" LIMIT $limit ";
$rows=[]; $tot_abk=0; $tot_exs=0; $tot_sel=0;

if($filters_provided){
  $sql="
    SELECT
      p.id,
      p.ukpd,
      p.subbidang_subbagian_satpel,
      p.nama_jabatan_permenpan,
      p.nama_jabatan_pergub1,
      p.rumpun_jabatan_pergub1,
      p.kode,
      p.abk,
      p.nama_pegawai,
      p.nip,
      p.nrk,
      p.status_formasi,
      p.wilayah,
      COALESCE(ga.abk_group,0) abk_group,
      COALESCE(ge.eksisting_group,0) eksisting_group,
      (COALESCE(ge.eksisting_group,0)-COALESCE(ga.abk_group,0)) selisih_calc
    FROM peta p
    LEFT JOIN (
      SELECT
        UPPER(TRIM(ukpd)) g_ukpd,
        UPPER(TRIM(subbidang_subbagian_satpel)) g_sub,
        UPPER(TRIM(nama_jabatan_pergub1)) g_pergub,
        UPPER(TRIM(nama_jabatan_permenpan)) g_permen,
        UPPER(TRIM(rumpun_jabatan_pergub1)) g_rumpun,
        COALESCE(SUM(
          CASE WHEN TRIM(COALESCE(ukpd,''))<>''
             AND TRIM(COALESCE(nama_jabatan_pergub1,''))<>''
             AND TRIM(COALESCE(nama_jabatan_permenpan,''))<>''
             AND TRIM(COALESCE(rumpun_jabatan_pergub1,''))<>''
             AND TRIM(COALESCE(kode,''))<>''
          THEN COALESCE(abk,0) ELSE 0 END),0) abk_group
      FROM peta
      GROUP BY g_ukpd,g_sub,g_pergub,g_permen,g_rumpun
    ) ga
      ON UPPER(TRIM(p.ukpd))=ga.g_ukpd
     AND UPPER(TRIM(p.subbidang_subbagian_satpel))=ga.g_sub
     AND UPPER(TRIM(p.nama_jabatan_pergub1))=ga.g_pergub
     AND UPPER(TRIM(p.nama_jabatan_permenpan))=ga.g_permen
     AND UPPER(TRIM(p.rumpun_jabatan_pergub1))=ga.g_rumpun
    LEFT JOIN (
      SELECT
        UPPER(TRIM(ukpd)) g_ukpd,
        UPPER(TRIM(subbidang_subbagian_satpel)) g_sub,
        UPPER(TRIM(nama_jabatan_pergub1)) g_pergub,
        UPPER(TRIM(nama_jabatan_permenpan)) g_permen,
        UPPER(TRIM(rumpun_jabatan_pergub1)) g_rumpun,
        COUNT(*) eksisting_group
      FROM peta
      WHERE TRIM(COALESCE(nama_pegawai,''))<>''
        AND TRIM(COALESCE(nip,''))<>''
        AND TRIM(COALESCE(nrk,''))<>''
      GROUP BY g_ukpd,g_sub,g_pergub,g_permen,g_rumpun
    ) ge
      ON UPPER(TRIM(p.ukpd))=ge.g_ukpd
     AND UPPER(TRIM(p.subbidang_subbagian_satpel))=ge.g_sub
     AND UPPER(TRIM(p.nama_jabatan_pergub1))=ge.g_pergub
     AND UPPER(TRIM(p.nama_jabatan_permenpan))=ge.g_permen
     AND UPPER(TRIM(p.rumpun_jabatan_pergub1))=ge.g_rumpun
    $sqlWhere
    ORDER BY p.id ASC
    $limitSql";

  $stmt=$conn->prepare($sql);
  if($types!==''){ $stmt->bind_param($types, ...$params); }
  $stmt->execute();
  $res=$stmt->get_result();

  $seen=[];
  while($r=$res->fetch_assoc()){
    $r['selisih_calc']=(int)$r['eksisting_group']-(int)$r['abk_group'];
    $rows[]=$r;
    $key=u($r['ukpd']).'|'.u($r['subbidang_subbagian_satpel']).'|'.u($r['nama_jabatan_pergub1']).'|'.u($r['nama_jabatan_permenpan']).'|'.u($r['rumpun_jabatan_pergub1']);
    if(!isset($seen[$key])){
      $seen[$key]=1;
      $tot_abk += (int)$r['abk_group'];
      $tot_exs += (int)$r['eksisting_group'];
      $tot_sel += (int)$r['selisih_calc'];
    }
  }
  $stmt->close();
}
?>
<!DOCTYPE html>
<html lang="id" class="scroll-smooth">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Peta Jabatan — Dinkes</title>
  <link rel="icon" type="image/png" sizes="32x32" href="/SISDMK/Foto/Dinkes.png?v=3">
  <link rel="apple-touch-icon" href="/SISDMK/Foto/Dinkes.png?v=3">
  <meta name="theme-color" content="#0EA5E9">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../tailwind.css">
  <style>
    :root{ --sidebar-w:18rem; }
    #mainWrap{ margin-left:var(--sidebar-w); }
    @media (max-width:991.98px){ #mainWrap{ margin-left:0; } }
    /* ==== Multiselect dropdown (tanpa lib) ==== */
    .msel{ position:relative; }
    .msel .msel-btn{ width:100%; text-align:left; }
    .msel .msel-panel{ position:absolute; z-index:40; top:100%; left:0; right:0; background:var(--tw-white, #fff); color:inherit; border:1px solid rgb(226 232 240/1); border-radius:.75rem; margin-top:.25rem; max-height:18rem; overflow:auto; display:none; box-shadow:0 12px 32px -8px rgba(2,6,23,.25); }
    .dark .msel .msel-panel{ background:#0f172a; border-color:#334155; }
    .msel.open .msel-panel{ display:block; }
    .msel .msel-search{ position:sticky; top:0; background:inherit; padding:.5rem; border-bottom:1px solid rgb(241 245 249/1); }
    .dark .msel .msel-search{ border-color:#334155; }
    .msel .msel-item{ display:flex; align-items:center; gap:.5rem; padding:.5rem .75rem; }
    .msel .msel-item:hover{ background:rgb(241 245 249/1); }
    .dark .msel .msel-item:hover{ background:#0b1220; }
    .msel .msel-footer{ position:sticky; bottom:0; background:inherit; padding:.5rem .75rem; border-top:1px solid rgb(241 245 249/1); }
    .dark .msel .msel-footer{ border-color:#334155; }
  </style>
</head>
<body class="font-sans text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950">
<?php include __DIR__ . '/../includes/layout_head.php'; ?>
<?php include __DIR__ . '/../includes/header_superadmin.php'; ?>
<?php include __DIR__ . '/../includes/sidebar_dinkes.php'; ?>

<main id="mainWrap" class="px-4 sm:px-6 py-6 space-y-4">
  <h1 class="text-xl font-semibold">Peta Jabatan</h1>

  <!-- FILTERS -->
  <section class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-soft p-4">
    <form method="get" id="filterForm" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
      <!-- Kata kunci -->
      <input type="text" name="nmnr" value="<?= e($F_NMNR) ?>" placeholder="Kata Kunci (NIP / NRK / Nama)" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60">

      <!-- UKPD -->
      <div class="msel" data-name="ukpd[]" data-placeholder="Pilih UKPD">
        <button type="button" class="msel-btn px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 flex items-center justify-between">
          <span class="msel-label">Pilih UKPD</span>
          <span class="text-slate-400">▾</span>
        </button>
        <div class="msel-panel">
          <div class="msel-search">
            <input type="text" class="w-full px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70" placeholder="Cari...">
            <label class="mt-2 block text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" class="msel-checkall mr-2"> Pilih Semua / Hapus Semua
            </label>
          </div>
          <div class="msel-list">
            <?php foreach($optUKPD as $v): $checked=in_array($v,$F_UKPDS,true); ?>
              <label class="msel-item text-sm">
                <input type="checkbox" value="<?= e($v) ?>" <?= $checked?'checked':''; ?>> <?= e($v) ?>
              </label>
            <?php endforeach; ?>
          </div>
          <div class="msel-footer text-right">
            <button type="button" class="msel-close px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700">Terapkan</button>
          </div>
        </div>
      </div>

      <!-- Jabatan (gabungan) -->
      <div class="msel" data-name="jab[]" data-placeholder="Pilih Jabatan">
        <button type="button" class="msel-btn px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 flex items-center justify-between">
          <span class="msel-label">Pilih Jabatan</span><span class="text-slate-400">▾</span>
        </button>
        <div class="msel-panel">
          <div class="msel-search">
            <input type="text" class="w-full px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70" placeholder="Cari...">
            <label class="mt-2 block text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" class="msel-checkall mr-2"> Pilih Semua / Hapus Semua
            </label>
          </div>
          <div class="msel-list">
            <?php foreach($optJab as $v): $checked=in_array($v,$F_JABS,true); ?>
              <label class="msel-item text-sm">
                <input type="checkbox" value="<?= e($v) ?>" <?= $checked?'checked':''; ?>> <?= e($v) ?>
              </label>
            <?php endforeach; ?>
          </div>
          <div class="msel-footer text-right"><button type="button" class="msel-close px-3 py-1.5 rounded-md border">Terapkan</button></div>
        </div>
      </div>

      <!-- Rumpun -->
      <div class="msel" data-name="rmp[]" data-placeholder="Pilih Rumpun">
        <button type="button" class="msel-btn px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 flex items-center justify-between">
          <span class="msel-label">Pilih Rumpun</span><span class="text-slate-400">▾</span>
        </button>
        <div class="msel-panel">
          <div class="msel-search">
            <input type="text" class="w-full px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70" placeholder="Cari...">
            <label class="mt-2 block text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" class="msel-checkall mr-2"> Pilih Semua / Hapus Semua
            </label>
          </div>
          <div class="msel-list">
            <?php foreach($optRmp as $v): $checked=in_array($v,$F_RMPS,true); ?>
              <label class="msel-item text-sm">
                <input type="checkbox" value="<?= e($v) ?>" <?= $checked?'checked':''; ?>> <?= e($v) ?>
              </label>
            <?php endforeach; ?>
          </div>
          <div class="msel-footer text-right"><button type="button" class="msel-close px-3 py-1.5 rounded-md border">Terapkan</button></div>
        </div>
      </div>

      <!-- Wilayah -->
      <div class="msel" data-name="wil[]" data-placeholder="Pilih Wilayah">
        <button type="button" class="msel-btn px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 flex items-center justify-between">
          <span class="msel-label">Pilih Wilayah</span><span class="text-slate-400">▾</span>
        </button>
        <div class="msel-panel">
          <div class="msel-search">
            <input type="text" class="w-full px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70" placeholder="Cari...">
            <label class="mt-2 block text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" class="msel-checkall mr-2"> Pilih Semua / Hapus Semua
            </label>
          </div>
          <div class="msel-list">
            <?php foreach($optWil as $v): $checked=in_array($v,$F_WILS,true); ?>
              <label class="msel-item text-sm">
                <input type="checkbox" value="<?= e($v) ?>" <?= $checked?'checked':''; ?>> <?= e($v) ?>
              </label>
            <?php endforeach; ?>
          </div>
          <div class="msel-footer text-right"><button type="button" class="msel-close px-3 py-1.5 rounded-md border">Terapkan</button></div>
        </div>
      </div>

      <div class="md:col-span-2 xl:col-span-5 flex items-center gap-2">
        <button type="submit" class="px-4 py-2 rounded-lg bg-brand text-white shadow">Terapkan</button>
        <a href="peta.php" class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700">Reset</a>
        <a href="peta_export.php?<?= http_build_query($_GET) ?>" class="px-4 py-2 rounded-lg border border-sky-300 text-sky-700 bg-sky-50 hover:bg-sky-100">Export Excel</a>
        <span class="text-xs text-slate-500 ml-auto">Maks. <?= (int)$limit ?> baris</span>
      </div>

      <?php if(!$filters_provided): ?>
        <p class="text-xs text-slate-500 md:col-span-2 xl:col-span-5">
          Gunakan dropdown untuk memilih banyak item, lalu klik <b>Terapkan</b>.
        </p>
      <?php endif; ?>
    </form>

    <?php if(!$filters_provided): ?>
      <div class="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Isi minimal satu filter lalu klik <b>Terapkan</b> agar data tidak berat.
      </div>
    <?php endif; ?>
  </section>

  <?php if($filters_provided): ?>
  <!-- KPI -->
  <section class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div class="rounded-2xl p-4 bg-gradient-to-br from-sky-600 to-brand text-white shadow-soft">
      <p class="text-xs/4 opacity-90">Total ABK (kelompok)</p><div class="text-3xl font-bold mt-1"><?= n($tot_abk) ?></div>
    </div>
    <div class="rounded-2xl p-4 bg-gradient-to-br from-emerald-600 to-emerald-500 text-white shadow-soft">
      <p class="text-xs/4 opacity-90">Total Eksisting (kelompok)</p><div class="text-3xl font-bold mt-1"><?= n($tot_exs) ?></div>
    </div>
    <div class="rounded-2xl p-4 bg-gradient-to-br from-violet-700 to-fuchsia-500 text-white shadow-soft">
      <p class="text-xs/4 opacity-90">Selisih (Eksisting − ABK)</p><div class="text-3xl font-bold mt-1"><?= n($tot_sel) ?></div>
    </div>
  </section>

  <!-- TABEL -->
  <section class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-soft p-0 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <tr>
            <th class="px-3 py-2 text-left">ID</th>
            <th class="px-3 py-2 text-left">UKPD</th>
            <th class="px-3 py-2 text-left">Atasan (Subbag/Satpel)</th>
            <th class="px-3 py-2 text-left">Jabatan PERGUB</th>
            <th class="px-3 py-2 text-left">Jabatan PERMENPAN</th>
            <th class="px-3 py-2 text-left">Rumpun</th>
            <th class="px-3 py-2 text-center">Kode</th>
            <th class="px-3 py-2 text-right">ABK</th>
            <th class="px-3 py-2 text-right">Eksisting</th>
            <th class="px-3 py-2 text-right">Selisih</th>
            <th class="px-3 py-2 text-left">Nama</th>
            <th class="px-3 py-2 text-left">NIP</th>
            <th class="px-3 py-2 text-left">NRK</th>
            <th class="px-3 py-2 text-left">Status</th>
            <th class="px-3 py-2 text-left">Wilayah</th>
            <th class="px-3 py-2 text-center">Aksi</th>
          </tr>
        </thead>
        <tbody>
          <?php if($rows): foreach($rows as $r): ?>
            <tr class="border-b border-slate-100 dark:border-slate-800">
              <td class="px-3 py-2"><?= e($r['id']) ?></td>
              <td class="px-3 py-2"><?= e($r['ukpd']) ?></td>
              <td class="px-3 py-2"><?= e($r['subbidang_subbagian_satpel']) ?></td>
              <td class="px-3 py-2"><?= e($r['nama_jabatan_pergub1']) ?></td>
              <td class="px-3 py-2"><?= e($r['nama_jabatan_permenpan']) ?></td>
              <td class="px-3 py-2"><?= e($r['rumpun_jabatan_pergub1']) ?></td>
              <td class="px-3 py-2 text-center"><?= e($r['kode']) ?></td>
              <td class="px-3 py-2 text-right font-medium"><?= n($r['abk_group']) ?></td>
              <td class="px-3 py-2 text-right font-medium"><?= n($r['eksisting_group']) ?></td>
              <td class="px-3 py-2 text-right font-semibold"><?= n($r['selisih_calc']) ?></td>
              <td class="px-3 py-2"><?= e($r['nama_pegawai']) ?></td>
              <td class="px-3 py-2"><?= e($r['nip']) ?></td>
              <td class="px-3 py-2"><?= e($r['nrk']) ?></td>
              <td class="px-3 py-2"><?= e($r['status_formasi']) ?></td>
              <td class="px-3 py-2"><?= e($r['wilayah']) ?></td>
              <td class="px-3 py-2 text-center whitespace-nowrap">
                <a class="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800" href="/SISDMK/peta/edit.php?id=<?= urlencode($r['id']) ?>">Edit</a>
                <form method="post" action="peta.php" class="inline" onsubmit="return confirm('Hapus data ID <?= e($r['id']) ?>?');">
                  <input type="hidden" name="do" value="delete">
                  <input type="hidden" name="id" value="<?= e($r['id']) ?>">
                  <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                  <input type="hidden" name="redirect" value="<?= e($_SERVER['REQUEST_URI'] ?? 'peta.php') ?>">
                  <button type="submit" class="px-2.5 py-1 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50">Hapus</button>
                </form>
              </td>
            </tr>
          <?php endforeach; else: ?>
            <tr><td colspan="16" class="px-3 py-4 text-center text-slate-500">Tidak ada data (maks. <?= (int)$limit ?> baris).</td></tr>
          <?php endif; ?>
        </tbody>
        <?php if($rows): ?>
        <tfoot class="bg-slate-50 dark:bg-slate-800">
          <tr>
            <td class="px-3 py-2 text-right font-semibold" colspan="7">TOTAL</td>
            <td class="px-3 py-2 text-right font-bold"><?= n($tot_abk) ?></td>
            <td class="px-3 py-2 text-right font-bold"><?= n($tot_exs) ?></td>
            <td class="px-3 py-2 text-right font-bold"><?= n($tot_sel) ?></td>
            <td class="px-3 py-2" colspan="6"></td>
          </tr>
        </tfoot>
        <?php endif; ?>
      </table>
    </div>
  </section>
  <?php endif; ?>
</main>

<footer class="py-3 px-4 sm:px-6 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
  <span>© <?= date('Y') ?> Dinas Kesehatan Provinsi DKI Jakarta</span>
  <span>SUBKELOMPOK KEPEGAWAIAN</span>
</footer>

<!-- ===== Multiselect JS ===== -->
<script>
(function(){
  function initOne(root){
    if(!root) return;
    const name = root.dataset.name || 'sel[]';
    const placeholder = root.dataset.placeholder || 'Pilih';
    const btn = root.querySelector('.msel-btn');
    const label = root.querySelector('.msel-label');
    const panel = root.querySelector('.msel-panel');
    const search = panel.querySelector('.msel-search input[type="text"]');
    const list = panel.querySelector('.msel-list');
    const checkAll = panel.querySelector('.msel-checkall');
    const closeBtn = panel.querySelector('.msel-close');

    // Hidden container to sync values
    const hiddenBox = document.createElement('div');
    hiddenBox.className='hidden';
    root.appendChild(hiddenBox);

    function syncHidden(){
      hiddenBox.innerHTML='';
      const checked = list.querySelectorAll('input[type="checkbox"]:checked');
      const values = [];
      checked.forEach(ch=>{
        const input=document.createElement('input');
        input.type='hidden'; input.name=name; input.value=ch.value;
        hiddenBox.appendChild(input); values.push(ch.value);
      });
      // Update label
      if(values.length===0){ label.textContent = placeholder; }
      else if(values.length===1){ label.textContent = values[0]; }
      else{ label.textContent = values.length + ' dipilih'; }
    }

    function toggle(open){
      root.classList.toggle('open', open);
      if(open){ search.value=''; filter(''); search.focus(); }
    }

    function outside(e){ if(!root.contains(e.target)) toggle(false); }

    function filter(q){
      const s = q.trim().toLowerCase();
      list.querySelectorAll('.msel-item').forEach(li=>{
        const txt = li.textContent.trim().toLowerCase();
        li.style.display = txt.includes(s) ? '' : 'none';
      });
    }

    // Pre-sync (untuk pilihan yang sudah tercentang dari server)
    syncHidden();

    // Events
    btn.addEventListener('click', ()=> toggle(!root.classList.contains('open')));
    closeBtn.addEventListener('click', ()=>{ syncHidden(); toggle(false); });
    document.addEventListener('click', outside);
    search.addEventListener('input', e=> filter(e.target.value));
    list.addEventListener('change', e=>{ if(e.target.type==='checkbox'){ syncHidden(); }});
    checkAll.addEventListener('change', e=>{
      const on = e.target.checked; list.querySelectorAll('input[type="checkbox"]').forEach(ch=>{ ch.checked = on; });
      syncHidden();
    });
    root.addEventListener('keydown', e=>{ if(e.key==='Escape'){ toggle(false); btn.focus(); } });
  }
  document.querySelectorAll('.msel').forEach(initOne);
})();
</script>
</body>
</html>
