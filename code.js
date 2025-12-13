// Konfigurasi
const SPREADSHEET_ID = '1Bjz0kVWodHQUr0O9FiVPd7Z9LrQVY4GG6nZiczlv_Vw';
const DATA_SHEET = 'DATA PEGAWAI';
const USER_SHEET = 'username'; // kolom: Nama UKPD | Username | Password | Hak akses | Wilayah
// Urutan kolom data pegawai (A:AC) termasuk wilayah_ukpd
const COLS = [
  'nama_pegawai','npwp','no_bpjs','nama_jabatan_orb','nama_jabatan_prb','nama_status_aktif','nama_status_rumpun',
  'jenis_kontrak','nip','nik','jenis_kelamin','tmt_kerja_ukpd','tempat_lahir','tanggal_lahir','agama',
  'jenjang_pendidikan','jurusan_pendidikan','no_tlp','email','nama_ukpd','wilayah_ukpd','golongan_darah','gelar_depan',
  'gelar_belakang','status_pernikahan','nama_jenis_pegawai','catatan_revisi_biodata','alamat_ktp','alamat_domisili'
];
// Opsional: pakai token sederhana di header x-api-key atau query ?token=
const API_TOKEN = 'ganti_token_aman';

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
  if (root === 'pegawai') {
    if (method === 'GET') return listPegawai(e);
    if (method === 'POST') return createPegawai(e);
    if (method === 'PUT') return updatePegawai(e, id);
    if (method === 'DELETE') return deletePegawai(e, id);
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

// ==== Helpers ====
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

function countStatus(rows) {
  return rows.reduce((acc, r) => {
    const k = (r.nama_status_aktif || 'LAINNYA').toUpperCase();
    acc[k] = (acc[k] || 0) + 1;
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
