<?php
// export_mutasi_rtf.php — F4 landscape; header 3-tier presisi & centered
// PNS & NON PNS = B/K/S (sejajar), DKL merge 3 baris, filename: kajian_mutasi_(nama).rtf

require_once __DIR__ . '/../includes/init.php';
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) { header('Location: ../index.php'); exit; }
$is_dinkes = (mb_strtolower($_SESSION['nama_ukpd'] ?? '', 'UTF-8') === 'super admin');
if (!$is_dinkes) { http_response_code(403); exit('Akses khusus Dinas Kesehatan.'); }

/* ===== helpers ===== */
function tgl_id($tgl){
  if(!$tgl || $tgl==='0000-00-00' || $tgl==='0000-00-00 00:00:00') return '-';
  $b=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  $ts=strtotime($tgl); return date('d ',$ts).$b[(int)date('m',$ts)-1].date(' Y',$ts);
}
/* Escaper yang benar: normalisasi \line literal -> newline placeholder, lalu jadikan kontrol RTF */
function esc($s){
  $s = (string)$s;
  // 1) Jika sumber sudah mengandung "\line" (1/lebih backslash), anggap sebagai newline
  //    \\\\line (dua backslash saat disimpan) juga tertangkap.
  $s = preg_replace('/\\\\+line\b\s*/', "\x00", $s);
  // 2) Semua newline sistem → placeholder
  $s = str_replace(["\r\n","\r","\n"], "\x00", $s);
  // 3) Escape karakter RTF khusus
  $s = str_replace(["\\","{","}"], ["\\\\","\\{","\\}"], $s);
  // 4) Placeholder → kontrol RTF \line (bukan teks literal)
  return str_replace("\x00", "\\line ", $s);
}
function n($v){ return ($v===''||$v===null)? '-' : $v; }
function selisih($b,$k){ $b=(int)$b; $k=(int)$k; $s=$b-$k; return ($s>0?'+':'').$s; }
function safe_filename($name){
  $name = trim(preg_replace('~[^\pL\pN _.-]+~u', '', (string)$name));
  return $name !== '' ? $name : 'tanpa_nama';
}

/* ===== data ===== */
$id=(int)($_GET['id']??0);
if($id<=0){ http_response_code(400); exit('ID tidak valid'); }

$q=$conn->prepare("SELECT um.*, COALESCE(um.jenis_mutasi,'') AS jenis_mutasi_inline FROM usulan_mutasi um WHERE um.id=?");
$q->bind_param('i',$id); $q->execute(); $r=$q->get_result()->fetch_assoc(); $q->close();
if(!$r){ http_response_code(404); exit('Data tidak ditemukan'); }
$jenis_mutasi = trim((string)($r['jenis_mutasi_inline'] ?? '')) !== '' ? $r['jenis_mutasi_inline'] : '-';
$nama_file = 'kajian_mutasi_'.safe_filename($r['nama_pegawai'] ?? '').'.rtf';

/* checklist → daftar (opsional tampil di Data Kepegawaian Lain) */
$CHECK_ITEMS=[
  'surat_pengantar'=>'Surat Pengantar UKPD',
  'sk_cpns_pns'=>'SK CPNS/PNS',
  'sk_pangkat_terakhir'=>'SK Pangkat Terakhir',
  'sk_jabatan'=>'SK Jabatan',
  'dp3_skp'=>'SKP 2 tahun terakhir',
  'ijazah'=>'Fotokopi Ijazah',
  'kta_karpeg'=>'Pernyataan bersedia ditempatkan/ turun kelas',
  'surat_lolos_butuh'=>'Surat Lolos Butuh',
  'surat_lolos_lepas'=>'Surat Lolos Lepas',
  'lainnya'=>'Pernyataan tidak sedang proses Hukdis',
];
$cek=[]; if(!empty($r['verif_checklist'])){ $t=json_decode($r['verif_checklist'],true); if(is_array($t)) $cek=$t; }
$duk=[]; foreach($CHECK_ITEMS as $k=>$v){ if(!empty($cek[$k])) $duk[]=$v; }

/* Data Kepegawaian Lain — HANYA keterangan (ALASAN DIHAPUS) */
$ket = trim((string)$r['keterangan']) !== '' ? trim($r['keterangan']) : ($jenis_mutasi ?: '-');
$lain_lines = [];
$lain_lines[] = 'Ket: '.esc($ket);
// HAPUS alasan dari output
if ($duk) { $lain_lines[] = 'Data dukung:'; foreach($duk as $d){ $lain_lines[] = '  - '.esc($d); } }

/* ===== RTF setup (F4 landscape) ===== */
$paperw=18750; $paperh=12189; // 33 x 21.5 cm
$mLeft=850; $mRight=850; $mTop=567; $mBot=567;

header('Content-Type: application/rtf');
header('Content-Disposition: attachment; filename="'.$nama_file.'"');

/* ===== util tabel ===== */
function cellProps($x,$vmerge=''){ // $vmerge: '', 'start', 'cont'
  $vm = $vmerge==='start'?'\\clvmgf':($vmerge==='cont'?'\\clvmrg':'');
  return "\\clvertalc{$vm}\\clpadfl0\\clpadft0\\clpadfr0\\clpadfb0"
       ."\\clbrdrt\\brdrs\\brdrw10\\clbrdrl\\brdrs\\brdrw10\\clbrdrb\\brdrs\\brdrw10\\clbrdrr\\brdrs\\brdrw10\\cellx{$x}";
}
function cellTxt($t,$b=false,$c=false,$fs=null){
  $fmt="\\nowidctlpar ".($c?'\\qc ':'\\ql ').($b?'\\b ':'');
  if ($fs!==null) $fmt.="\\fs{$fs} ";
  return "{\\pard\\intbl {$fmt}".esc($t)."\\cell}";
}
function cellTxtRaw($t,$b=false,$c=false,$fs=null){
  $fmt="\\nowidctlpar ".($c?'\\qc ':'\\ql ').($b?'\\b ':'');
  if ($fs!==null) $fmt.="\\fs{$fs} ";
  return "{\\pard\\intbl {$fmt}{$t}\\cell}";
}
function rowStart($center=true){ return "{\\trowd\\trgaph108\\trleft0".($center ? "\\trqc" : "").""; }
function rowEnd(){ return "\\row}"; }

/* ===== definisi kolom =====
   0 NO, 1 JENIS, 2 NAMA, 3 NIP,
   4 SAATINI.TEMPAT, 5 SAATINI.JABATAN,
   6..8 SAATINI.PNS (B,K,S),
   9..11 SAATINI.NON (B,K,S),
   12 USULAN.TEMPAT, 13 USULAN.JABATAN,
   14..16 USULAN.PNS (B,K,S),
   17..19 USULAN.NON (B,K,S),
   20 DATA LAIN
*/
$w = [
  500,1100,1000,600,
  1600,1300,
  450,450,450, 450,450,450,
  1600,1300,
  450,450,450, 450,450,450,
  2600
];
$c=[]; $sum=0; foreach($w as $wi){ $sum+=$wi; $c[]=$sum; }

/* ===================== DOKUMEN ===================== */
$out  = "{\\rtf1\\ansi\\deff0\\landscape";
$out .= "\\paperw{$paperw}\\paperh{$paperh}\\margl{$mLeft}\\margr{$mRight}\\margt{$mTop}\\margb{$mBot}";
$out .= "\\fs20 ";

/* Judul */
$out .= "{\\pard\\qc\\b FORM PERTIMBANGAN PENEMPATAN PEGAWAI DI LINGKUNGAN DINAS KESEHATAN PROVINSI DKI JAKARTA\\par}";
$out .= "{\\pard\\qc Tanggal Pengajuan: ".esc(tgl_id($r['tanggal_usulan']))."  |  NIP: ".esc($r['nip']?:'-')."  |  Nama: ".esc($r['nama_pegawai']?:'-')."\\par}\\par";

/* ===== Kotak Paraf ===== */
$pf1=4200; $pf2=1000; $pf3=4600; $pc=[ $pf1, $pf1+$pf2, $pf1+$pf2+$pf3 ];
$out .= rowStart();
$out .= cellProps($pc[0]).cellProps($pc[1]).cellProps($pc[2]);
$out .= cellTxt('Jabatan',true,true).cellTxt('Paraf',true,true).cellTxt('Catatan Jika Ada',true,true);
$out .= rowEnd();
foreach([
  'Sekretaris Dinas','Ka. Bidang Pelayanan Kesehatan','Ka. Bidang Kesehatan Masyarakat',
  'Ka. Bidang Sumber Daya Kesehatan','Ka. Bidang Pencegahan dan Pengendalian Penyakit',
  'Ka. Bidang Sumber Daya Manusia Kesehatan','Sub Kelompok Kepegawaian','Pemroses'
] as $j){
  $out .= rowStart(); $out .= cellProps($pc[0]).cellProps($pc[1]).cellProps($pc[2]);
  $out .= cellTxt($j).cellTxt('').cellTxt(''); $out .= rowEnd();
}
$out .= "\\par ";

/* ===================== HEADER TABEL ===================== */
/* Row-1 */
$out .= rowStart();
$out .= cellProps($c[0],'start').cellProps($c[1],'start').cellProps($c[2],'start').cellProps($c[3],'start');
$out .= cellProps($c[11]).cellProps($c[19]).cellProps($c[20],'start');
$out .= cellTxt('NO',true,true);
$out .= cellTxt('JENIS MUTASI',true,true);
$out .= cellTxt('NAMA',true,true);
$out .= cellTxt('NIP',true,true);
$out .= cellTxt('DATA TEMPAT TUGAS SAAT INI',true,true);
$out .= cellTxt('DATA TEMPAT TUGAS USULAN',true,true);
$out .= cellTxt('DATA KEPEGAWAIAN LAIN',true,true);
$out .= rowEnd();

/* Row-2 */
$out .= rowStart();
$out .= cellProps($c[0],'cont').cellProps($c[1],'cont').cellProps($c[2],'cont').cellProps($c[3],'cont');
// SAAT INI
$out .= cellProps($c[4],'start').cellProps($c[5],'start');
$out .= cellProps($c[8]).cellProps($c[11]);
// USULAN
$out .= cellProps($c[12],'start').cellProps($c[13],'start');
$out .= cellProps($c[16]).cellProps($c[19]);
$out .= cellProps($c[20],'cont'); // DKL
$out .= cellTxt('').cellTxt('').cellTxt('').cellTxt('');
$out .= cellTxtRaw("TEMPAT\\line TUGAS",true,true);
$out .= cellTxt('JABATAN',true,true);
$out .= cellTxt('PNS',true,true);
$out .= cellTxt('NON PNS',true,true);
$out .= cellTxtRaw("USULAN\\line TEMPAT TUGAS",true,true);
$out .= cellTxt('JABATAN',true,true);
$out .= cellTxt('PNS',true,true);
$out .= cellTxt('NON PNS',true,true);
$out .= cellTxt('');
$out .= rowEnd();

/* Row-3 */
$out .= rowStart();
$out .= cellProps($c[0],'cont').cellProps($c[1],'cont').cellProps($c[2],'cont').cellProps($c[3],'cont');
// SAAT INI
$out .= cellProps($c[4],'cont').cellProps($c[5],'cont');
$out .= cellProps($c[6]).cellProps($c[7]).cellProps($c[8]);    // PNS: B K S
$out .= cellProps($c[9]).cellProps($c[10]).cellProps($c[11]);  // NON: B K S
// USULAN
$out .= cellProps($c[12],'cont').cellProps($c[13],'cont');
$out .= cellProps($c[14]).cellProps($c[15]).cellProps($c[16]); // PNS: B K S
$out .= cellProps($c[17]).cellProps($c[18]).cellProps($c[19]); // NON: B K S
$out .= cellProps($c[20],'cont'); // DKL
$out .= cellTxt('').cellTxt('').cellTxt('').cellTxt('');
$out .= cellTxt('').cellTxt('');
$out .= cellTxt('B',true,true,18).cellTxt('K',true,true,18).cellTxt('S',true,true,18);
$out .= cellTxt('B',true,true,18).cellTxt('K',true,true,18).cellTxt('S',true,true,18);
$out .= cellTxt('').cellTxt('');
$out .= cellTxt('B',true,true,18).cellTxt('K',true,true,18).cellTxt('S',true,true,18);
$out .= cellTxt('B',true,true,18).cellTxt('K',true,true,18).cellTxt('S',true,true,18);
$out .= cellTxt('');
$out .= rowEnd();

/* ===================== BARIS DATA ===================== */
$out .= rowStart();
for($i=0;$i<count($c);$i++){ $out .= cellProps($c[$i]); }

$out .= cellTxt('1',false,true);
$out .= cellTxt($jenis_mutasi);
$out .= cellTxt($r['nama_pegawai'] ?: '-');
$out .= cellTxt($r['nip'] ?: '-');

// SAAT INI
$out .= cellTxt($r['nama_ukpd'] ?: '-');
$out .= cellTxt($r['jabatan'] ?: '-');
$out .= cellTxt(n($r['bezetting_j_lama']),false,true);
$out .= cellTxt(n($r['abk_j_lama']),false,true);
$out .= cellTxt(selisih($r['bezetting_j_lama'],$r['abk_j_lama']),false,true);
$out .= cellTxt(n($r['nonasn_bezetting_lama']),false,true);
$out .= cellTxt(n($r['nonasn_abk_lama']),false,true);
$out .= cellTxt(selisih($r['nonasn_bezetting_lama'],$r['nonasn_abk_lama']),false,true);

// USULAN
$out .= cellTxt($r['ukpd_tujuan'] ?: '-');
$out .= cellTxt($r['jabatan_baru'] ?: '-');
$out .= cellTxt(n($r['bezetting_j_baru']),false,true);
$out .= cellTxt(n($r['abk_j_baru']),false,true);
$out .= cellTxt(selisih($r['bezetting_j_baru'],$r['abk_j_baru']),false,true);
$out .= cellTxt(n($r['nonasn_bezetting_baru']),false,true);
$out .= cellTxt(n($r['nonasn_abk_baru']),false,true);
$out .= cellTxt(selisih($r['nonasn_bezetting_baru'],$r['nonasn_abk_baru']),false,true);

// DATA KEPEGAWAIAN LAIN — multi-baris ringkas (tanpa Alasan)
$out .= cellTxt(implode('\\line ', $lain_lines));
$out .= rowEnd();

/* Selesai */
$out .= "}";
echo $out;
