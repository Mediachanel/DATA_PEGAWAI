import express from 'express';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { Readable } from 'stream';

const PORT = process.env.PORT || 5002;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1Bjz0kVWodHQUr0O9FiVPd7Z9LrQVY4GG6nZiczlv_Vw';
const RANGE = process.env.RANGE || 'DATA PEGAWAI!A:AC'; // 29 kolom (tambah wilayah_ukpd)
const USER_RANGE = process.env.USER_RANGE || 'username!A:E'; // Nama UKPD | Username | password | hak akses | wilayah
const SHEET_NAME = RANGE.split('!')[0];
const WEB_APP_BASE = process.env.WEB_APP_BASE || 'https://script.google.com/macros/s/AKfycbxpYfK6Q2_GQzMM0_sTD7ts_SMz2z8aMa-pDd_WfGfuCLagwxf-UjNJDyV1TTLIk0AKxQ/exec';
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID || '1KwmIGbrz8KQ40PveoB6wY7wl7u_vOpbR'; // default folder for berkas upload

const COLS = [
  'nama_pegawai','npwp','no_bpjs','nama_jabatan_orb','nama_jabatan_prb','nama_status_aktif','nama_status_rumpun',
  'jenis_kontrak','nip','nik','jenis_kelamin','tmt_kerja_ukpd','tempat_lahir','tanggal_lahir','agama',
  'jenjang_pendidikan','jurusan_pendidikan','no_tlp','email','nama_ukpd','wilayah_ukpd','golongan_darah','gelar_depan',
  'gelar_belakang','status_pernikahan','nama_jenis_pegawai','catatan_revisi_biodata','alamat_ktp','alamat_domisili'
];
const MUTASI_RANGE = process.env.MUTASI_RANGE || 'USULAN_MUTASI!A:AC'; // 29 kolom (format baru)
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
const PEMUTUSAN_RANGE = process.env.PEMUTUSAN_RANGE || 'USULAN_PEMUTUSAN_JF!A:U';
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
const BEZETTING_RANGE = process.env.BEZETTING_RANGE || 'bezetting!A:W';
const BEZETTING_COLS = [
  'no','bidang','subbidang','nama_jabatan_pergub','nama_jabatan_permenpan','rumpun_jabatan','kode',
  'abk','eksisting','selisih','nama_pegawai','nip','nrk','status_formasi','pendidikan','keterangan',
  'sisa_formasi_2026','kebutuhan_asn_2026','perencanaan_kebutuhan','program_studi','perencanaan_pendidikan_lanjutan',
  'ukpd','wilayah'
];

const norm = (val = '') => (val || '').toString().trim().toLowerCase();
const normalizeHeaderKey = (val = '') => val.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');

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
  if (idx >= 0 && typeof row[idx] !== 'undefined') return row[idx] || '';
  if (typeof fallbackIdx === 'number' && typeof row[fallbackIdx] !== 'undefined') return row[fallbackIdx] || '';
  return '';
}

function buildMutasiRow(header, rowData) {
  const safeHeader = header && header.length ? header : MUTASI_COLS;
  const headerIndex = buildHeaderIndex(safeHeader);
  const row = new Array(safeHeader.length).fill('');
  Object.keys(MUTASI_HEADER_MAP).forEach((key) => {
    const idx = findHeaderIndex(headerIndex, MUTASI_HEADER_MAP[key]);
    if (idx >= 0) row[idx] = rowData[key] || '';
  });
  return row;
}

function applyMutasiRow(row, header, rowData) {
  const safeHeader = header && header.length ? header : MUTASI_COLS;
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
  if (idx >= 0 && typeof row[idx] !== 'undefined') return row[idx] || '';
  if (typeof fallbackIdx === 'number' && typeof row[fallbackIdx] !== 'undefined') return row[fallbackIdx] || '';
  return '';
}

function buildPemutusanRow(header, rowData) {
  const safeHeader = header && header.length ? header : PEMUTUSAN_COLS;
  const headerIndex = buildHeaderIndex(safeHeader);
  const row = new Array(safeHeader.length).fill('');
  Object.keys(PEMUTUSAN_HEADER_MAP).forEach((key) => {
    const idx = findHeaderIndex(headerIndex, PEMUTUSAN_HEADER_MAP[key]);
    if (idx >= 0) row[idx] = rowData[key] || '';
  });
  return row;
}

function applyPemutusanRow(row, header, rowData) {
  const safeHeader = header && header.length ? header : PEMUTUSAN_COLS;
  const headerIndex = buildHeaderIndex(safeHeader);
  const next = row.slice();
  Object.keys(PEMUTUSAN_HEADER_MAP).forEach((key) => {
    const idx = findHeaderIndex(headerIndex, PEMUTUSAN_HEADER_MAP[key]);
    if (idx >= 0) next[idx] = rowData[key] || '';
  });
  return next;
}

function columnIndexToLetter(col) {
  let temp = col;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
}

async function getUkpdWilayahMap() {
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: USER_RANGE });
  const values = result.data.values || [];
  const [header, ...rows] = values;
  const h = (header || []).map(x => norm(x));
  const idxUkpd = h.indexOf('nama ukpd');
  const idxWil = h.indexOf('wilayah');
  const map = {};
  rows.forEach(r => {
    const ukpd = idxUkpd >= 0 ? norm(r[idxUkpd]) : norm(r[0]);
    const wil = idxWil >= 0 ? norm(r[idxWil]) : '';
    if (ukpd && wil) map[ukpd] = wil;
  });
  return map;
}

function defaultKeyPath() {
  if (process.env.SERVICE_ACCOUNT_PATH) return process.env.SERVICE_ACCOUNT_PATH;
  const cwd = process.cwd();
  const files = fs.readdirSync(cwd).filter(f => f.endsWith('.json'));
  const candidate = files.find(f => f.toLowerCase().includes('update-bezetting')) || 'service-account.json';
  return path.join(cwd, candidate);
}

const SERVICE_ACCOUNT_PATH = defaultKeyPath();

function loadClient() {
  const keyJson = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
  const key = JSON.parse(keyJson);
  return new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ]
  );
}

const auth = loadClient();
const sheets = google.sheets({ version: 'v4', auth });
const drive = google.drive({ version: 'v3', auth });
const app = express();
const fetchFn = (...args) => (global.fetch ? global.fetch(...args) : import('node-fetch').then(({ default: f }) => f(...args)));
// perbesar batas body untuk upload base64
app.use(express.text({ type: 'text/plain', limit: '20mb' }));
app.use(express.json({ limit: '20mb' }));
app.use((req, _res, next) => {
  if (typeof req.body === 'string') {
    try { req.body = JSON.parse(req.body); } catch (_) { /* keep as string */ }
  }
  next();
});

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Proxy-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});


// Action router for action-based frontend
function buildQueryParams(query, omitKeys = []) {
  const params = new URLSearchParams();
  if (!query) return '';
  Object.entries(query).forEach(([key, value]) => {
    if (omitKeys.includes(key)) return;
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== '') params.append(key, String(item));
      });
      return;
    }
    params.append(key, String(value));
  });
  return params.toString();
}

async function forwardTo(url, opts, res) {
  try {
    const upstream = await fetchFn(url, opts);
    const text = await upstream.text();
    const respCt = upstream.headers.get('content-type');
    if (respCt) res.setHeader('Content-Type', respCt);
    return res.status(upstream.status).send(text);
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'proxy error: ' + err.message });
  }
}

app.all('/', async (req, res) => {
  const action = (req.query?.action || req.body?.action || '').toString().trim().toLowerCase();
  if (!action) return res.status(400).json({ ok: false, error: 'action wajib' });

  if (action === 'health') return res.json({ ok: true });

  const payload = typeof req.body === 'object' && req.body ? { ...req.body } : {};
  delete payload.action;

  const baseUrl = `http://127.0.0.1:${PORT}`;
  const headers = { 'Content-Type': 'application/json' };

  switch (action) {
    case 'list': {
      const qs = buildQueryParams(req.query, ['action']);
      const url = `${baseUrl}/pegawai${qs ? `?${qs}` : ''}`;
      return forwardTo(url, { method: 'GET', headers }, res);
    }
    case 'get': {
      const id = (req.query?.id || payload.id || payload.nip || payload.nik || '').toString().trim();
      if (!id) return res.status(400).json({ ok: false, error: 'ID wajib' });
      return forwardTo(`${baseUrl}/pegawai/${encodeURIComponent(id)}`, { method: 'GET', headers }, res);
    }
    case 'create': {
      return forwardTo(`${baseUrl}/pegawai`, { method: 'POST', headers, body: JSON.stringify(payload) }, res);
    }
    case 'update': {
      const id = (req.query?.id || payload.id || payload.nip || payload.nik || '').toString().trim();
      if (!id) return res.status(400).json({ ok: false, error: 'ID wajib' });
      return forwardTo(`${baseUrl}/pegawai/${encodeURIComponent(id)}`, { method: 'PUT', headers, body: JSON.stringify(payload) }, res);
    }
    case 'delete': {
      const id = (req.query?.id || payload.id || payload.nip || payload.nik || '').toString().trim();
      if (!id) return res.status(400).json({ ok: false, error: 'ID wajib' });
      return forwardTo(`${baseUrl}/pegawai/${encodeURIComponent(id)}`, { method: 'DELETE', headers }, res);
    }
    case 'login': {
      return forwardTo(`${baseUrl}/login`, { method: 'POST', headers, body: JSON.stringify(payload) }, res);
    }
    case 'upload': {
      return forwardTo(`${baseUrl}/upload`, { method: 'POST', headers, body: JSON.stringify(payload) }, res);
    }
    case 'mutasi_list': {
      const qs = buildQueryParams(req.query, ['action']);
      const url = `${baseUrl}/mutasi${qs ? `?${qs}` : ''}`;
      return forwardTo(url, { method: 'GET', headers }, res);
    }
    case 'mutasi_create': {
      return forwardTo(`${baseUrl}/mutasi`, { method: 'POST', headers, body: JSON.stringify(payload) }, res);
    }
    case 'mutasi_update': {
      const id = (req.query?.id || payload.id || '').toString().trim();
      if (!id) return res.status(400).json({ ok: false, error: 'ID mutasi wajib' });
      return forwardTo(`${baseUrl}/mutasi/${encodeURIComponent(id)}`, { method: 'PUT', headers, body: JSON.stringify(payload) }, res);
    }
    case 'mutasi_delete': {
      const id = (req.query?.id || payload.id || '').toString().trim();
      if (!id) return res.status(400).json({ ok: false, error: 'ID mutasi wajib' });
      return forwardTo(`${baseUrl}/mutasi/${encodeURIComponent(id)}`, { method: 'DELETE', headers }, res);
    }
    case 'pemutusan_jf_list': {
      const qs = buildQueryParams(req.query, ['action']);
      const url = `${baseUrl}/pemutusan-jf${qs ? `?${qs}` : ''}`;
      return forwardTo(url, { method: 'GET', headers }, res);
    }
    case 'pemutusan_jf_create': {
      return forwardTo(`${baseUrl}/pemutusan-jf`, { method: 'POST', headers, body: JSON.stringify(payload) }, res);
    }
    case 'pemutusan_jf_update': {
      const id = (req.query?.id || payload.id || payload.id_usulan || '').toString().trim();
      if (!id) return res.status(400).json({ ok: false, error: 'ID wajib' });
      return forwardTo(`${baseUrl}/pemutusan-jf/${encodeURIComponent(id)}`, { method: 'PUT', headers, body: JSON.stringify(payload) }, res);
    }
    case 'pemutusan_jf_delete': {
      const id = (req.query?.id || payload.id || payload.id_usulan || '').toString().trim();
      if (!id) return res.status(400).json({ ok: false, error: 'ID wajib' });
      return forwardTo(`${baseUrl}/pemutusan-jf/${encodeURIComponent(id)}`, { method: 'DELETE', headers }, res);
    }
    case 'bezetting_list': {
      const qs = buildQueryParams(req.query, ['action']);
      const url = `${baseUrl}/bezetting${qs ? `?${qs}` : ''}`;
      return forwardTo(url, { method: 'GET', headers }, res);
    }
    case 'bezetting_create': {
      return forwardTo(`${baseUrl}/bezetting`, { method: 'POST', headers, body: JSON.stringify(payload) }, res);
    }
    case 'bezetting_update': {
      const kode = (req.query?.kode || payload.kode || '').toString().trim();
      if (!kode) return res.status(400).json({ ok: false, error: 'Kode wajib' });
      return forwardTo(`${baseUrl}/bezetting/${encodeURIComponent(kode)}`, { method: 'PUT', headers, body: JSON.stringify(payload) }, res);
    }
    case 'bezetting_delete': {
      const kode = (req.query?.kode || payload.kode || '').toString().trim();
      if (!kode) return res.status(400).json({ ok: false, error: 'Kode wajib' });
      return forwardTo(`${baseUrl}/bezetting/${encodeURIComponent(kode)}`, { method: 'DELETE', headers }, res);
    }
    default:
      return res.status(404).json({ ok: false, error: 'route not found' });
  }
});


// Proxy ke Apps Script Web App untuk menghindari CORS di browser
app.all('/api/*', async (req, res) => {
  const path = req.originalUrl.replace(/^\/api/, '');
  const targetUrl = `${WEB_APP_BASE}${path}`;
  try {
    const headers = {};
    const ct = req.headers['content-type'];
    if (ct) headers['Content-Type'] = ct;
    const opts = { method: req.method, headers, redirect: 'follow' };
    if (!['GET', 'HEAD'].includes(req.method)) {
      const bodyPayload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      opts.body = bodyPayload;
    }
    const upstream = await fetchFn(targetUrl, opts);
    const text = await upstream.text();
    res.setHeader('Access-Control-Allow-Origin', '*');
    const respCt = upstream.headers.get('content-type');
    if (respCt) res.setHeader('Content-Type', respCt);
    return res.status(upstream.status).send(text);
  } catch (err) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(502).json({ ok: false, error: 'proxy error: ' + err.message });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/upload', async (req, res) => {
  try {
    const { filename, mimeType, dataBase64 } = req.body || {};
    if (!filename || !dataBase64) return res.status(400).json({ ok:false, error:'filename dan dataBase64 wajib' });
    const buffer = Buffer.from(dataBase64, 'base64');
    const resource = { name: filename };
    if (DRIVE_FOLDER_ID) resource.parents = [DRIVE_FOLDER_ID];
    const media = { mimeType: mimeType || 'application/octet-stream', body: Readable.from(buffer) };
    const fileResp = await drive.files.create({
      resource,
      media,
      fields: 'id, webViewLink, webContentLink'
    });
    const fileId = fileResp.data.id;
    await drive.permissions.create({
      fileId,
      requestBody: { role:'reader', type:'anyone' }
    }).catch(()=>{ /* ignore permission error */ });
    const url = fileResp.data.webViewLink || fileResp.data.webContentLink || '';
    res.json({ ok:true, id:fileId, url });
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message });
  }
});

app.post('/pegawai', async (req, res) => {
  const d = req.body || {};
  const row = COLS.map(k => d[k] || '');
  try {
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });
    res.json({ ok: true, updatedRange: result.data.updates.updatedRange });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/pegawai', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 20000, 30000));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const term = norm(req.query.search);
    const unit = norm(req.query.unit);
    const wilayah = norm(req.query.wilayah);
    const jab = norm(req.query.jabatan);
    const statuses = (req.query.status || '').split(',').map(s => norm(s)).filter(Boolean);

    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: RANGE });
    const values = result.data.values || [];
    const [header, ...data] = values;
    const h = header || [];
    let rows = data.map(r => toRecord(h, r));

    rows = rows.filter(r => {
      const matchTerm = !term || [r.nama_pegawai, r.nip, r.nik].some(v => norm(v).includes(term));
      const unitVal = norm(r.nama_ukpd);
      const matchUnit = !unit || unitVal === unit;
      const matchJab = !jab || norm(r.nama_jabatan_orb).includes(jab);
      const matchStatus = statuses.length === 0 || statuses.includes(norm(r.nama_status_aktif));
      const matchWilayah = !wilayah || norm(r.wilayah_ukpd).includes(wilayah);
      return matchTerm && matchUnit && matchWilayah && matchJab && matchStatus;
    });

    const total = rows.length;
    const summary = countStatus(rows);
    const slice = rows.slice(offset, offset + limit);

    const units = Array.from(new Set(rows.map(r => r.nama_ukpd).filter(Boolean))).sort();
    const jabs = Array.from(new Set(rows.map(r => r.nama_jabatan_orb).filter(Boolean))).sort();
    const statusList = Array.from(new Set(rows.map(r => r.nama_status_aktif).filter(Boolean))).sort();

    res.json({ ok: true, rows: slice, total, summary, units, jabs, statuses: statusList });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


app.get('/pegawai/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: RANGE });
    const values = result.data.values || [];
    if (!values.length) return res.status(404).json({ ok: false, error: 'Data kosong' });
    const [header, ...rows] = values;
    const h = (header || []).map(x => (x || '').toLowerCase().trim());
    const idxId = h.indexOf('id');
    const idxNip = h.indexOf('nip');
    const idxNik = h.indexOf('nik');
    const idx = rows.findIndex(r => {
      const idVal = (idxId >= 0 ? r[idxId] : '') || '';
      const nipVal = (idxNip >= 0 ? r[idxNip] : '') || '';
      const nikVal = (idxNik >= 0 ? r[idxNik] : '') || '';
      return idVal === id || nipVal === id || nikVal === id;
    });
    if (idx < 0) return res.status(404).json({ ok: false, error: 'ID tidak ditemukan' });
    const record = toRecord(header, rows[idx]);
    res.json({ ok: true, data: record });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


app.put('/pegawai/:id', async (req, res) => {
  const id = req.params.id;
  const d = req.body || {};
  try {
    const values = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: RANGE });
    const rows = values.data.values || [];
    const [header, ...data] = rows;
    const h = header || [];
    const idxNip = h.findIndex(x => (x || '').toLowerCase().trim() === 'nip');
    const idxNik = h.findIndex(x => (x || '').toLowerCase().trim() === 'nik');
    const idx = rows.findIndex(r => {
      const nipVal = (idxNip >= 0 ? r[idxNip] : '') || '';
      const nikVal = (idxNik >= 0 ? r[idxNik] : '') || '';
      return nipVal === id || nikVal === id;
    });
    if (idx < 1) return res.status(404).json({ ok: false, error: 'ID (NIP/NIK) tidak ditemukan' });
    const rowNumber = idx + 1; // 1-based
    const payload = COLS.map(k => d[k] || '');
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${rowNumber}:AC${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [payload] }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/pegawai/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const values = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: RANGE });
    const rows = values.data.values || [];
    const header = rows[0] || [];
    const h = header || [];
    const idxNip = h.findIndex(x => (x || '').toLowerCase().trim() === 'nip');
    const idxNik = h.findIndex(x => (x || '').toLowerCase().trim() === 'nik');
    const idx = rows.findIndex(r => {
      const nipVal = (idxNip >= 0 ? r[idxNip] : '') || '';
      const nikVal = (idxNik >= 0 ? r[idxNik] : '') || '';
      return nipVal === id || nikVal === id;
    });
    if (idx < 1) return res.status(404).json({ ok: false, error: 'ID (NIP/NIK) tidak ditemukan' });
    const sheetId = await getSheetIdByName(SHEET_NAME);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 }
          }
        }]
      }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/login', async (req, res) => {
  const bodyPayload = req.body || {};
  const { username, password } = bodyPayload;
  if (!username || !password) return res.status(400).json({ ok: false, error: 'Username dan password wajib' });
  try {
    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: USER_RANGE });
    const values = result.data.values || [];
    const [header, ...data] = values;
    const h = (header || []).map(x => (x || '').toLowerCase());
    const idxNamaUkpd = h.indexOf('nama ukpd');
    const idxUser = h.indexOf('username');
    const idxPass = h.indexOf('password');
    const idxHak = h.indexOf('hak akses');
    const idxWilayah = h.indexOf('wilayah');
    const users = data.map(r => ({
      namaUkpd: (idxNamaUkpd >= 0 ? r[idxNamaUkpd] : r[0] || '').trim(),
      username: (idxUser >= 0 ? r[idxUser] : r[1] || r[0] || '').trim(),
      password: (idxPass >= 0 ? r[idxPass] : r[2] || '').trim(),
      role: (idxHak >= 0 ? r[idxHak] : r[3] || '').trim(),
      wilayah: (idxWilayah >= 0 ? r[idxWilayah] : r[4] || '').trim(),
    }));
    const uname = username.trim().toLowerCase();
    const pword = password.trim();
    const found = users.find(u => u.username.toLowerCase() === uname && u.password === pword);
    if (found) return res.json({ ok: true, user: { username: found.username, role: found.role, namaUkpd: found.namaUkpd, wilayah: found.wilayah } });
    return res.status(401).json({ ok: false, error: 'Username atau password salah' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ==== Usulan Mutasi (sheet USULAN_MUTASI) ==== */
app.get('/mutasi', async (req, res) => {
  try {
    const term = (req.query.search || '').toLowerCase().trim();
    const status = (req.query.status || '').toLowerCase().trim();
    const ukpd = (req.query.ukpd || '').toLowerCase().trim();
    const tujuan = (req.query.tujuan || '').toLowerCase().trim();
    const jenis = (req.query.jenis_mutasi || '').toLowerCase().trim();
    const wilayah = norm(req.query.wilayah);

    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: MUTASI_RANGE });
    const values = result.data.values || [];
    const [header, ...rows] = values;
    const ukpdWilayahMap = await getUkpdWilayahMap();
    const list = rows.map(r => {
      const rec = toMutasiRecord(header, r);
      const ukpdAsal = norm(rec.nama_ukpd);
      const ukpdTujuan = norm(rec.ukpd_tujuan);
      if (!rec.wilayah_asal) rec.wilayah_asal = ukpdWilayahMap[ukpdAsal] || '';
      if (!rec.wilayah_tujuan) rec.wilayah_tujuan = ukpdWilayahMap[ukpdTujuan] || '';
      return rec;
    }).filter(r => r.id);

    const baseFiltered = list.filter(r => {
      const matchTerm = !term || [r.nip, r.nama_pegawai].some(v => (v || '').toLowerCase().includes(term));
      const matchStatus = !status || (r.status || '').toLowerCase() === status;
      const matchUkpd = !ukpd || (r.nama_ukpd || '').toLowerCase() === ukpd;
      const matchTujuan = !tujuan || (r.ukpd_tujuan || '').toLowerCase() === tujuan;
      const matchJenis = !jenis || (r.jenis_mutasi || '').toLowerCase() === jenis;
      return matchTerm && matchStatus && matchUkpd && matchTujuan && matchJenis;
    });

    let filtered = baseFiltered;
    if (wilayah) {
      filtered = filtered.filter(r => {
        const wasal = norm(r.wilayah_asal);
        const wtujuan = norm(r.wilayah_tujuan);
        return wasal === wilayah || wtujuan === wilayah;
      });
    }

    const summary = filtered.reduce((acc, r) => {
      const k = (r.status || 'LAINNYA').toUpperCase();
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const statuses = Array.from(new Set(filtered.map(r => r.status).filter(Boolean))).sort();
    const ukpds = Array.from(new Set(filtered.map(r => r.nama_ukpd).filter(Boolean))).sort();
    const tujuanList = Array.from(new Set(filtered.map(r => r.ukpd_tujuan).filter(Boolean))).sort();
    const jenisList = Array.from(new Set(filtered.map(r => r.jenis_mutasi).filter(Boolean))).sort();

    res.json({ ok: true, rows: filtered, total: filtered.length, summary, statuses, ukpds, tujuan: tujuanList, jenis: jenisList });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/mutasi/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: MUTASI_RANGE });
    const values = result.data.values || [];
    const [header, ...rows] = values;
    const list = rows.map(r => toMutasiRecord(header, r));
    const found = list.find(r => r.id === id);
    if (!found) return res.status(404).json({ ok: false, error: 'ID mutasi tidak ditemukan' });
    res.json({ ok: true, data: found });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/mutasi', async (req, res) => {
  try {
    const d = req.body || {};
    const id = d.id || `UM-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const rowData = {
      ...d,
      id,
      tanggal_usulan: d.tanggal_usulan || nowIso.slice(0, 10),
      created_at: d.created_at || nowIso,
      updated_at: d.updated_at || nowIso
    };
    const sheetName = MUTASI_RANGE.split('!')[0];
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!1:1`
    });
    const header = (headerRes.data.values && headerRes.data.values[0] && headerRes.data.values[0].length)
      ? headerRes.data.values[0]
      : MUTASI_COLS;
    const row = buildMutasiRow(header, rowData);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.put('/mutasi/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const values = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: MUTASI_RANGE });
    const rows = values.data.values || [];
    const [header, ...data] = rows;
    const safeHeader = header && header.length ? header : MUTASI_COLS;
    const idx = data.findIndex(r => (r[0] || '').toString() === id);
    if (idx < 0) return res.status(404).json({ ok: false, error: 'ID mutasi tidak ditemukan' });
    const rowNumber = idx + 2; // +1 header
    const currentRow = data[idx] || [];
    const current = toMutasiRecord(safeHeader, currentRow);
    const payloadData = { ...current, ...(req.body || {}), id };
    if (!payloadData.updated_at) payloadData.updated_at = new Date().toISOString();
    const baseRow = currentRow.slice();
    while (baseRow.length < safeHeader.length) baseRow.push('');
    const payload = applyMutasiRow(baseRow, safeHeader, payloadData);
    const sheetName = MUTASI_RANGE.split('!')[0];
    const endCol = columnIndexToLetter(safeHeader.length);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A${rowNumber}:${endCol}${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [payload] }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/mutasi/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const values = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: MUTASI_RANGE });
    const rows = values.data.values || [];
    const idx = rows.findIndex(r => (r[0] || '').toString() === id);
    if (idx < 1) return res.status(404).json({ ok: false, error: 'ID mutasi tidak ditemukan' });
    const sheetId = await getSheetIdByName(MUTASI_RANGE.split('!')[0]);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 }
          }
        }]
      }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ==== Usulan Pemutusan JF (sheet USULAN_PEMUTUSAN_JF) ==== */
app.get('/pemutusan-jf', async (req, res) => {
  try {
    const term = norm(req.query.search);
    const status = norm(req.query.status);
    const ukpdQuery = norm(req.query.ukpd);
    const wilayahQuery = norm(req.query.wilayah);

    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: PEMUTUSAN_RANGE });
    const values = result.data.values || [];
    const [header, ...rows] = values;
    let list = rows.map(r => toPemutusanRecord(header, r)).filter(r => r.id);

    let mapWilayah = null;
    if (wilayahQuery) {
      mapWilayah = await getUkpdWilayahMap(); // { ukpd_lower: wilayah_lower }
    }

    list = list.filter(r => {
      const matchTerm = !term || [r.nama_pegawai, r.nip].some(v => (v || '').toLowerCase().includes(term));
      const matchStatus = !status || norm(r.status) === status;
      const ukVal = norm(r.nama_ukpd);
      const matchUkpd = !ukpdQuery || ukVal === ukpdQuery;
      const matchWilayah = !wilayahQuery || (mapWilayah && mapWilayah[ukVal] === wilayahQuery);
      return matchTerm && matchStatus && matchUkpd && matchWilayah;
    });

    const summary = list.reduce((acc, r) => {
      const k = (r.status || 'LAINNYA').toUpperCase();
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const statuses = Array.from(new Set(list.map(r => r.status).filter(Boolean))).sort();
    const ukpds = Array.from(new Set(list.map(r => r.nama_ukpd).filter(Boolean))).sort();

    res.json({ ok: true, rows: list, total: list.length, summary, statuses, ukpds });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/pemutusan-jf', async (req, res) => {
  try {
    const d = req.body || {};
    const id = d.id || `PJ-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const rowData = {
      ...d,
      id,
      tanggal_usulan: d.tanggal_usulan || nowIso,
      created_at: d.created_at || nowIso,
      updated_at: d.updated_at || nowIso
    };
    const sheetName = PEMUTUSAN_RANGE.split('!')[0];
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!1:1`
    });
    const header = (headerRes.data.values && headerRes.data.values[0] && headerRes.data.values[0].length)
      ? headerRes.data.values[0]
      : PEMUTUSAN_COLS;
    const row = buildPemutusanRow(header, rowData);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.put('/pemutusan-jf/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const values = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: PEMUTUSAN_RANGE });
    const rows = values.data.values || [];
    const [header, ...data] = rows;
    const safeHeader = header && header.length ? header : PEMUTUSAN_COLS;
    const idx = data.findIndex(r => (r[0] || '').toString() === id);
    if (idx < 0) return res.status(404).json({ ok: false, error: 'ID tidak ditemukan' });
    const rowNumber = idx + 2; // +1 header
    const currentRow = data[idx] || [];
    const current = toPemutusanRecord(safeHeader, currentRow);
    const dataPayload = { ...current, ...(req.body || {}), id };
    if (!dataPayload.updated_at) dataPayload.updated_at = new Date().toISOString();
    const baseRow = currentRow.slice();
    while (baseRow.length < safeHeader.length) baseRow.push('');
    const payload = applyPemutusanRow(baseRow, safeHeader, dataPayload);
    const sheetName = PEMUTUSAN_RANGE.split('!')[0];
    const endCol = columnIndexToLetter(safeHeader.length);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A${rowNumber}:${endCol}${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [payload] }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/pemutusan-jf/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const values = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: PEMUTUSAN_RANGE });
    const rows = values.data.values || [];
    const idx = rows.findIndex(r => (r[0] || '').toString() === id);
    if (idx < 1) return res.status(404).json({ ok: false, error: 'ID tidak ditemukan' });
    const sheetId = await getSheetIdByName(PEMUTUSAN_RANGE.split('!')[0]);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 } }
        }]
      }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ==== Bezetting (sheet bezetting) ==== */
app.get('/bezetting', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 20000, 30000));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const term = norm(req.query.search);
    const ukpdQuery = norm(req.query.ukpd);
    const wilayahQuery = norm(req.query.wilayah);
    const statusQuery = norm(req.query.status_formasi);
    const rumpunQuery = norm(req.query.rumpun);
    const jabatanQuery = norm(req.query.jabatan);

    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: BEZETTING_RANGE });
    const values = result.data.values || [];
    const [header, ...rowsRaw] = values;
    let list = rowsRaw.map(r => toBezettingRecord(header, r)).filter(r => r.kode || r.no);

    // Role filter
    const matchWilayah = (value, query) => {
      if (!query) return true;
      const v = norm(value);
      return v === query || v.includes(query) || query.includes(v);
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
      const jabNorm = jabatanQuery;
      const matchJab = !jabNorm || norm(r.nama_jabatan_pergub) === jabNorm || norm(r.nama_jabatan_permenpan) === jabNorm;
      return matchTerm && matchStatus && matchRumpun && matchJab;
    });

    const total = list.length;
    const slice = list.slice(offset, offset + limit);
    const ukpds = Array.from(new Set(list.map(r => r.ukpd).filter(Boolean))).sort();
    const statuses = Array.from(new Set(list.map(r => r.status_formasi).filter(Boolean))).sort();
    const rumpuns = Array.from(new Set(list.map(r => r.rumpun_jabatan).filter(Boolean))).sort();
    const jabatans = Array.from(new Set(list.flatMap(r => [r.nama_jabatan_pergub, r.nama_jabatan_permenpan]).filter(Boolean))).sort();
    res.json({ ok: true, rows: slice, total, ukpds, statuses, rumpuns, jabatans });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/bezetting', async (req, res) => {
  try {
    const d = req.body || {};
    const kode = d.kode || `BZ-${Date.now()}`;
    const payloadData = { ...d, kode };
    const row = BEZETTING_COLS.map(k => payloadData[k] || '');
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: BEZETTING_RANGE,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });
    res.json({ ok: true, kode });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.put('/bezetting/:kode', async (req, res) => {
  const kode = req.params.kode;
  try {
    const values = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: BEZETTING_RANGE });
    const rows = values.data.values || [];
    const [header, ...data] = rows;
    const hNorm = (header || []).map(x => norm(x));
    const idxKode = hNorm.indexOf('kode');
    const idx = data.findIndex(r => norm(idxKode >= 0 ? r[idxKode] : r[6]) === norm(kode));
    if (idx < 0) return res.status(404).json({ ok: false, error: 'Kode tidak ditemukan' });
    const rowNumber = idx + 2;
    const payloadData = { ...(req.body || {}), kode };
    const payload = BEZETTING_COLS.map(k => payloadData[k] || '');
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${BEZETTING_RANGE.split('!')[0]}!A${rowNumber}:W${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [payload] }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/bezetting/:kode', async (req, res) => {
  const kode = req.params.kode;
  try {
    const values = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: BEZETTING_RANGE });
    const rows = values.data.values || [];
    const header = rows[0] || [];
    const hNorm = (header || []).map(x => norm(x));
    const idxKode = hNorm.indexOf('kode');
    const idx = rows.findIndex(r => norm(idxKode >= 0 ? r[idxKode] : r[6]) === norm(kode));
    if (idx < 1) return res.status(404).json({ ok: false, error: 'Kode tidak ditemukan' });
    const sheetId = await getSheetIdByName(BEZETTING_RANGE.split('!')[0]);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 } }
        }]
      }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

function toRecord(header, row) {
  const h = (header || []).map(x => (x || '').toLowerCase().trim());
  const get = (name, fallbackIdx) => {
    const idx = h.indexOf(name);
    if (idx >= 0 && typeof row[idx] !== 'undefined') return row[idx] || '';
    if (typeof fallbackIdx === 'number' && typeof row[fallbackIdx] !== 'undefined') return row[fallbackIdx] || '';
    return '';
  };
  const pangkatGolongan = get('pangkat_golongan')
    || get('pangkat/golongan')
    || get('pangkat golongan')
    || get('pangkat/gol')
    || get('pangkat');
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
    golongan_darah: get('golongan_darah', 20),
    pangkat_golongan: pangkatGolongan,
    gelar_depan: get('gelar_depan', 21),
    gelar_belakang: get('gelar_belakang', 22),
    status_pernikahan: get('status_pernikahan', 23),
    nama_jenis_pegawai: get('nama_jenis_pegawai', 24),
    catatan_revisi_biodata: get('catatan_revisi_biodata', 25),
    alamat_ktp: get('alamat_ktp', 26),
    alamat_domisili: get('alamat_domisili', 27),
    wilayah_ukpd: get('wilayah_ukpd', 20),
    unit: get('nama_ukpd', 19),
    jabatan: get('nama_jabatan_orb', 3),
    statusKaryawan: get('nama_status_aktif', 5),
    aktif: get('nama_status_aktif', 5)
  };
}

function countStatus(rows) {
  return rows.reduce((acc, r) => {
    const k = (r.nama_status_aktif || 'LAINNYA').toUpperCase();
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

async function getSheetIdByName(name) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets?.find(s => s.properties?.title === name);
  if (!sheet) throw new Error(`Sheet ${name} tidak ditemukan`);
  return sheet.properties.sheetId;
}

function toMutasiRecord(header, row){
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

function toPemutusanRecord(header, row){
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

function toBezettingRecord(header, row){
  const h = (header || []).map(x => (x || '').toLowerCase().trim());
  const get = (name, idxFallback) => {
    const idx = h.indexOf(name);
    if (idx >= 0 && typeof row[idx] !== 'undefined') return row[idx] || '';
    if (typeof idxFallback === 'number' && typeof row[idxFallback] !== 'undefined') return row[idxFallback] || '';
    return '';
  };
  const namaJabatanPergub = get('nama jabatan (pergub 1)',3);
  const namaJabatanPermenpan = get('nama jabatan (permenpan)',4);
  const jabatanOrb = get('jabatan orb') || get('nama jabatan orb') || get('jabatan (orb)') || get('nama jabatan (orb)') || namaJabatanPergub || namaJabatanPermenpan;
  const pangkatGolongan = get('pangkat/golongan') || get('pangkat golongan') || get('pangkat_golongan') || get('pangkat/gol') || get('pangkat');
  return {
    no: get('no',0),
    bidang: get('bidang/bagian',1),
    subbidang: get('subbidang/subbagian/satuan pelaksana',2),
    nama_jabatan_pergub: namaJabatanPergub,
    nama_jabatan_permenpan: namaJabatanPermenpan,
    jabatan_orb: jabatanOrb,
    pangkat_golongan: pangkatGolongan,
    rumpun_jabatan: get('rumpun jabatan (sesuai peta pergub 1)',5),
    kode: get('kode',6),
    abk: get('abk',7),
    eksisting: get('eksisting',8),
    selisih: get('selisih',9),
    nama_pegawai: get('nama pegawai',10),
    nip: get('nip',11),
    nrk: get('nrk',12),
    status_formasi: get('status formasi',13),
    pendidikan: get('pendidikan',14),
    keterangan: get('keterangan',15),
    sisa_formasi_2026: get('sisa formasi proyeksi 2026',16),
    kebutuhan_asn_2026: get('kebutuhan asn 2026',17),
    perencanaan_kebutuhan: get('perencanaan kebutuhan',18),
    program_studi: get('program studi',19),
    perencanaan_pendidikan_lanjutan: get('perencanaan pendidikan lanjutan',20),
    ukpd: get('ukpd',21),
    wilayah: get('wilayah',22)
  };
}

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
