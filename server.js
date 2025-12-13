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
const WEB_APP_BASE = process.env.WEB_APP_BASE || 'https://script.google.com/macros/s/AKfycbxFgN7dWixltKIgVGtURC8H8FtQamzym4Scmd4sjN7-oZMel4b0Gg5aVdKF6iz_XnI66g/exec';
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID || '1KwmIGbrz8KQ40PveoB6wY7wl7u_vOpbR'; // default folder for berkas upload

const COLS = [
  'nama_pegawai','npwp','no_bpjs','nama_jabatan_orb','nama_jabatan_prb','nama_status_aktif','nama_status_rumpun',
  'jenis_kontrak','nip','nik','jenis_kelamin','tmt_kerja_ukpd','tempat_lahir','tanggal_lahir','agama',
  'jenjang_pendidikan','jurusan_pendidikan','no_tlp','email','nama_ukpd','wilayah_ukpd','golongan_darah','gelar_depan',
  'gelar_belakang','status_pernikahan','nama_jenis_pegawai','catatan_revisi_biodata','alamat_ktp','alamat_domisili'
];
const MUTASI_RANGE = process.env.MUTASI_RANGE || 'USULAN_MUTASI!A:Q'; // 17 kolom (tambah berkas_url)
const MUTASI_COLS = [
  'id','nip','nama_pegawai','jabatan_asal','jabatan_baru','nama_ukpd_asal','nama_ukpd_tujuan',
  'jenis_mutasi','alasan','tanggal_usulan','status','keterangan',
  'abk_j_lama','bezetting_j_lama','abk_j_baru','bezetting_j_baru','berkas_url'
];
const PEMUTUSAN_RANGE = process.env.PEMUTUSAN_RANGE || 'USULAN_PEMUTUSAN_JF!A:S';
const PEMUTUSAN_COLS = [
  'id_usulan','status','nama_pegawai','nip','pangkat_gol','jabatan_lama','jabatan_baru','angka_kredit',
  'ukpd','nomor_surat','tanggal_surat','alasan_usulan','link_dokumen',
  'verifikasi_oleh','verifikasi_tanggal','verifikasi_catatan',
  'dibuat_oleh','dibuat_pada','diupdate_pada'
];

const norm = (val = '') => (val || '').toString().trim().toLowerCase();

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
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
    const list = rows.map(r => toMutasiRecord(header, r)).filter(r => r.id);

    const baseFiltered = list.filter(r => {
      const matchTerm = !term || [r.nip, r.nama_pegawai].some(v => (v || '').toLowerCase().includes(term));
      const matchStatus = !status || (r.status || '').toLowerCase() === status;
      const matchUkpd = !ukpd || (r.nama_ukpd_asal || '').toLowerCase() === ukpd;
      const matchTujuan = !tujuan || (r.nama_ukpd_tujuan || '').toLowerCase() === tujuan;
      const matchJenis = !jenis || (r.jenis_mutasi || '').toLowerCase() === jenis;
      return matchTerm && matchStatus && matchUkpd && matchTujuan && matchJenis;
    });

    let filtered = baseFiltered;
    if (wilayah) {
      const ukpdWilayahMap = await getUkpdWilayahMap();
      const allowedUnits = new Set(Object.entries(ukpdWilayahMap).filter(([, w]) => w === wilayah).map(([u]) => u));
      filtered = filtered.filter(r => {
        const asal = norm(r.nama_ukpd_asal);
        const tuj = norm(r.nama_ukpd_tujuan);
        if (allowedUnits.size > 0) {
          return allowedUnits.has(asal) || allowedUnits.has(tuj);
        }
        return asal.includes(wilayah) || tuj.includes(wilayah);
      });
    }

    const summary = filtered.reduce((acc, r) => {
      const k = (r.status || 'LAINNYA').toUpperCase();
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const statuses = Array.from(new Set(filtered.map(r => r.status).filter(Boolean))).sort();
    const ukpds = Array.from(new Set(filtered.map(r => r.nama_ukpd_asal).filter(Boolean))).sort();
    const tujuanList = Array.from(new Set(filtered.map(r => r.nama_ukpd_tujuan).filter(Boolean))).sort();
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
    const row = MUTASI_COLS.map(k => k === 'id' ? id : (d[k] || ''));
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: MUTASI_RANGE,
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
    const idx = data.findIndex(r => (r[0] || '').toString() === id);
    if (idx < 0) return res.status(404).json({ ok: false, error: 'ID mutasi tidak ditemukan' });
    const rowNumber = idx + 2; // +1 header
    const payload = MUTASI_COLS.map(k => k === 'id' ? id : (req.body?.[k] || ''));
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${MUTASI_RANGE.split('!')[0]}!A${rowNumber}:Q${rowNumber}`,
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
    const ukpd = norm(req.query.ukpd);

    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: PEMUTUSAN_RANGE });
    const values = result.data.values || [];
    const [header, ...rows] = values;
    let list = rows.map(r => toPemutusanRecord(header, r)).filter(r => r.id_usulan);

    list = list.filter(r => {
      const matchTerm = !term || [r.nama_pegawai, r.nip].some(v => (v || '').toLowerCase().includes(term));
      const matchStatus = !status || norm(r.status) === status;
      const matchUkpd = !ukpd || norm(r.ukpd) === ukpd;
      return matchTerm && matchStatus && matchUkpd;
    });

    const summary = list.reduce((acc, r) => {
      const k = (r.status || 'LAINNYA').toUpperCase();
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const statuses = Array.from(new Set(list.map(r => r.status).filter(Boolean))).sort();
    const ukpds = Array.from(new Set(list.map(r => r.ukpd).filter(Boolean))).sort();

    res.json({ ok: true, rows: list, total: list.length, summary, statuses, ukpds });
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
  const h = (header || []).map(x => (x || '').toLowerCase().trim());
  const get = (name, idxFallback) => {
    const idx = h.indexOf(name);
    if (idx >= 0 && typeof row[idx] !== 'undefined') return row[idx] || '';
    if (typeof idxFallback === 'number' && typeof row[idxFallback] !== 'undefined') return row[idxFallback] || '';
    return '';
  };
  return {
    id: get('id',0),
    nip: get('nip',1),
    nama_pegawai: get('nama_pegawai',2),
    jabatan_asal: get('jabatan_asal',3),
    jabatan_baru: get('jabatan_baru',4),
    nama_ukpd_asal: get('nama_ukpd_asal',5),
    nama_ukpd_tujuan: get('nama_ukpd_tujuan',6),
    jenis_mutasi: get('jenis_mutasi',7),
    alasan: get('alasan',8),
    tanggal_usulan: get('tanggal_usulan',9),
    status: get('status',10),
    keterangan: get('keterangan',11),
    abk_j_lama: get('abk_j_lama',12),
    bezetting_j_lama: get('bezetting_j_lama',13),
    abk_j_baru: get('abk_j_baru',14),
    bezetting_j_baru: get('bezetting_j_baru',15),
    berkas_url: get('berkas_url',16),
  };
}

function toPemutusanRecord(header, row){
  const h = (header || []).map(x => (x || '').toLowerCase().trim());
  const get = (name, idxFallback) => {
    const idx = h.indexOf(name);
    if (idx >= 0 && typeof row[idx] !== 'undefined') return row[idx] || '';
    if (typeof idxFallback === 'number' && typeof row[idxFallback] !== 'undefined') return row[idxFallback] || '';
    return '';
  };
  return {
    id_usulan: get('id_usulan',0),
    status: get('status',1),
    nama_pegawai: get('nama_pegawai',2),
    nip: get('nip',3),
    pangkat_gol: get('pangkat_gol',4),
    jabatan_lama: get('jabatan_lama',5),
    jabatan_baru: get('jabatan_baru',6),
    angka_kredit: get('angka_kredit',7),
    ukpd: get('ukpd',8),
    nomor_surat: get('nomor_surat',9),
    tanggal_surat: get('tanggal_surat',10),
    alasan_usulan: get('alasan_usulan',11),
    link_dokumen: get('link_dokumen',12),
    verifikasi_oleh: get('verifikasi_oleh',13),
    verifikasi_tanggal: get('verifikasi_tanggal',14),
    verifikasi_catatan: get('verifikasi_catatan',15),
    dibuat_oleh: get('dibuat_oleh',16),
    dibuat_pada: get('dibuat_pada',17),
    diupdate_pada: get('diupdate_pada',18),
  };
}

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
