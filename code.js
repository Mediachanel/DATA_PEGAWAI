// Konfigurasi
const SPREADSHEET_ID = '1Bjz0kVWodHQUr0O9FiVPd7Z9LrQVY4GG6nZiczlv_Vw';
const DATA_SHEET = 'DATA PEGAWAI';
const USER_SHEET = 'username'; // kolom: Nama UKPD | Username | Password | Hak akses | Wilayah
const MUTASI_SHEET = 'USULAN_MUTASI';
const PEMUTUSAN_SHEET = 'USULAN_PEMUTUSAN_JF';
const BEZETTING_SHEET = 'bezetting';
// Urutan kolom data pegawai (A:AC) termasuk wilayah_ukpd
const COLS = [
  'nama_pegawai','npwp','no_bpjs','nama_jabatan_orb','nama_jabatan_prb','nama_status_aktif','nama_status_rumpun',
  'jenis_kontrak','nip','nik','jenis_kelamin','tmt_kerja_ukpd','tempat_lahir','tanggal_lahir','agama',
  'jenjang_pendidikan','jurusan_pendidikan','no_tlp','email','nama_ukpd','wilayah_ukpd','golongan_darah','gelar_depan',
  'gelar_belakang','status_pernikahan','nama_jenis_pegawai','catatan_revisi_biodata','alamat_ktp','alamat_domisili'
];
const MUTASI_COLS = [
  'id','nip','nama_pegawai','jabatan_asal','jabatan_baru','nama_ukpd_asal','nama_ukpd_tujuan',
  'wilayah_asal','wilayah_tujuan','jenis_mutasi','alasan','tanggal_usulan','status','keterangan',
  'abk_j_lama','bezetting_j_lama','abk_j_baru','bezetting_j_baru','berkas_url'
];
const PEMUTUSAN_COLS = [
  'id_usulan','status','nama_pegawai','nip','pangkat_gol','jabatan_lama','jabatan_baru','angka_kredit',
  'ukpd','wilayah','nomor_surat','tanggal_surat','alasan_usulan','link_dokumen',
  'verifikasi_oleh','verifikasi_tanggal','verifikasi_catatan','dibuat_oleh','dibuat_pada','diupdate_pada'
];
const BEZETTING_COLS = [
  'no','bidang','subbidang','nama_jabatan_pergub','nama_jabatan_permenpan','rumpun_jabatan','kode',
  'abk','eksisting','selisih','nama_pegawai','nip','nrk','status_formasi','pendidikan','keterangan',
  'sisa_formasi_2026','kebutuhan_asn_2026','perencanaan_kebutuhan','program_studi','perencanaan_pendidikan_lanjutan',
  'ukpd','wilayah'
];
// Opsional: pakai token sederhana di header x-api-key atau query ?token=
const API_TOKEN = '';
const DRIVE_FOLDER_ID = '';

// Router utama
function doGet(e) { return handleRequest(e, 'GET'); }
function doPost(e) {
  const body = parseBody(e);
  const override = (body._method || e?.parameter?._method || e?.parameter?.method || e?.parameter?._METHOD || '').toUpperCase();
  const method = override || 'POST'; // untuk PUT/DELETE pakai override
  return handleRequest({ ...e, body }, method);
}

function handleRequest(e, method) {
  const path = (e?.pathInfo || '').replace(/^\/+/, ''); // contoh: "pegawai/123"
  const [root, id] = path ? path.split('/') : [''];
  if (method === 'OPTIONS') return json({}); // preflight fallback

  if (method === 'GET' && root === 'health') return json({ ok: true });
  if (method === 'POST' && root === 'login') return login(e);
  if (method === 'POST' && root === 'upload') return uploadFile(e);
  if (root === 'pegawai') {
    if (method === 'GET') return listPegawai(e);
    if (method === 'POST') return createPegawai(e);
    if (method === 'PUT') return updatePegawai(e, id);
    if (method === 'DELETE') return deletePegawai(e, id);
  }
  if (root === 'mutasi') {
    if (method === 'GET') return listMutasi(e);
    if (method === 'POST') return createMutasi(e);
    if (method === 'PUT') return updateMutasi(e, id);
    if (method === 'DELETE') return deleteMutasi(e, id);
  }
  if (root === 'pemutusan-jf') {
    if (method === 'GET') return listPemutusan(e);
    if (method === 'POST') return createPemutusan(e);
    if (method === 'PUT') return updatePemutusan(e, id);
    if (method === 'DELETE') return deletePemutusan(e, id);
  }
  if (root === 'bezetting') {
    if (method === 'GET') return listBezetting(e);
    if (method === 'POST') return createBezetting(e);
    if (method === 'PUT') return updateBezetting(e, id);
    if (method === 'DELETE') return deleteBezetting(e, id);
  }
  return json({ ok: false, error: 'route not found' });
}

// ==== Handler ====
function listPegawai(e) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DATA_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet DATA PEGAWAI tidak ditemukan' });

  const params = e.parameter || {};
  const limit = Math.max(1, Math.min(parseInt(params.limit, 10) || 20000, 30000));
  const offset = Math.max(0, parseInt(params.offset, 10) || 0);
  const term = (params.search || '').toLowerCase().trim();
  const unit = (params.unit || '').toLowerCase().trim();
  const wilayah = (params.wilayah || '').toLowerCase().trim();
  const jab = (params.jabatan || '').toLowerCase().trim();
  const statuses = (params.status || '').split(',').map(s => s.toLowerCase().trim()).filter(Boolean);

  const values = sheet.getDataRange().getValues();
  if (!values.length) return json({ ok: true, rows: [], total: 0, summary: {}, units: [], jabs: [], statuses: [] });

  const [header, ...rowsRaw] = values;
  const records = rowsRaw.map(r => toRecord(header, r)).filter(r => r.id);

  const filtered = records.filter(r => {
    const matchTerm = !term || [r.nama_pegawai, r.nip, r.nik].some(v => (v || '').toLowerCase().includes(term));
    const matchUnit = !unit || (r.nama_ukpd || '').toLowerCase().trim() === unit;
    const matchWilayah = !wilayah || (r.wilayah_ukpd || '').toLowerCase().trim().includes(wilayah);
    const matchJab = !jab || (r.nama_jabatan_orb || '').toLowerCase().includes(jab);
    const matchStatus = !statuses.length || statuses.includes((r.nama_status_aktif || '').toLowerCase().trim());
    return matchTerm && matchUnit && matchWilayah && matchJab && matchStatus;
  });

  const total = filtered.length;
  const slice = filtered.slice(offset, offset + limit);
  const summary = countStatus(filtered);
  const units = uniq(filtered.map(r => r.nama_ukpd));
  const jabs = uniq(filtered.map(r => r.nama_jabatan_orb));
  const statusList = uniq(filtered.map(r => r.nama_status_aktif));

  return json({ ok: true, rows: slice, total, summary, units, jabs, statuses: statusList });
}

function createPegawai(e) {
  if (!checkToken(e)) return forbidden();
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DATA_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet DATA PEGAWAI tidak ditemukan' });
  const body = e.body || parseBody(e) || {};
  const row = COLS.map(k => body[k] || '');
  sheet.appendRow(row);
  return json({ ok: true });
}

function updatePegawai(e, id) {
  if (!checkToken(e)) return forbidden();
  if (!id) return json({ ok: false, error: 'ID (NIP/NIK) wajib' });
  const body = e.body || parseBody(e) || {};
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DATA_SHEET);
  const values = sheet.getDataRange().getValues();
  const [header, ...rows] = values;
  const idx = findRowIndexById(header, rows, id);
  if (idx < 0) return json({ ok: false, error: 'ID tidak ditemukan' });
  const rowNumber = idx + 2; // header di baris 1
  const payload = COLS.map(k => body[k] || '');
  sheet.getRange(rowNumber, 1, 1, COLS.length).setValues([payload]);
  return json({ ok: true });
}

function deletePegawai(e, id) {
  if (!checkToken(e)) return forbidden();
  if (!id) return json({ ok: false, error: 'ID (NIP/NIK) wajib' });
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DATA_SHEET);
  const values = sheet.getDataRange().getValues();
  const [header, ...rows] = values;
  const idx = findRowIndexById(header, rows, id);
  if (idx < 0) return json({ ok: false, error: 'ID tidak ditemukan' });
  sheet.deleteRow(idx + 2);
  return json({ ok: true });
}

function login(e) {
  const body = e.body || parseBody(e) || {};
  const username = (body.username || '').trim();
  const password = (body.password || '').trim();
  if (!username || !password) return json({ ok: false, error: 'Username dan password wajib' });

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USER_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet username tidak ditemukan' });
  const [header, ...rows] = sheet.getDataRange().getValues();
  const h = (header || []).map(x => (x || '').toLowerCase());
  const idxNamaUkpd = h.indexOf('nama ukpd');
  const idxUser = h.indexOf('username');
  const idxPass = h.indexOf('password');
  const idxHak = h.indexOf('hak akses');
  const idxWilayah = h.indexOf('wilayah');
  const users = rows.map(r => ({
    namaUkpd: (idxNamaUkpd >= 0 ? r[idxNamaUkpd] : r[0] || '').trim(),
    username: (idxUser >= 0 ? r[idxUser] : r[1] || r[0] || '').trim(),
    password: (idxPass >= 0 ? r[idxPass] : r[2] || '').trim(),
    role: (idxHak >= 0 ? r[idxHak] : r[3] || '').trim(),
    wilayah: (idxWilayah >= 0 ? r[idxWilayah] : r[4] || '').trim(),
  }));
  const found = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  if (!found) return json({ ok: false, error: 'Username atau password salah' });
  return json({ ok: true, user: { username: found.username, role: found.role, namaUkpd: found.namaUkpd, wilayah: found.wilayah } });
}

// ==== Mutasi ====
function listMutasi(e) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MUTASI_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet USULAN_MUTASI tidak ditemukan' });
  const params = e.parameter || {};
  const limit = Math.max(1, Math.min(parseInt(params.limit, 10) || 20000, 30000));
  const offset = Math.max(0, parseInt(params.offset, 10) || 0);
  const term = norm(params.search);
  const status = norm(params.status);
  const ukpd = norm(params.ukpd);
  const tujuan = norm(params.tujuan);
  const jenis = norm(params.jenis_mutasi);
  const wilayah = norm(params.wilayah);

  const values = sheet.getDataRange().getValues();
  if (!values.length) {
    return json({ ok: true, rows: [], total: 0, summary: {}, statuses: [], ukpds: [], tujuan: [], jenis: [] });
  }

  const [header, ...rows] = values;
  const map = getUkpdWilayahMap();
  const list = rows.map(r => {
    const rec = toMutasiRecord(header, r);
    if (!rec.wilayah_asal) rec.wilayah_asal = map[norm(rec.nama_ukpd_asal)] || '';
    if (!rec.wilayah_tujuan) rec.wilayah_tujuan = map[norm(rec.nama_ukpd_tujuan)] || '';
    return rec;
  }).filter(r => r.id);

  let filtered = list.filter(r => {
    const matchTerm = !term || [r.nip, r.nama_pegawai].some(v => norm(v).includes(term));
    const matchStatus = !status || norm(r.status) === status;
    const matchUkpd = !ukpd || norm(r.nama_ukpd_asal) === ukpd;
    const matchTujuan = !tujuan || norm(r.nama_ukpd_tujuan) === tujuan;
    const matchJenis = !jenis || norm(r.jenis_mutasi) === jenis;
    return matchTerm && matchStatus && matchUkpd && matchTujuan && matchJenis;
  });

  if (wilayah) {
    filtered = filtered.filter(r => {
      const wAsal = norm(r.wilayah_asal);
      const wTujuan = norm(r.wilayah_tujuan);
      return wAsal === wilayah || wTujuan === wilayah;
    });
  }

  const total = filtered.length;
  const summary = countBy(filtered, 'status');
  const statuses = uniq(filtered.map(r => r.status));
  const ukpds = uniq(filtered.map(r => r.nama_ukpd_asal));
  const tujuanList = uniq(filtered.map(r => r.nama_ukpd_tujuan));
  const jenisList = uniq(filtered.map(r => r.jenis_mutasi));
  const slice = filtered.slice(offset, offset + limit);

  return json({ ok: true, rows: slice, total, summary, statuses, ukpds, tujuan: tujuanList, jenis: jenisList });
}

function createMutasi(e) {
  if (!checkToken(e)) return forbidden();
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MUTASI_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet USULAN_MUTASI tidak ditemukan' });
  const body = e.body || parseBody(e) || {};
  const id = body.id || `UM-${Date.now()}`;
  const map = getUkpdWilayahMap();
  const wilayahAsal = body.wilayah_asal || map[norm(body.nama_ukpd_asal)] || '';
  const wilayahTujuan = body.wilayah_tujuan || map[norm(body.nama_ukpd_tujuan)] || '';
  const rowData = { ...body, id, wilayah_asal: wilayahAsal, wilayah_tujuan: wilayahTujuan };
  const row = MUTASI_COLS.map(k => (k === 'id' ? id : (rowData[k] || '')));
  sheet.appendRow(row);
  return json({ ok: true, id });
}

function updateMutasi(e, id) {
  if (!checkToken(e)) return forbidden();
  if (!id) return json({ ok: false, error: 'ID mutasi wajib' });
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MUTASI_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet USULAN_MUTASI tidak ditemukan' });
  const body = e.body || parseBody(e) || {};
  const values = sheet.getDataRange().getValues();
  const [, ...rows] = values;
  const idx = rows.findIndex(r => String(r[0] || '') === String(id));
  if (idx < 0) return json({ ok: false, error: 'ID mutasi tidak ditemukan' });
  const rowNumber = idx + 2;
  const map = getUkpdWilayahMap();
  const wilayahAsal = body.wilayah_asal || map[norm(body.nama_ukpd_asal)] || '';
  const wilayahTujuan = body.wilayah_tujuan || map[norm(body.nama_ukpd_tujuan)] || '';
  const payloadData = { ...body, id, wilayah_asal: wilayahAsal, wilayah_tujuan: wilayahTujuan };
  const payload = MUTASI_COLS.map(k => (k === 'id' ? id : (payloadData[k] || '')));
  sheet.getRange(rowNumber, 1, 1, MUTASI_COLS.length).setValues([payload]);
  return json({ ok: true });
}

function deleteMutasi(e, id) {
  if (!checkToken(e)) return forbidden();
  if (!id) return json({ ok: false, error: 'ID mutasi wajib' });
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MUTASI_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet USULAN_MUTASI tidak ditemukan' });
  const values = sheet.getDataRange().getValues();
  const [, ...rows] = values;
  const idx = rows.findIndex(r => String(r[0] || '') === String(id));
  if (idx < 0) return json({ ok: false, error: 'ID mutasi tidak ditemukan' });
  sheet.deleteRow(idx + 2);
  return json({ ok: true });
}

// ==== Pemutusan JF ====
function listPemutusan(e) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PEMUTUSAN_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet USULAN_PEMUTUSAN_JF tidak ditemukan' });
  const params = e.parameter || {};
  const term = norm(params.search);
  const status = norm(params.status);
  const ukpdQuery = norm(params.ukpd);
  const wilayahQuery = norm(params.wilayah);

  const values = sheet.getDataRange().getValues();
  if (!values.length) return json({ ok: true, rows: [], total: 0, summary: {}, statuses: [], ukpds: [] });
  const [header, ...rows] = values;
  const list = rows.map(r => toPemutusanRecord(header, r)).filter(r => r.id_usulan);
  const map = wilayahQuery ? getUkpdWilayahMap() : {};

  const filtered = list.filter(r => {
    const matchTerm = !term || [r.nama_pegawai, r.nip].some(v => norm(v).includes(term));
    const matchStatus = !status || norm(r.status) === status;
    const ukVal = norm(r.ukpd);
    const matchUkpd = !ukpdQuery || ukVal === ukpdQuery;
    const wilayahValue = norm(r.wilayah) || norm(map[ukVal]);
    const matchWilayah = !wilayahQuery || wilayahValue === wilayahQuery;
    return matchTerm && matchStatus && matchUkpd && matchWilayah;
  });

  const summary = countBy(filtered, 'status');
  const statuses = uniq(filtered.map(r => r.status));
  const ukpds = uniq(filtered.map(r => r.ukpd));
  return json({ ok: true, rows: filtered, total: filtered.length, summary, statuses, ukpds });
}

function createPemutusan(e) {
  if (!checkToken(e)) return forbidden();
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PEMUTUSAN_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet USULAN_PEMUTUSAN_JF tidak ditemukan' });
  const body = e.body || parseBody(e) || {};
  const id = body.id_usulan || `PJ-${Date.now()}`;
  let wilayahVal = body.wilayah || '';
  if (!wilayahVal && body.ukpd) {
    const map = getUkpdWilayahMap();
    wilayahVal = map[norm(body.ukpd)] || '';
  }
  const rowData = { ...body, id_usulan: id, wilayah: wilayahVal };
  const row = PEMUTUSAN_COLS.map(k => rowData[k] || '');
  sheet.appendRow(row);
  return json({ ok: true, id_usulan: id });
}

function updatePemutusan(e, id) {
  if (!checkToken(e)) return forbidden();
  if (!id) return json({ ok: false, error: 'ID usulan wajib' });
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PEMUTUSAN_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet USULAN_PEMUTUSAN_JF tidak ditemukan' });
  const body = e.body || parseBody(e) || {};
  const values = sheet.getDataRange().getValues();
  const [, ...rows] = values;
  const idx = rows.findIndex(r => String(r[0] || '') === String(id));
  if (idx < 0) return json({ ok: false, error: 'ID usulan tidak ditemukan' });
  const rowNumber = idx + 2;
  let wilayahVal = body.wilayah || '';
  if (!wilayahVal && body.ukpd) {
    const map = getUkpdWilayahMap();
    wilayahVal = map[norm(body.ukpd)] || '';
  }
  const rowData = { ...body, id_usulan: id, wilayah: wilayahVal };
  const payload = PEMUTUSAN_COLS.map(k => rowData[k] || '');
  sheet.getRange(rowNumber, 1, 1, PEMUTUSAN_COLS.length).setValues([payload]);
  return json({ ok: true });
}

function deletePemutusan(e, id) {
  if (!checkToken(e)) return forbidden();
  if (!id) return json({ ok: false, error: 'ID usulan wajib' });
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PEMUTUSAN_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet USULAN_PEMUTUSAN_JF tidak ditemukan' });
  const values = sheet.getDataRange().getValues();
  const [, ...rows] = values;
  const idx = rows.findIndex(r => String(r[0] || '') === String(id));
  if (idx < 0) return json({ ok: false, error: 'ID usulan tidak ditemukan' });
  sheet.deleteRow(idx + 2);
  return json({ ok: true });
}

// ==== Bezetting ====
function listBezetting(e) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(BEZETTING_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet bezetting tidak ditemukan' });
  const params = e.parameter || {};
  const limit = Math.max(1, Math.min(parseInt(params.limit, 10) || 20000, 30000));
  const offset = Math.max(0, parseInt(params.offset, 10) || 0);
  const term = norm(params.search);
  const ukpdQuery = norm(params.ukpd);
  const wilayahQuery = norm(params.wilayah);
  const statusQuery = norm(params.status_formasi);
  const rumpunQuery = norm(params.rumpun);
  const jabatanQuery = norm(params.jabatan);

  const values = sheet.getDataRange().getValues();
  if (!values.length) return json({ ok: true, rows: [], total: 0, ukpds: [], statuses: [], rumpuns: [], jabatans: [] });
  const [header, ...rowsRaw] = values;
  let list = rowsRaw.map(r => toBezettingRecord(header, r)).filter(r => r.kode || r.no);

  list = list.filter(r => {
    if (wilayahQuery && norm(r.wilayah) !== wilayahQuery) return false;
    if (ukpdQuery && norm(r.ukpd) !== ukpdQuery) return false;
    return true;
  });

  list = list.filter(r => {
    const matchTerm = !term || [r.nama_pegawai, r.nip, r.nama_jabatan_pergub, r.nama_jabatan_permenpan].some(v => norm(v).includes(term));
    const matchStatus = !statusQuery || norm(r.status_formasi) === statusQuery;
    const matchRumpun = !rumpunQuery || norm(r.rumpun_jabatan) === rumpunQuery;
    const matchJab = !jabatanQuery || norm(r.nama_jabatan_pergub) === jabatanQuery || norm(r.nama_jabatan_permenpan) === jabatanQuery;
    return matchTerm && matchStatus && matchRumpun && matchJab;
  });

  const total = list.length;
  const slice = list.slice(offset, offset + limit);
  const ukpds = uniq(list.map(r => r.ukpd));
  const statuses = uniq(list.map(r => r.status_formasi));
  const rumpuns = uniq(list.map(r => r.rumpun_jabatan));
  const jabatans = uniq(list.flatMap(r => [r.nama_jabatan_pergub, r.nama_jabatan_permenpan]));
  return json({ ok: true, rows: slice, total, ukpds, statuses, rumpuns, jabatans });
}

function createBezetting(e) {
  if (!checkToken(e)) return forbidden();
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(BEZETTING_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet bezetting tidak ditemukan' });
  const body = e.body || parseBody(e) || {};
  const kode = body.kode || `BZ-${Date.now()}`;
  const rowData = { ...body, kode };
  const row = BEZETTING_COLS.map(k => rowData[k] || '');
  sheet.appendRow(row);
  return json({ ok: true, kode });
}

function updateBezetting(e, kode) {
  if (!checkToken(e)) return forbidden();
  if (!kode) return json({ ok: false, error: 'Kode wajib' });
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(BEZETTING_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet bezetting tidak ditemukan' });
  const body = e.body || parseBody(e) || {};
  const values = sheet.getDataRange().getValues();
  const [header, ...rows] = values;
  const idx = findRowIndexByHeader(header, rows, 'kode', 6, kode);
  if (idx < 0) return json({ ok: false, error: 'Kode tidak ditemukan' });
  const rowNumber = idx + 2;
  const rowData = { ...body, kode };
  const payload = BEZETTING_COLS.map(k => rowData[k] || '');
  sheet.getRange(rowNumber, 1, 1, BEZETTING_COLS.length).setValues([payload]);
  return json({ ok: true });
}

function deleteBezetting(e, kode) {
  if (!checkToken(e)) return forbidden();
  if (!kode) return json({ ok: false, error: 'Kode wajib' });
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(BEZETTING_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet bezetting tidak ditemukan' });
  const values = sheet.getDataRange().getValues();
  const [header, ...rows] = values;
  const idx = findRowIndexByHeader(header, rows, 'kode', 6, kode);
  if (idx < 0) return json({ ok: false, error: 'Kode tidak ditemukan' });
  sheet.deleteRow(idx + 2);
  return json({ ok: true });
}

// ==== Upload ====
function uploadFile(e) {
  if (!checkToken(e)) return forbidden();
  const body = e.body || parseBody(e) || {};
  const filename = String(body.filename || '').trim();
  const dataBase64 = String(body.dataBase64 || '').trim();
  const mimeType = String(body.mimeType || 'application/octet-stream').trim();
  if (!filename || !dataBase64) return json({ ok: false, error: 'filename dan dataBase64 wajib' });
  const bytes = Utilities.base64Decode(dataBase64);
  const blob = Utilities.newBlob(bytes, mimeType, filename);
  let file;
  if (DRIVE_FOLDER_ID) {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    file = folder.createFile(blob);
  } else {
    file = DriveApp.createFile(blob);
  }
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return json({ ok: true, id: file.getId(), url: file.getUrl() });
}

// ==== Helpers ====
function norm(val = '') {
  return String(val || '').toLowerCase().trim();
}

function getUkpdWilayahMap() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USER_SHEET);
  if (!sheet) return {};
  const values = sheet.getDataRange().getValues();
  const [header, ...rows] = values;
  const h = (header || []).map(x => norm(x));
  const idxUkpd = h.indexOf('nama ukpd');
  const idxWil = h.indexOf('wilayah');
  const map = {};
  rows.forEach(r => {
    const ukpdRaw = idxUkpd >= 0 ? r[idxUkpd] : r[0];
    const wilayahRaw = idxWil >= 0 ? r[idxWil] : r[4];
    const key = norm(ukpdRaw);
    const wilayahVal = String(wilayahRaw || '').trim();
    if (key && wilayahVal) map[key] = wilayahVal;
  });
  return map;
}

function toRecord(header, row) {
  const h = (header || []).map(x => (x || '').toLowerCase().trim());
  const get = (name, fallbackIdx) => {
    const idx = h.indexOf(name);
    if (idx >= 0 && row[idx] !== undefined) return row[idx] || '';
    if (typeof fallbackIdx === 'number' && row[fallbackIdx] !== undefined) return row[fallbackIdx] || '';
    return '';
  };
  return {
    id: get('nip', 8) || get('nik', 9) || '',
    nama_pegawai: get('nama_pegawai', 0),
    npwp: get('npwp', 1),
    no_bpjs: get('no_bpjs', 2),
    nama_jabatan_orb: get('nama_jabatan_orb', 3),
    nama_jabatan_prb: get('nama_jabatan_prb', 4),
    nama_status_aktif: get('nama_status_aktif', 5),
    nama_status_rumpun: get('nama_status_rumpun', 6),
    jenis_kontrak: get('jenis_kontrak', 7),
    nip: get('nip', 8),
    nik: get('nik', 9),
    jenis_kelamin: get('jenis_kelamin', 10),
    tmt_kerja_ukpd: get('tmt_kerja_ukpd', 11),
    tempat_lahir: get('tempat_lahir', 12),
    tanggal_lahir: get('tanggal_lahir', 13),
    agama: get('agama', 14),
    jenjang_pendidikan: get('jenjang_pendidikan', 15),
    jurusan_pendidikan: get('jurusan_pendidikan', 16),
    no_tlp: get('no_tlp', 17),
    email: get('email', 18),
    nama_ukpd: get('nama_ukpd', 19),
    wilayah_ukpd: get('wilayah_ukpd', 20),
    golongan_darah: get('golongan_darah', 21),
    gelar_depan: get('gelar_depan', 22),
    gelar_belakang: get('gelar_belakang', 23),
    status_pernikahan: get('status_pernikahan', 24),
    nama_jenis_pegawai: get('nama_jenis_pegawai', 25),
    catatan_revisi_biodata: get('catatan_revisi_biodata', 26),
    alamat_ktp: get('alamat_ktp', 27),
    alamat_domisili: get('alamat_domisili', 28),
    unit: get('nama_ukpd', 19),
    jabatan: get('nama_jabatan_orb', 3),
    statusKaryawan: get('nama_status_aktif', 5),
    aktif: get('nama_status_aktif', 5),
  };
}

function toMutasiRecord(header, row) {
  const h = (header || []).map(x => (x || '').toLowerCase().trim());
  const get = (name, fallbackIdx) => {
    const idx = h.indexOf(name);
    if (idx >= 0 && row[idx] !== undefined) return row[idx] || '';
    if (typeof fallbackIdx === 'number' && row[fallbackIdx] !== undefined) return row[fallbackIdx] || '';
    return '';
  };
  return {
    id: get('id', 0),
    nip: get('nip', 1),
    nama_pegawai: get('nama_pegawai', 2),
    jabatan_asal: get('jabatan_asal', 3),
    jabatan_baru: get('jabatan_baru', 4),
    nama_ukpd_asal: get('nama_ukpd_asal', 5),
    nama_ukpd_tujuan: get('nama_ukpd_tujuan', 6),
    wilayah_asal: get('wilayah_asal', 7),
    wilayah_tujuan: get('wilayah_tujuan', 8),
    jenis_mutasi: get('jenis_mutasi', 9),
    alasan: get('alasan', 10),
    tanggal_usulan: get('tanggal_usulan', 11),
    status: get('status', 12),
    keterangan: get('keterangan', 13),
    abk_j_lama: get('abk_j_lama', 14),
    bezetting_j_lama: get('bezetting_j_lama', 15),
    abk_j_baru: get('abk_j_baru', 16),
    bezetting_j_baru: get('bezetting_j_baru', 17),
    berkas_url: get('berkas_url', 18),
  };
}

function toPemutusanRecord(header, row) {
  const h = (header || []).map(x => (x || '').toLowerCase().trim());
  const get = (name, fallbackIdx) => {
    const idx = h.indexOf(name);
    if (idx >= 0 && row[idx] !== undefined) return row[idx] || '';
    if (typeof fallbackIdx === 'number' && row[fallbackIdx] !== undefined) return row[fallbackIdx] || '';
    return '';
  };
  return {
    id_usulan: get('id_usulan', 0),
    status: get('status', 1),
    nama_pegawai: get('nama_pegawai', 2),
    nip: get('nip', 3),
    pangkat_gol: get('pangkat_gol', 4),
    jabatan_lama: get('jabatan_lama', 5),
    jabatan_baru: get('jabatan_baru', 6),
    angka_kredit: get('angka_kredit', 7),
    ukpd: get('ukpd', 8),
    wilayah: get('wilayah', 9),
    nomor_surat: get('nomor_surat', 10),
    tanggal_surat: get('tanggal_surat', 11),
    alasan_usulan: get('alasan_usulan', 12),
    link_dokumen: get('link_dokumen', 13),
    verifikasi_oleh: get('verifikasi_oleh', 14),
    verifikasi_tanggal: get('verifikasi_tanggal', 15),
    verifikasi_catatan: get('verifikasi_catatan', 16),
    dibuat_oleh: get('dibuat_oleh', 17),
    dibuat_pada: get('dibuat_pada', 18),
    diupdate_pada: get('diupdate_pada', 19),
  };
}

function toBezettingRecord(header, row) {
  const h = (header || []).map(x => (x || '').toLowerCase().trim());
  const get = (name, fallbackIdx) => {
    const idx = h.indexOf(name);
    if (idx >= 0 && row[idx] !== undefined) return row[idx] || '';
    if (typeof fallbackIdx === 'number' && row[fallbackIdx] !== undefined) return row[fallbackIdx] || '';
    return '';
  };
  return {
    no: get('no', 0),
    bidang: get('bidang/bagian', 1),
    subbidang: get('subbidang/subbagian/satuan pelaksana', 2),
    nama_jabatan_pergub: get('nama jabatan (pergub 1)', 3),
    nama_jabatan_permenpan: get('nama jabatan (permenpan)', 4),
    rumpun_jabatan: get('rumpun jabatan (sesuai peta pergub 1)', 5),
    kode: get('kode', 6),
    abk: get('abk', 7),
    eksisting: get('eksisting', 8),
    selisih: get('selisih', 9),
    nama_pegawai: get('nama pegawai', 10),
    nip: get('nip', 11),
    nrk: get('nrk', 12),
    status_formasi: get('status formasi', 13),
    pendidikan: get('pendidikan', 14),
    keterangan: get('keterangan', 15),
    sisa_formasi_2026: get('sisa formasi proyeksi 2026', 16),
    kebutuhan_asn_2026: get('kebutuhan asn 2026', 17),
    perencanaan_kebutuhan: get('perencanaan kebutuhan', 18),
    program_studi: get('program studi', 19),
    perencanaan_pendidikan_lanjutan: get('perencanaan pendidikan lanjutan', 20),
    ukpd: get('ukpd', 21),
    wilayah: get('wilayah', 22)
  };
}

function findRowIndexById(header, rows, id) {
  const h = (header || []).map(x => (x || '').toLowerCase().trim());
  const idxNip = h.indexOf('nip');
  const idxNik = h.indexOf('nik');
  return rows.findIndex(r => {
    const nipVal = (idxNip >= 0 ? r[idxNip] : r[8] || '').toString();
    const nikVal = (idxNik >= 0 ? r[idxNik] : r[9] || '').toString();
    return nipVal === id || nikVal === id;
  });
}

function findRowIndexByHeader(header, rows, keyName, fallbackIdx, value) {
  const h = (header || []).map(x => norm(x));
  const idx = h.indexOf(norm(keyName));
  return rows.findIndex(r => norm(idx >= 0 ? r[idx] : r[fallbackIdx]) === norm(value));
}

function countStatus(rows) {
  return rows.reduce((acc, r) => {
    const k = (r.nama_status_aktif || 'LAINNYA').toUpperCase();
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

function countBy(rows, key) {
  return rows.reduce((acc, r) => {
    const val = (r[key] || 'LAINNYA').toString().toUpperCase();
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

function parseBody(e) {
  if (!e?.postData?.contents) return {};
  try { return JSON.parse(e.postData.contents); }
  catch (err) { return {}; }
}

function checkToken(e) {
  if (!API_TOKEN) return true;
  const maybeBody = (() => { try { return JSON.parse(e?.postData?.contents || '{}'); } catch (_) { return {}; } })();
  const token = (e?.parameter?.token || e?.body?.token || maybeBody.token || e?.headers?.['x-api-key'] || '').trim();
  return token && token === API_TOKEN;
}

function json(obj, _status) {
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function forbidden() { return json({ ok: false, error: 'forbidden' }); }
