import express from 'express';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import process from 'process';

const PORT = process.env.PORT || 5000;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1Bjz0kVWodHQUr0O9FiVPd7Z9LrQVY4GG6nZiczlv_Vw';
const RANGE = process.env.RANGE || 'DATA PEGAWAI!A:AB'; // 28 kolom
const USER_RANGE = process.env.USER_RANGE || 'username!A:D'; // Nama UKPD | Username | password | hak akses
const SHEET_NAME = RANGE.split('!')[0];

const COLS = [
  'nama_pegawai','npwp','no_bpjs','nama_jabatan_orb','nama_jabatan_prb','nama_status_aktif','nama_status_rumpun',
  'jenis_kontrak','nip','nik','jenis_kelamin','tmt_kerja_ukpd','tempat_lahir','tanggal_lahir','agama',
  'jenjang_pendidikan','jurusan_pendidikan','no_tlp','email','nama_ukpd','golongan_darah','gelar_depan',
  'gelar_belakang','status_pernikahan','nama_jenis_pegawai','catatan_revisi_biodata','alamat_ktp','alamat_domisili'
];

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
    ['https://www.googleapis.com/auth/spreadsheets']
  );
}

const auth = loadClient();
const sheets = google.sheets({ version: 'v4', auth });
const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true }));

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
    const term = (req.query.search || '').toLowerCase().trim();
    const unit = (req.query.unit || '').toLowerCase().trim();
    const jab = (req.query.jabatan || '').toLowerCase().trim();
    const statuses = (req.query.status || '').split(',').map(s => s.toLowerCase().trim()).filter(Boolean);

    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: RANGE });
    const values = result.data.values || [];
    const [header, ...data] = values;
    const h = header || [];
    let rows = data.map(r => toRecord(h, r));

    rows = rows.filter(r => {
      const matchTerm = !term || [r.nama_pegawai, r.nip, r.nik].some(v => (v || '').toLowerCase().includes(term));
      const matchUnit = !unit || (r.nama_ukpd || '').toLowerCase().trim() === unit;
      const matchJab = !jab || (r.nama_jabatan_orb || '').toLowerCase().includes(jab);
      const matchStatus = statuses.length === 0 || statuses.includes((r.nama_status_aktif || '').toLowerCase().trim());
      return matchTerm && matchUnit && matchJab && matchStatus;
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
      range: `${SHEET_NAME}!A${rowNumber}:AB${rowNumber}`,
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
  const { username, password } = req.body || {};
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
    const users = data.map(r => ({
      namaUkpd: (idxNamaUkpd >= 0 ? r[idxNamaUkpd] : r[0] || '').trim(),
      username: (idxUser >= 0 ? r[idxUser] : r[1] || r[0] || '').trim(),
      password: (idxPass >= 0 ? r[idxPass] : r[2] || '').trim(),
      role: (idxHak >= 0 ? r[idxHak] : r[3] || '').trim(),
    }));
    const uname = username.trim().toLowerCase();
    const pword = password.trim();
    const found = users.find(u => u.username.toLowerCase() === uname && u.password === pword);
    if (found) return res.json({ ok: true, user: { username: found.username, role: found.role, namaUkpd: found.namaUkpd } });
    return res.status(401).json({ ok: false, error: 'Username atau password salah' });
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

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
