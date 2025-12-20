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
  'id','nip','nama_pegawai','gelar_depan','gelar_belakang','pangkat_golongan','jabatan','abk_j_lama',
  'bezetting_j_lama','nonasn_bezetting_lama','nonasn_abk_lama','jabatan_baru','abk_j_baru','bezetting_j_baru',
  'nonasn_bezetting_baru','nonasn_abk_baru','nama_ukpd','ukpd_tujuan','alasan','tanggal_usulan','status',
  'berkas_path','created_by_ukpd','created_at','updated_at','keterangan','mutasi_id','jenis_mutasi','verif_checklist'
];
const MUTASI_HEADER_MAP = {
  id: ['id', 'id_usulan'],
  nip: ['nip'],
  nama_pegawai: ['nama_pegawai'],
  gelar_depan: ['gelar_depan'],
  gelar_belakang: ['gelar_belakang'],
  pangkat_golongan: ['pangkat_golongan', 'pangkat_gol'],
  jabatan: ['jabatan', 'jabatan_asal'],
  abk_j_lama: ['abk_j_lama'],
  bezetting_j_lama: ['bezetting_j_lama'],
  nonasn_bezetting_lama: ['nonasn_bezetting_lama'],
  nonasn_abk_lama: ['nonasn_abk_lama'],
  jabatan_baru: ['jabatan_baru'],
  abk_j_baru: ['abk_j_baru'],
  bezetting_j_baru: ['bezetting_j_baru'],
  nonasn_bezetting_baru: ['nonasn_bezetting_baru'],
  nonasn_abk_baru: ['nonasn_abk_baru'],
  nama_ukpd: ['nama_ukpd', 'nama_ukpd_asal', 'ukpd_asal', 'ukpd'],
  ukpd_tujuan: ['ukpd_tujuan', 'nama_ukpd_tujuan'],
  alasan: ['alasan'],
  tanggal_usulan: ['tanggal_usulan'],
  status: ['status'],
  berkas_path: ['berkas_path', 'berkas_url', 'link_dokumen'],
  created_by_ukpd: ['created_by_ukpd'],
  created_at: ['created_at'],
  updated_at: ['updated_at'],
  keterangan: ['keterangan'],
  mutasi_id: ['mutasi_id'],
  jenis_mutasi: ['jenis_mutasi'],
  verif_checklist: ['verif_checklist']
};
const PEMUTUSAN_COLS = [
  'id','nip','pangkat_golongan','nama_pegawai','jabatan','jabatan_baru','angka_kredit','alasan_pemutusan',
  'nomor_surat','tanggal_surat','hal','pimpinan','asal_surat','nama_ukpd','tanggal_usulan','status',
  'berkas_path','created_by_ukpd','created_at','updated_at','keterangan'
];
const PEMUTUSAN_HEADER_MAP = {
  id: ['id', 'id_usulan'],
  nip: ['nip'],
  pangkat_golongan: ['pangkat_golongan', 'pangkat_gol'],
  nama_pegawai: ['nama_pegawai'],
  jabatan: ['jabatan', 'jabatan_lama'],
  jabatan_baru: ['jabatan_baru'],
  angka_kredit: ['angka_kredit'],
  alasan_pemutusan: ['alasan_pemutusan', 'alasan_usulan'],
  nomor_surat: ['nomor_surat'],
  tanggal_surat: ['tanggal_surat'],
  hal: ['hal'],
  pimpinan: ['pimpinan'],
  asal_surat: ['asal_surat'],
  nama_ukpd: ['nama_ukpd', 'ukpd'],
  tanggal_usulan: ['tanggal_usulan'],
  status: ['status'],
  berkas_path: ['berkas_path', 'link_dokumen'],
  created_by_ukpd: ['created_by_ukpd'],
  created_at: ['created_at'],
  updated_at: ['updated_at'],
  keterangan: ['keterangan']
};
const BEZETTING_COLS = [
  'no','bidang','subbidang','nama_jabatan_pergub','nama_jabatan_permenpan','rumpun_jabatan','kode',
  'abk','eksisting','selisih','nama_pegawai','nip','nrk','status_formasi','pendidikan','keterangan',
  'sisa_formasi_2026','kebutuhan_asn_2026','perencanaan_kebutuhan','program_studi','perencanaan_pendidikan_lanjutan',
  'ukpd','wilayah'
];
// API key untuk Apps Script (diteruskan proxy via query `key`).
const API_KEY = 'api_6f9e3a1c8d4b2f7a9e5c1d6b8f3a2c7e';
const DRIVE_FOLDER_ID = '';
const HASH_PREFIX = 'sha256$';

// Router utama
function doGet(e) { return handleRequest(e, 'GET'); }
function doPost(e) {
  const body = parseBody(e);
  return handleRequest({ ...e, body }, 'POST');
}

function handleRequest(e, method) {
  const action = getAction(e);
  if (!action) return json({ ok: false, error: 'action wajib' });
  if (!checkApiKey(e)) return forbidden();

  if (method === 'GET') {
    if (action === 'health') return json({ ok: true, data: { time: new Date().toISOString() } });
    if (action === 'list') return listPegawai(e);
    if (action === 'get') return getPegawai(e);
    if (action === 'mutasi_list') return listMutasi(e);
    if (action === 'pemutusan_jf_list') return listPemutusan(e);
    if (action === 'bezetting_list') return listBezetting(e);
  }

  if (method === 'POST') {
    if (action === 'login') return login(e);
    if (action === 'password_change') return changePassword(e);
    if (action === 'upload') return uploadFile(e);
    if (action === 'create') return createPegawai(e);
    if (action === 'update') return updatePegawai(e);
    if (action === 'delete') return deletePegawai(e);
    if (action === 'mutasi_create') return createMutasi(e);
    if (action === 'mutasi_update') return updateMutasi(e);
    if (action === 'mutasi_delete') return deleteMutasi(e);
    if (action === 'pemutusan_jf_create') return createPemutusan(e);
    if (action === 'pemutusan_jf_update') return updatePemutusan(e);
    if (action === 'pemutusan_jf_delete') return deletePemutusan(e);
    if (action === 'bezetting_create') return createBezetting(e);
    if (action === 'bezetting_update') return updateBezetting(e);
    if (action === 'bezetting_delete') return deleteBezetting(e);
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
  if (!values.length) {
    return json({
      ok: true,
      data: { rows: [], total: 0, summary: {}, units: [], jabs: [], statuses: [] },
      rows: [],
      total: 0,
      summary: {},
      units: [],
      jabs: [],
      statuses: [],
    });
  }

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

  return json({
    ok: true,
    data: { rows: slice, total, summary, units, jabs, statuses: statusList },
    rows: slice,
    total,
    summary,
    units,
    jabs,
    statuses: statusList,
  });
}

function getPegawai(e) {
  const id = getIdParam(e);
  if (!id) return json({ ok: false, error: 'ID wajib' });
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DATA_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet DATA PEGAWAI tidak ditemukan' });
  const values = sheet.getDataRange().getValues();
  if (!values.length) return json({ ok: false, error: 'Data kosong' });
  const [header, ...rows] = values;
  const idx = findRowIndexById(header, rows, id);
  if (idx < 0) return json({ ok: false, error: 'ID tidak ditemukan' });
  const record = toRecord(header, rows[idx]);
  return json({ ok: true, data: record });
}

function createPegawai(e) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DATA_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet DATA PEGAWAI tidak ditemukan' });
  const body = e.body || parseBody(e) || {};
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
  const keys = header.map(normalizePegawaiHeader);
  const idIdx = keys.indexOf('id');
  if (idIdx >= 0 && !body.id) body.id = Utilities.getUuid();
  const row = keys.map((k) => {
    if (!k) return '';
    if (k === 'id') return body.id || '';
    return body[k] !== undefined ? body[k] : '';
  });
  sheet.appendRow(row);
  return json({ ok: true, data: { id: body.id || body.nip || body.nik || '' } });
}

function updatePegawai(e) {
  const body = e.body || parseBody(e) || {};
  const id = getIdParam(e);
  if (!id) return json({ ok: false, error: 'ID wajib' });
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DATA_SHEET);
  const values = sheet.getDataRange().getValues();
  const [header, ...rows] = values;
  const keys = header.map(normalizePegawaiHeader);
  const idx = findRowIndexById(header, rows, id);
  if (idx < 0) return json({ ok: false, error: 'ID tidak ditemukan' });
  const rowNumber = idx + 2; // header di baris 1
  const current = rowToObject(keys, rows[idx]);
  const next = { ...current, ...body };
  if (keys.includes('id') && !next.id) next.id = id;
  const payload = keys.map((k) => (k ? (next[k] !== undefined ? next[k] : '') : ''));
  sheet.getRange(rowNumber, 1, 1, keys.length).setValues([payload]);
  return json({ ok: true, data: { id } });
}

function deletePegawai(e) {
  const id = getIdParam(e);
  if (!id) return json({ ok: false, error: 'ID wajib' });
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(DATA_SHEET);
  const values = sheet.getDataRange().getValues();
  const [header, ...rows] = values;
  const idx = findRowIndexById(header, rows, id);
  if (idx < 0) return json({ ok: false, error: 'ID tidak ditemukan' });
  sheet.deleteRow(idx + 2);
  return json({ ok: true, data: { id } });
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
  const users = rows.map((r, idx) => ({
    rowNumber: idx + 2,
    namaUkpd: (idxNamaUkpd >= 0 ? r[idxNamaUkpd] : r[0] || '').trim(),
    username: (idxUser >= 0 ? r[idxUser] : r[1] || r[0] || '').trim(),
    password: (idxPass >= 0 ? r[idxPass] : r[2] || '').trim(),
    role: (idxHak >= 0 ? r[idxHak] : r[3] || '').trim(),
    wilayah: (idxWilayah >= 0 ? r[idxWilayah] : r[4] || '').trim(),
  }));
  const found = users.find(u => u.username.toLowerCase() === username.toLowerCase() && verifyPassword(password, u.password));
  if (!found) return json({ ok: false, error: 'Username atau password salah' });
  if (!isHashedPassword(found.password)) {
    const newHash = hashPassword(password);
    const passCol = idxPass >= 0 ? idxPass + 1 : 3;
    sheet.getRange(found.rowNumber, passCol).setValue(newHash);
  }
  const user = { username: found.username, role: found.role, namaUkpd: found.namaUkpd, wilayah: found.wilayah };
  return json({ ok: true, data: { user }, user });
}

function changePassword(e) {
  if (!checkToken(e)) return forbidden();
  const body = e.body || parseBody(e) || {};
  const username = (body.username || '').trim();
  const currentPassword = (body.current_password || body.old_password || '').trim();
  const newPassword = (body.new_password || '').trim();
  if (!username || !currentPassword || !newPassword) {
    return json({ ok: false, error: 'Username, password lama, dan password baru wajib' });
  }
  if (!isStrongPassword(newPassword)) {
    return json({ ok: false, error: 'Password baru belum memenuhi kriteria keamanan' });
  }
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USER_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet username tidak ditemukan' });
  const [header, ...rows] = sheet.getDataRange().getValues();
  const h = (header || []).map(x => (x || '').toLowerCase());
  const idxUser = h.indexOf('username');
  const idxPass = h.indexOf('password');
  const userIndex = rows.findIndex(r => (idxUser >= 0 ? r[idxUser] : r[1] || r[0] || '').toString().trim().toLowerCase() === username.toLowerCase());
  if (userIndex < 0) return json({ ok: false, error: 'User tidak ditemukan' });
  const stored = (idxPass >= 0 ? rows[userIndex][idxPass] : rows[userIndex][2] || '').toString().trim();
  if (!verifyPassword(currentPassword, stored)) {
    return json({ ok: false, error: 'Password lama salah' });
  }
  const newHash = hashPassword(newPassword);
  const passCol = idxPass >= 0 ? idxPass + 1 : 3;
  sheet.getRange(userIndex + 2, passCol).setValue(newHash);
  return json({ ok: true });
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
    return json({
      ok: true,
      data: { rows: [], total: 0, summary: {}, statuses: [], ukpds: [], tujuan: [], jenis: [] },
      rows: [],
      total: 0,
      summary: {},
      statuses: [],
      ukpds: [],
      tujuan: [],
      jenis: [],
    });
  }

  const [header, ...rows] = values;
  const map = getUkpdWilayahMap();
  const list = rows.map(r => {
    const rec = toMutasiRecord(header, r);
    const ukpdAsal = norm(rec.nama_ukpd);
    const ukpdTujuan = norm(rec.ukpd_tujuan);
    if (!rec.wilayah_asal) rec.wilayah_asal = map[ukpdAsal] || '';
    if (!rec.wilayah_tujuan) rec.wilayah_tujuan = map[ukpdTujuan] || '';
    return rec;
  }).filter(r => r.id);

  let filtered = list.filter(r => {
    const matchTerm = !term || [r.nip, r.nama_pegawai].some(v => norm(v).includes(term));
    const matchStatus = !status || norm(r.status) === status;
    const matchUkpd = !ukpd || norm(r.nama_ukpd) === ukpd;
    const matchTujuan = !tujuan || norm(r.ukpd_tujuan) === tujuan;
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
  const ukpds = uniq(filtered.map(r => r.nama_ukpd));
  const tujuanList = uniq(filtered.map(r => r.ukpd_tujuan));
  const jenisList = uniq(filtered.map(r => r.jenis_mutasi));
  const slice = filtered.slice(offset, offset + limit);

  return json({
    ok: true,
    data: { rows: slice, total, summary, statuses, ukpds, tujuan: tujuanList, jenis: jenisList },
    rows: slice,
    total,
    summary,
    statuses,
    ukpds,
    tujuan: tujuanList,
    jenis: jenisList,
  });
}

function createMutasi(e) {
  if (!checkToken(e)) return forbidden();
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MUTASI_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet USULAN_MUTASI tidak ditemukan' });
  const body = e.body || parseBody(e) || {};
  const id = body.id || `UM-${Date.now()}`;
  const nowIso = new Date().toISOString();
  const rowData = {
    ...body,
    id,
    tanggal_usulan: body.tanggal_usulan || nowIso.slice(0, 10),
    created_at: body.created_at || nowIso,
    updated_at: body.updated_at || nowIso,
  };
  const values = sheet.getDataRange().getValues();
  const header = values.length && values[0].length ? values[0] : MUTASI_COLS;
  const row = buildMutasiRow(header, rowData);
  sheet.appendRow(row);
  return json({ ok: true, data: { id }, id });
}

function updateMutasi(e) {
  if (!checkToken(e)) return forbidden();
  const id = getParam(e, 'id');
  if (!id) return json({ ok: false, error: 'ID mutasi wajib' });
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MUTASI_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet USULAN_MUTASI tidak ditemukan' });
  const body = e.body || parseBody(e) || {};
  const values = sheet.getDataRange().getValues();
  const [header, ...rows] = values;
  const safeHeader = header && header.length ? header : MUTASI_COLS;
  const idx = rows.findIndex(r => String(r[0] || '') === String(id));
  if (idx < 0) return json({ ok: false, error: 'ID mutasi tidak ditemukan' });
  const rowNumber = idx + 2;
  const currentRow = rows[idx] || [];
  const current = toMutasiRecord(safeHeader, currentRow);
  const rowData = { ...current, ...body, id };
  if (!rowData.updated_at) rowData.updated_at = new Date().toISOString();
  const baseRow = currentRow.slice();
  while (baseRow.length < safeHeader.length) baseRow.push('');
  const payload = applyMutasiRow(baseRow, safeHeader, rowData);
  sheet.getRange(rowNumber, 1, 1, safeHeader.length).setValues([payload]);
  return json({ ok: true, data: { id } });
}

function deleteMutasi(e) {
  if (!checkToken(e)) return forbidden();
  const id = getParam(e, 'id');
  if (!id) return json({ ok: false, error: 'ID mutasi wajib' });
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MUTASI_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet USULAN_MUTASI tidak ditemukan' });
  const values = sheet.getDataRange().getValues();
  const [, ...rows] = values;
  const idx = rows.findIndex(r => String(r[0] || '') === String(id));
  if (idx < 0) return json({ ok: false, error: 'ID mutasi tidak ditemukan' });
  sheet.deleteRow(idx + 2);
  return json({ ok: true, data: { id } });
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
  if (!values.length) {
    return json({
      ok: true,
      data: { rows: [], total: 0, summary: {}, statuses: [], ukpds: [] },
      rows: [],
      total: 0,
      summary: {},
      statuses: [],
      ukpds: [],
    });
  }
  const [header, ...rows] = values;
  const list = rows.map(r => toPemutusanRecord(header, r)).filter(r => r.id);
  const map = wilayahQuery ? getUkpdWilayahMap() : {};

  const filtered = list.filter(r => {
    const matchTerm = !term || [r.nama_pegawai, r.nip].some(v => norm(v).includes(term));
    const matchStatus = !status || norm(r.status) === status;
    const ukVal = norm(r.nama_ukpd);
    const matchUkpd = !ukpdQuery || ukVal === ukpdQuery;
    const wilayahValue = norm(map[ukVal]);
    const matchWilayah = !wilayahQuery || wilayahValue === wilayahQuery;
    return matchTerm && matchStatus && matchUkpd && matchWilayah;
  });

  const summary = countBy(filtered, 'status');
  const statuses = uniq(filtered.map(r => r.status));
  const ukpds = uniq(filtered.map(r => r.nama_ukpd));
  return json({
    ok: true,
    data: { rows: filtered, total: filtered.length, summary, statuses, ukpds },
    rows: filtered,
    total: filtered.length,
    summary,
    statuses,
    ukpds,
  });
}

function createPemutusan(e) {
  if (!checkToken(e)) return forbidden();
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PEMUTUSAN_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet USULAN_PEMUTUSAN_JF tidak ditemukan' });
  const body = e.body || parseBody(e) || {};
  const id = body.id || `PJ-${Date.now()}`;
  const nowIso = new Date().toISOString();
  const rowData = {
    ...body,
    id,
    tanggal_usulan: body.tanggal_usulan || nowIso,
    created_at: body.created_at || nowIso,
    updated_at: body.updated_at || nowIso,
  };
  const values = sheet.getDataRange().getValues();
  const header = values.length && values[0].length ? values[0] : PEMUTUSAN_COLS;
  const row = buildPemutusanRow(header, rowData);
  sheet.appendRow(row);
  return json({ ok: true, data: { id }, id });
}

function updatePemutusan(e) {
  if (!checkToken(e)) return forbidden();
  const id = getParam(e, 'id');
  if (!id) return json({ ok: false, error: 'ID wajib' });
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PEMUTUSAN_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet USULAN_PEMUTUSAN_JF tidak ditemukan' });
  const body = e.body || parseBody(e) || {};
  const values = sheet.getDataRange().getValues();
  const [header, ...rows] = values;
  const safeHeader = header && header.length ? header : PEMUTUSAN_COLS;
  const idx = rows.findIndex(r => String(r[0] || '') === String(id));
  if (idx < 0) return json({ ok: false, error: 'ID tidak ditemukan' });
  const rowNumber = idx + 2;
  const currentRow = rows[idx] || [];
  const current = toPemutusanRecord(safeHeader, currentRow);
  const rowData = { ...current, ...body, id };
  if (!rowData.updated_at) rowData.updated_at = new Date().toISOString();
  const baseRow = currentRow.slice();
  while (baseRow.length < safeHeader.length) baseRow.push('');
  const payload = applyPemutusanRow(baseRow, safeHeader, rowData);
  sheet.getRange(rowNumber, 1, 1, safeHeader.length).setValues([payload]);
  return json({ ok: true, data: { id }, id });
}

function deletePemutusan(e) {
  if (!checkToken(e)) return forbidden();
  const id = getParam(e, 'id');
  if (!id) return json({ ok: false, error: 'ID wajib' });
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PEMUTUSAN_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet USULAN_PEMUTUSAN_JF tidak ditemukan' });
  const values = sheet.getDataRange().getValues();
  const [, ...rows] = values;
  const idx = rows.findIndex(r => String(r[0] || '') === String(id));
  if (idx < 0) return json({ ok: false, error: 'ID tidak ditemukan' });
  sheet.deleteRow(idx + 2);
  return json({ ok: true, data: { id }, id });
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
  if (!values.length) {
    return json({
      ok: true,
      data: { rows: [], total: 0, ukpds: [], statuses: [], rumpuns: [], jabatans: [] },
      rows: [],
      total: 0,
      ukpds: [],
      statuses: [],
      rumpuns: [],
      jabatans: [],
    });
  }
  const [header, ...rowsRaw] = values;
  let list = rowsRaw.map(r => toBezettingRecord(header, r)).filter(r => r.kode || r.no);

  const matchWilayah = (value, query) => {
    if (!query) return true;
    const v = norm(value);
    return v === query || v.indexOf(query) > -1 || query.indexOf(v) > -1;
  };
  list = list.filter(r => {
    if (!matchWilayah(r.wilayah, wilayahQuery)) return false;
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
  return json({
    ok: true,
    data: { rows: slice, total, ukpds, statuses, rumpuns, jabatans },
    rows: slice,
    total,
    ukpds,
    statuses,
    rumpuns,
    jabatans,
  });
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
  return json({ ok: true, data: { kode }, kode });
}

function updateBezetting(e) {
  if (!checkToken(e)) return forbidden();
  const kode = getParam(e, 'kode');
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
  return json({ ok: true, data: { kode } });
}

function deleteBezetting(e) {
  if (!checkToken(e)) return forbidden();
  const kode = getParam(e, 'kode');
  if (!kode) return json({ ok: false, error: 'Kode wajib' });
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(BEZETTING_SHEET);
  if (!sheet) return json({ ok: false, error: 'Sheet bezetting tidak ditemukan' });
  const values = sheet.getDataRange().getValues();
  const [header, ...rows] = values;
  const idx = findRowIndexByHeader(header, rows, 'kode', 6, kode);
  if (idx < 0) return json({ ok: false, error: 'Kode tidak ditemukan' });
  sheet.deleteRow(idx + 2);
  return json({ ok: true, data: { kode } });
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
  return json({ ok: true, data: { id: file.getId(), url: file.getUrl() }, id: file.getId(), url: file.getUrl() });
}

// ==== Helpers ====
function norm(val = '') {
  return String(val || '').toLowerCase().trim();
}

function isHashedPassword(value = '') {
  const raw = String(value || '');
  return raw.indexOf(HASH_PREFIX) === 0 || raw.indexOf('sha256:') === 0;
}

function digestHex(input) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function hashPassword(password, salt) {
  const safeSalt = salt || Utilities.getUuid().replace(/-/g, '');
  const hash = digestHex(`${safeSalt}:${password}`);
  return `${HASH_PREFIX}${safeSalt}$${hash}`;
}

function verifyPassword(input, stored) {
  const raw = String(stored || '');
  if (raw.indexOf(HASH_PREFIX) === 0) {
    const parts = raw.split('$');
    if (parts.length !== 3) return false;
    const salt = parts[1] || '';
    const hash = parts[2] || '';
    const candidate = digestHex(`${salt}:${input}`);
    return candidate === hash;
  }
  if (raw.indexOf('sha256:') === 0) {
    const parts = raw.split(':');
    const salt = parts[1] || '';
    const hash = parts[2] || '';
    if (!salt || !hash) return false;
    const candidate = digestHex(`${salt}:${input}`);
    return candidate === hash;
  }
  return raw === String(input || '');
}

function isStrongPassword(password) {
  if (!password || password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasNumber && hasSymbol;
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

function normalizeHeaderKey(name) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
}

function buildHeaderIndex(header) {
  const map = {};
  (header || []).forEach((h, idx) => {
    const key = normalizeHeaderKey(h);
    if (!key) return;
    if (map[key] === undefined) map[key] = idx;
  });
  return map;
}

function findHeaderIndex(headerIndex, names) {
  for (const name of names) {
    const key = normalizeHeaderKey(name);
    if (key && Object.prototype.hasOwnProperty.call(headerIndex, key)) return headerIndex[key];
  }
  return -1;
}

function getMutasiValue(headerIndex, row, names, fallbackIdx) {
  const idx = findHeaderIndex(headerIndex, names);
  if (idx >= 0 && row[idx] !== undefined) return row[idx] || '';
  if (typeof fallbackIdx === 'number' && row[fallbackIdx] !== undefined) return row[fallbackIdx] || '';
  return '';
}

function buildMutasiRow(header, rowData) {
  const safeHeader = (header && header.length) ? header : MUTASI_COLS;
  const headerIndex = buildHeaderIndex(safeHeader);
  const row = new Array(safeHeader.length).fill('');
  Object.keys(MUTASI_HEADER_MAP).forEach((key) => {
    const idx = findHeaderIndex(headerIndex, MUTASI_HEADER_MAP[key]);
    if (idx >= 0) row[idx] = rowData[key] || '';
  });
  return row;
}

function applyMutasiRow(row, header, rowData) {
  const safeHeader = (header && header.length) ? header : MUTASI_COLS;
  const headerIndex = buildHeaderIndex(safeHeader);
  const next = row.slice();
  Object.keys(MUTASI_HEADER_MAP).forEach((key) => {
    const idx = findHeaderIndex(headerIndex, MUTASI_HEADER_MAP[key]);
    if (idx >= 0) next[idx] = rowData[key] || '';
  });
  return next;
}

function getPemutusanValue(headerIndex, row, names, fallbackIdx) {
  const idx = findHeaderIndex(headerIndex, names);
  if (idx >= 0 && row[idx] !== undefined) return row[idx] || '';
  if (typeof fallbackIdx === 'number' && row[fallbackIdx] !== undefined) return row[fallbackIdx] || '';
  return '';
}

function buildPemutusanRow(header, rowData) {
  const safeHeader = (header && header.length) ? header : PEMUTUSAN_COLS;
  const headerIndex = buildHeaderIndex(safeHeader);
  const row = new Array(safeHeader.length).fill('');
  Object.keys(PEMUTUSAN_HEADER_MAP).forEach((key) => {
    const idx = findHeaderIndex(headerIndex, PEMUTUSAN_HEADER_MAP[key]);
    if (idx >= 0) row[idx] = rowData[key] || '';
  });
  return row;
}

function applyPemutusanRow(row, header, rowData) {
  const safeHeader = (header && header.length) ? header : PEMUTUSAN_COLS;
  const headerIndex = buildHeaderIndex(safeHeader);
  const next = row.slice();
  Object.keys(PEMUTUSAN_HEADER_MAP).forEach((key) => {
    const idx = findHeaderIndex(headerIndex, PEMUTUSAN_HEADER_MAP[key]);
    if (idx >= 0) next[idx] = rowData[key] || '';
  });
  return next;
}

function normalizePegawaiHeader(name) {
  return String(name || '').toLowerCase().trim().replace(/\s+/g, '_');
}

function rowToObject(keys, row) {
  const obj = {};
  keys.forEach((k, idx) => {
    if (!k) return;
    obj[k] = row[idx] !== undefined ? row[idx] : '';
  });
  return obj;
}

function getIdParam(e) {
  const body = e.body || parseBody(e) || {};
  return String(e?.parameter?.id || body.id || body.nip || body.nik || '').trim();
}

function getParam(e, name) {
  const body = e.body || parseBody(e) || {};
  return String(e?.parameter?.[name] || body[name] || '').trim();
}

function toRecord(header, row) {
  const keys = (header || []).map(normalizePegawaiHeader);
  const obj = rowToObject(keys, row);
  const idVal = obj.id || obj.nip || obj.nik || '';
  const pangkatGolongan = obj.pangkat_golongan
    || obj['pangkat/golongan']
    || obj['pangkat golongan']
    || obj['pangkat/gol']
    || obj.pangkat
    || '';
  return {
    ...obj,
    id: idVal,
    pangkat_golongan: pangkatGolongan,
    unit: obj.nama_ukpd || obj.unit || '',
    jabatan: obj.nama_jabatan_orb || obj.jabatan || '',
    statusKaryawan: obj.nama_status_aktif || obj.statusKaryawan || '',
    aktif: obj.nama_status_aktif || obj.aktif || '',
  };
}

function toMutasiRecord(header, row) {
  const headerIndex = buildHeaderIndex(header);
  const getVal = (key, fallbackIdx) => {
    const names = MUTASI_HEADER_MAP[key] || [key];
    return getMutasiValue(headerIndex, row, names, fallbackIdx);
  };
  return {
    id: getVal('id', 0),
    nip: getVal('nip', 1),
    nama_pegawai: getVal('nama_pegawai', 2),
    gelar_depan: getVal('gelar_depan', 3),
    gelar_belakang: getVal('gelar_belakang', 4),
    pangkat_golongan: getVal('pangkat_golongan', 5),
    jabatan: getVal('jabatan', 6),
    abk_j_lama: getVal('abk_j_lama', 7),
    bezetting_j_lama: getVal('bezetting_j_lama', 8),
    nonasn_bezetting_lama: getVal('nonasn_bezetting_lama', 9),
    nonasn_abk_lama: getVal('nonasn_abk_lama', 10),
    jabatan_baru: getVal('jabatan_baru', 11),
    abk_j_baru: getVal('abk_j_baru', 12),
    bezetting_j_baru: getVal('bezetting_j_baru', 13),
    nonasn_bezetting_baru: getVal('nonasn_bezetting_baru', 14),
    nonasn_abk_baru: getVal('nonasn_abk_baru', 15),
    nama_ukpd: getVal('nama_ukpd', 16),
    ukpd_tujuan: getVal('ukpd_tujuan', 17),
    alasan: getVal('alasan', 18),
    tanggal_usulan: getVal('tanggal_usulan', 19),
    status: getVal('status', 20),
    berkas_path: getVal('berkas_path', 21),
    created_by_ukpd: getVal('created_by_ukpd', 22),
    created_at: getVal('created_at', 23),
    updated_at: getVal('updated_at', 24),
    keterangan: getVal('keterangan', 25),
    mutasi_id: getVal('mutasi_id', 26),
    jenis_mutasi: getVal('jenis_mutasi', 27),
    verif_checklist: getVal('verif_checklist', 28),
  };
}

function toPemutusanRecord(header, row) {
  const headerIndex = buildHeaderIndex(header);
  const getVal = (key, fallbackIdx) => {
    const names = PEMUTUSAN_HEADER_MAP[key] || [key];
    return getPemutusanValue(headerIndex, row, names, fallbackIdx);
  };

  return {
    id: getVal('id', 0),
    nip: getVal('nip', 1),
    pangkat_golongan: getVal('pangkat_golongan', 2),
    nama_pegawai: getVal('nama_pegawai', 3),
    jabatan: getVal('jabatan', 4),
    jabatan_baru: getVal('jabatan_baru', 5),
    angka_kredit: getVal('angka_kredit', 6),
    alasan_pemutusan: getVal('alasan_pemutusan', 7),
    nomor_surat: getVal('nomor_surat', 8),
    tanggal_surat: getVal('tanggal_surat', 9),
    hal: getVal('hal', 10),
    pimpinan: getVal('pimpinan', 11),
    asal_surat: getVal('asal_surat', 12),
    nama_ukpd: getVal('nama_ukpd', 13),
    tanggal_usulan: getVal('tanggal_usulan', 14),
    status: getVal('status', 15),
    berkas_path: getVal('berkas_path', 16),
    created_by_ukpd: getVal('created_by_ukpd', 17),
    created_at: getVal('created_at', 18),
    updated_at: getVal('updated_at', 19),
    keterangan: getVal('keterangan', 20),
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
  const namaJabatanPergub = get('nama jabatan (pergub 1)', 3);
  const namaJabatanPermenpan = get('nama jabatan (permenpan)', 4);
  const jabatanOrb = get('jabatan orb') || get('nama jabatan orb') || get('jabatan (orb)') || get('nama jabatan (orb)') || namaJabatanPergub || namaJabatanPermenpan;
  const pangkatGolongan = get('pangkat/golongan') || get('pangkat golongan') || get('pangkat_golongan') || get('pangkat/gol') || get('pangkat');
  return {
    no: get('no', 0),
    bidang: get('bidang/bagian', 1),
    subbidang: get('subbidang/subbagian/satuan pelaksana', 2),
    nama_jabatan_pergub: namaJabatanPergub,
    nama_jabatan_permenpan: namaJabatanPermenpan,
    jabatan_orb: jabatanOrb,
    pangkat_golongan: pangkatGolongan,
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
  const h = (header || []).map(normalizePegawaiHeader);
  const idxId = h.indexOf('id');
  const idxNip = h.indexOf('nip');
  const idxNik = h.indexOf('nik');
  return rows.findIndex(r => {
    const idVal = (idxId >= 0 ? r[idxId] : '')?.toString?.() || '';
    const nipVal = (idxNip >= 0 ? r[idxNip] : '')?.toString?.() || '';
    const nikVal = (idxNik >= 0 ? r[idxNik] : '')?.toString?.() || '';
    return (idVal && idVal === id) || (nipVal && nipVal === id) || (nikVal && nikVal === id);
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

function getAction(e) {
  const params = e?.parameter || {};
  const body = e?.body || parseBody(e) || {};
  return String(params.action || body.action || '').toLowerCase().trim();
}

function parseBody(e) {
  if (!e?.postData?.contents) return {};
  try { return JSON.parse(e.postData.contents); }
  catch (err) { return {}; }
}

function checkApiKey(e) {
  return checkToken(e);
}

function checkToken(e) {
  if (!API_KEY) return false;
  const body = e.body || parseBody(e) || {};
  const key = (e?.parameter?.key || body.key || '').toString().trim();
  return key && key === API_KEY;
}

function json(obj, _status) {
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function forbidden() { return json({ ok: false, error: 'forbidden' }); }
