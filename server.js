import express from 'express';
import { google } from 'googleapis';
import crypto from 'crypto';
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
const MUTASI_RANGE = process.env.MUTASI_RANGE || 'USULAN_MUTASI!A:S'; // 19 kolom (tambah wilayah asal/tujuan)
const MUTASI_COLS = [
  'id','nip','nama_pegawai','jabatan_asal','jabatan_baru','nama_ukpd_asal','nama_ukpd_tujuan',
  'wilayah_asal','wilayah_tujuan',
  'jenis_mutasi','alasan','tanggal_usulan','status','keterangan',
  'abk_j_lama','bezetting_j_lama','abk_j_baru','bezetting_j_baru','berkas_url'
];
const PEMUTUSAN_RANGE = process.env.PEMUTUSAN_RANGE || 'USULAN_PEMUTUSAN_JF!A:T';
const PEMUTUSAN_COLS = [
  'id_usulan','status','nama_pegawai','nip','pangkat_gol','jabatan_lama','jabatan_baru','angka_kredit',
  'ukpd','wilayah','nomor_surat','tanggal_surat','alasan_usulan','link_dokumen',
  'verifikasi_oleh','verifikasi_tanggal','verifikasi_catatan',
  'dibuat_oleh','dibuat_pada','diupdate_pada'
];
const BEZETTING_RANGE = process.env.BEZETTING_RANGE || 'bezetting!A:W';
const BEZETTING_COLS = [
  'no','bidang','subbidang','nama_jabatan_pergub','nama_jabatan_permenpan','rumpun_jabatan','kode',
  'abk','eksisting','selisih','nama_pegawai','nip','nrk','status_formasi','pendidikan','keterangan',
  'sisa_formasi_2026','kebutuhan_asn_2026','perencanaan_kebutuhan','program_studi','perencanaan_pendidikan_lanjutan',
  'ukpd','wilayah'
];
const QNA_RANGE = process.env.QNA_RANGE || 'Q n A!A:G';
const QNA_COLS = ['id','category','question','answer','status','created_at','updated_at'];

const HASH_PREFIX = 'sha256$';
const SESSION_TTL = Math.max(60, parseInt(process.env.SESSION_TTL || '600', 10));
const LIST_CACHE_TTL = Math.max(5, parseInt(process.env.LIST_CACHE_TTL || '20', 10));
const DASHBOARD_CACHE_TTL = Math.max(5, parseInt(process.env.DASHBOARD_CACHE_TTL || '30', 10));
const BEZETTING_CACHE_TTL = Math.max(5, parseInt(process.env.BEZETTING_CACHE_TTL || '60', 10));
const META_CACHE_TTL = Math.max(5, parseInt(process.env.META_CACHE_TTL || '300', 10));

const DASH_STATUS_ORDER = ['PNS','CPNS','PPPK','PROFESIONAL','PJLP'];
const DASH_STATUS_LABELS = { PNS:'PNS', CPNS:'CPNS', PPPK:'PPPK', PROFESIONAL:'PROFESIONAL', PJLP:'PJLP' };
const DASH_STATUS_COLORS = { PNS:'#0EA5E9', CPNS:'#06B6D4', PPPK:'#22C55E', PROFESIONAL:'#14B8A6', PJLP:'#8B5CF6' };

const DASH_GENDER_ORDER = ['LAKI','PEREMPUAN'];
const DASH_GENDER_LABELS = { LAKI:'Laki-laki', PEREMPUAN:'Perempuan' };
const DASH_GENDER_COLORS = { LAKI:'#0EA5E9', PEREMPUAN:'#F97316' };

const DASH_MARITAL_ORDER = ['BELUM_MENIKAH','MENIKAH','CERAI_HIDUP','CERAI_MATI'];
const DASH_MARITAL_LABELS = {
  BELUM_MENIKAH:'Belum Menikah',
  MENIKAH:'Menikah',
  CERAI_HIDUP:'Cerai Hidup',
  CERAI_MATI:'Cerai Mati'
};
const DASH_MARITAL_COLORS = {
  BELUM_MENIKAH:'#0EA5E9',
  MENIKAH:'#22C55E',
  CERAI_HIDUP:'#F97316',
  CERAI_MATI:'#EF4444'
};

const norm = (val = '') => (val || '').toString().trim().toLowerCase();

let cacheVersion = String(Date.now());
const cacheStore = new Map();
const sessions = new Map();
const ukpdMapCache = { value: null, expiresAt: 0 };

function bumpCacheVersion() {
  cacheVersion = String(Date.now());
  cacheStore.clear();
  ukpdMapCache.value = null;
  ukpdMapCache.expiresAt = 0;
}

function shouldBypassCache(params) {
  const p = params || {};
  const noCache = String(p.nocache || '').toLowerCase().trim();
  if (noCache === '1' || noCache === 'true' || noCache === 'yes') return true;
  const cache = String(p.cache || '').toLowerCase().trim();
  if (cache === '0' || cache === 'false' || cache === 'no') return true;
  return false;
}

function sanitizeCacheParams(params) {
  const raw = params || {};
  const clean = {};
  Object.keys(raw).forEach((key) => {
    const lower = String(key || '').toLowerCase();
    if (!lower || lower === 'key' || lower === 'nocache' || lower === 'cache' || lower === 'session') return;
    clean[key] = raw[key];
  });
  return clean;
}

function buildCacheKey(action, params) {
  const safeParams = sanitizeCacheParams(params);
  const keys = Object.keys(safeParams).sort();
  const query = keys.map(k => `${k}=${String(safeParams[k])}`).join('&');
  return `${action}|${cacheVersion}|${query}`;
}

function getCachedResponse(action, params) {
  if (shouldBypassCache(params)) return null;
  const key = buildCacheKey(action, params);
  const cached = cacheStore.get(key);
  if (!cached) return null;
  if (cached.expiresAt && cached.expiresAt <= Date.now()) {
    cacheStore.delete(key);
    return null;
  }
  return cached.value || null;
}

function storeCachedResponse(action, params, value, ttlSeconds) {
  if (shouldBypassCache(params)) return;
  if (!ttlSeconds || ttlSeconds <= 0) return;
  const key = buildCacheKey(action, params);
  cacheStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function generateSessionToken() {
  return crypto.randomBytes(20).toString('hex');
}

function storeSession(token, user) {
  if (!token) return;
  sessions.set(token, { user, expiresAt: Date.now() + SESSION_TTL * 1000 });
}

function readSession(token) {
  if (!token) return null;
  const data = sessions.get(token);
  if (!data) return null;
  if (data.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  data.expiresAt = Date.now() + SESSION_TTL * 1000;
  sessions.set(token, data);
  return data.user || null;
}

function clearSession(token) {
  if (!token) return;
  sessions.delete(token);
}

function getSessionUserFromReq(req) {
  const token = String(req?.query?.session || req?.body?.session || '').trim();
  return readSession(token);
}

function getRoleContext(user) {
  const roleRaw = norm(user?.role || '');
  const isSuper = roleRaw.includes('super') || roleRaw.includes('dinkes');
  const isWilayah = roleRaw.includes('wilayah');
  const ukpd = norm(user?.namaUkpd || user?.username || '');
  const wilayah = norm(user?.wilayah || '');
  return { role: roleRaw, isSuper, isWilayah, ukpd, wilayah };
}

function isHashedPassword(value = '') {
  const raw = String(value || '');
  return raw.indexOf(HASH_PREFIX) === 0 || raw.indexOf('sha256:') === 0;
}

function digestHex(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function hashPassword(password, salt) {
  const safeSalt = salt || crypto.randomBytes(16).toString('hex');
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

async function getUkpdWilayahMap() {
  if (ukpdMapCache.value && ukpdMapCache.expiresAt > Date.now()) return ukpdMapCache.value;
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
  ukpdMapCache.value = map;
  ukpdMapCache.expiresAt = Date.now() + META_CACHE_TTL * 1000;
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

function isPublicQnaRequest(params) {
  const statusParam = norm(params?.status);
  if (!statusParam) return false;
  const statuses = statusParam.split(',').map(norm).filter(Boolean);
  return statuses.length === 1 && statuses[0] === 'published';
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

  const params = Object.assign({}, req.query || {}, (typeof req.body === 'object' && req.body) ? req.body : {});
  const sessionToken = String(params.session || '').trim();
  const isPublicQna = action === 'qna_list' && isPublicQnaRequest(params);
  if (!['login'].includes(action) && !isPublicQna) {
    const sessionUser = readSession(sessionToken);
    if (!sessionUser) return res.status(403).json({ ok: false, error: 'forbidden' });
  }

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
    case 'logout': {
      clearSession(sessionToken);
      return res.json({ ok: true });
    }
    case 'password_change': {
      return forwardTo(`${baseUrl}/password-change`, { method: 'POST', headers, body: JSON.stringify(payload) }, res);
    }
    case 'upload': {
      return forwardTo(`${baseUrl}/upload`, { method: 'POST', headers, body: JSON.stringify(payload) }, res);
    }
    case 'dashboard_stats': {
      const qs = buildQueryParams(req.query, ['action']);
      const url = `${baseUrl}/dashboard-stats${qs ? `?${qs}` : ''}`;
      return forwardTo(url, { method: 'GET', headers }, res);
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
      const id = (req.query?.id_usulan || payload.id_usulan || '').toString().trim();
      if (!id) return res.status(400).json({ ok: false, error: 'ID usulan wajib' });
      return forwardTo(`${baseUrl}/pemutusan-jf/${encodeURIComponent(id)}`, { method: 'PUT', headers, body: JSON.stringify(payload) }, res);
    }
    case 'pemutusan_jf_delete': {
      const id = (req.query?.id_usulan || payload.id_usulan || '').toString().trim();
      if (!id) return res.status(400).json({ ok: false, error: 'ID usulan wajib' });
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
    case 'qna_list': {
      const qs = buildQueryParams(req.query, ['action']);
      const url = `${baseUrl}/qna${qs ? `?${qs}` : ''}`;
      return forwardTo(url, { method: 'GET', headers }, res);
    }
    case 'qna_create': {
      return forwardTo(`${baseUrl}/qna`, { method: 'POST', headers, body: JSON.stringify(payload) }, res);
    }
    case 'qna_update': {
      const id = (req.query?.id || payload.id || '').toString().trim();
      if (!id) return res.status(400).json({ ok: false, error: 'ID QnA wajib' });
      return forwardTo(`${baseUrl}/qna/${encodeURIComponent(id)}`, { method: 'PUT', headers, body: JSON.stringify(payload) }, res);
    }
    case 'qna_delete': {
      const id = (req.query?.id || payload.id || '').toString().trim();
      if (!id) return res.status(400).json({ ok: false, error: 'ID QnA wajib' });
      return forwardTo(`${baseUrl}/qna/${encodeURIComponent(id)}`, { method: 'DELETE', headers }, res);
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
    bumpCacheVersion();
    res.json({ ok: true, updatedRange: result.data.updates.updatedRange });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/pegawai', async (req, res) => {
  try {
    const cached = getCachedResponse('list', req.query);
    if (cached) return res.json(cached);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 20000, 30000));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const term = norm(req.query.search);
    const unit = norm(req.query.unit);
    const wilayah = norm(req.query.wilayah);
    const jab = norm(req.query.jabatan);
    const statuses = (req.query.status || '').split(',').map(s => norm(s)).filter(Boolean);
    const lite = ['1', 'true', 'yes'].includes(norm(req.query.lite));

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
    const summary = lite ? {} : countStatus(rows);
    const slice = rows.slice(offset, offset + limit);

    const units = lite ? [] : Array.from(new Set(rows.map(r => r.nama_ukpd).filter(Boolean))).sort();
    const jabs = lite ? [] : Array.from(new Set(rows.map(r => r.nama_jabatan_orb).filter(Boolean))).sort();
    const statusList = lite ? [] : Array.from(new Set(rows.map(r => r.nama_status_aktif).filter(Boolean))).sort();

    const response = { ok: true, rows: slice, total, summary, units, jabs, statuses: statusList };
    storeCachedResponse('list', req.query, response, LIST_CACHE_TTL);
    res.json(response);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/dashboard-stats', async (req, res) => {
  try {
    const cached = getCachedResponse('dashboard_stats', req.query);
    if (cached) return res.json(cached);
    const term = norm(req.query.search);
    const unit = norm(req.query.unit);
    const wilayah = norm(req.query.wilayah);
    const jab = norm(req.query.jabatan);
    const statuses = (req.query.status || '').split(',').map(s => norm(s)).filter(Boolean);

    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: RANGE });
    const values = result.data.values || [];
    if (!values.length) {
      const empty = { ok: true, prepared: emptyDashboardPrepared(), total: 0 };
      storeCachedResponse('dashboard_stats', req.query, empty, DASHBOARD_CACHE_TTL);
      return res.json(empty);
    }

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

    const prepared = buildDashboardPrepared(rows);
    prepared.totalRows = rows.length;
    const response = { ok: true, prepared, total: rows.length };
    storeCachedResponse('dashboard_stats', req.query, response, DASHBOARD_CACHE_TTL);
    res.json(response);
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
    bumpCacheVersion();
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
    bumpCacheVersion();
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
    const users = data.map((r, idx) => ({
      rowNumber: idx + 2,
      namaUkpd: String(idxNamaUkpd >= 0 ? r[idxNamaUkpd] : (r[0] || '')).trim(),
      username: String(idxUser >= 0 ? r[idxUser] : (r[1] || r[0] || '')).trim(),
      password: String(idxPass >= 0 ? r[idxPass] : (r[2] || '')).trim(),
      role: String(idxHak >= 0 ? r[idxHak] : (r[3] || '')).trim(),
      wilayah: String(idxWilayah >= 0 ? r[idxWilayah] : (r[4] || '')).trim(),
    }));
    const uname = String(username || '').trim().toLowerCase();
    const pword = String(password || '').trim();
    const found = users.find(u => u.username.toLowerCase() === uname && verifyPassword(pword, u.password));
    if (!found) return res.status(401).json({ ok: false, error: 'Username atau password salah' });

    if (!isHashedPassword(found.password)) {
      const newHash = hashPassword(pword);
      const passIdx = idxPass >= 0 ? idxPass : 2;
      if (passIdx >= 0) {
        const col = columnToLetter(passIdx);
        const sheetName = USER_RANGE.split('!')[0];
        const range = `${sheetName}!${col}${found.rowNumber}`;
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[newHash]] }
        });
      }
    }

    const user = { username: found.username, role: found.role, namaUkpd: found.namaUkpd, wilayah: found.wilayah };
    const sessionToken = generateSessionToken();
    storeSession(sessionToken, user);
    return res.json({
      ok: true,
      data: { user, session_token: sessionToken, session_expires_in: SESSION_TTL },
      user,
      session_token: sessionToken,
      session_expires_in: SESSION_TTL
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/password-change', async (req, res) => {
  const body = req.body || {};
  const username = String(body.username || '').trim();
  const currentPassword = String(body.current_password || body.old_password || '').trim();
  const newPassword = String(body.new_password || '').trim();
  if (!username || !currentPassword || !newPassword) {
    return res.status(400).json({ ok: false, error: 'Username, password lama, dan password baru wajib' });
  }
  const sessionUser = getSessionUserFromReq(req);
  if (!sessionUser) return res.status(403).json({ ok: false, error: 'forbidden' });
  const ctx = getRoleContext(sessionUser);
  if (!ctx.isSuper && String(sessionUser.username || '').toLowerCase() !== username.toLowerCase()) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({ ok: false, error: 'Password baru belum memenuhi kriteria keamanan' });
  }
  try {
    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: USER_RANGE });
    const values = result.data.values || [];
    const [header, ...data] = values;
    const h = (header || []).map(x => (x || '').toLowerCase());
    const idxUser = h.indexOf('username');
    const idxPass = h.indexOf('password');
    const users = data.map((r, idx) => ({
      rowNumber: idx + 2,
      username: String(idxUser >= 0 ? r[idxUser] : (r[1] || r[0] || '')).trim(),
      password: String(idxPass >= 0 ? r[idxPass] : (r[2] || '')).trim()
    }));
    const found = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!found || !verifyPassword(currentPassword, found.password)) {
      return res.status(401).json({ ok: false, error: 'Password lama salah' });
    }
    const newHash = hashPassword(newPassword);
    const passIdx = idxPass >= 0 ? idxPass : 2;
    if (passIdx < 0) return res.status(500).json({ ok: false, error: 'Kolom password tidak ditemukan' });
    const col = columnToLetter(passIdx);
    const sheetName = USER_RANGE.split('!')[0];
    const range = `${sheetName}!${col}${found.rowNumber}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[newHash]] }
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/* ==== Usulan Mutasi (sheet USULAN_MUTASI) ==== */
app.get('/mutasi', async (req, res) => {
  try {
    const cached = getCachedResponse('mutasi_list', req.query);
    if (cached) return res.json(cached);
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
      if (!rec.wilayah_asal) rec.wilayah_asal = ukpdWilayahMap[norm(rec.nama_ukpd_asal)] || '';
      if (!rec.wilayah_tujuan) rec.wilayah_tujuan = ukpdWilayahMap[norm(rec.nama_ukpd_tujuan)] || '';
      return rec;
    }).filter(r => r.id);

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
    const ukpds = Array.from(new Set(filtered.map(r => r.nama_ukpd_asal).filter(Boolean))).sort();
    const tujuanList = Array.from(new Set(filtered.map(r => r.nama_ukpd_tujuan).filter(Boolean))).sort();
    const jenisList = Array.from(new Set(filtered.map(r => r.jenis_mutasi).filter(Boolean))).sort();

    const response = { ok: true, rows: filtered, total: filtered.length, summary, statuses, ukpds, tujuan: tujuanList, jenis: jenisList };
    storeCachedResponse('mutasi_list', req.query, response, LIST_CACHE_TTL);
    res.json(response);
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
    const map = await getUkpdWilayahMap();
    const wilayahAsal = d.wilayah_asal || map[norm(d.nama_ukpd_asal)] || '';
    const wilayahTujuan = d.wilayah_tujuan || map[norm(d.nama_ukpd_tujuan)] || '';
    const rowData = { ...d, id, wilayah_asal: wilayahAsal, wilayah_tujuan: wilayahTujuan };
    const row = MUTASI_COLS.map(k => k === 'id' ? id : (rowData[k] || ''));
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: MUTASI_RANGE,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });
    bumpCacheVersion();
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
    const map = await getUkpdWilayahMap();
    const wilayahAsal = req.body?.wilayah_asal || map[norm(req.body?.nama_ukpd_asal)] || '';
    const wilayahTujuan = req.body?.wilayah_tujuan || map[norm(req.body?.nama_ukpd_tujuan)] || '';
    const payloadData = { ...(req.body || {}), id, wilayah_asal: wilayahAsal, wilayah_tujuan: wilayahTujuan };
    const payload = MUTASI_COLS.map(k => k === 'id' ? id : (payloadData[k] || ''));
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${MUTASI_RANGE.split('!')[0]}!A${rowNumber}:S${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [payload] }
    });
    bumpCacheVersion();
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
    bumpCacheVersion();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ==== Usulan Pemutusan JF (sheet USULAN_PEMUTUSAN_JF) ==== */
app.get('/pemutusan-jf', async (req, res) => {
  try {
    const cached = getCachedResponse('pemutusan_jf_list', req.query);
    if (cached) return res.json(cached);
    const term = norm(req.query.search);
    const status = norm(req.query.status);
    const ukpdQuery = norm(req.query.ukpd);
    const wilayahQuery = norm(req.query.wilayah);

    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: PEMUTUSAN_RANGE });
    const values = result.data.values || [];
    const [header, ...rows] = values;
    let list = rows.map(r => toPemutusanRecord(header, r)).filter(r => r.id_usulan);

    let mapWilayah = null;
    if (wilayahQuery) {
      mapWilayah = await getUkpdWilayahMap(); // { ukpd_lower: wilayah_lower }
    }

    list = list.filter(r => {
      const matchTerm = !term || [r.nama_pegawai, r.nip].some(v => (v || '').toLowerCase().includes(term));
      const matchStatus = !status || norm(r.status) === status;
      const ukVal = norm(r.ukpd);
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
    const ukpds = Array.from(new Set(list.map(r => r.ukpd).filter(Boolean))).sort();

    const response = { ok: true, rows: list, total: list.length, summary, statuses, ukpds };
    storeCachedResponse('pemutusan_jf_list', req.query, response, LIST_CACHE_TTL);
    res.json(response);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/pemutusan-jf', async (req, res) => {
  try {
    const d = req.body || {};
    const id = d.id_usulan || `PJ-${Date.now()}`;
    // isi wilayah jika kosong berdasarkan user sheet
    let wilayahVal = d.wilayah || '';
    if (!wilayahVal && d.ukpd) {
      const map = await getUkpdWilayahMap();
      wilayahVal = map[norm(d.ukpd)] || '';
    }
    const rowData = { ...d, id_usulan: id, wilayah: wilayahVal };
    const row = PEMUTUSAN_COLS.map(k => rowData[k] || '');
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: PEMUTUSAN_RANGE,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });
    bumpCacheVersion();
    res.json({ ok: true, id_usulan: id });
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
    const idx = data.findIndex(r => (r[0] || '').toString() === id);
    if (idx < 0) return res.status(404).json({ ok: false, error: 'ID usulan tidak ditemukan' });
    const rowNumber = idx + 2; // +1 header
    let wilayahVal = req.body?.wilayah || '';
    if (!wilayahVal && req.body?.ukpd) {
      const map = await getUkpdWilayahMap();
      wilayahVal = map[norm(req.body.ukpd)] || '';
    }
    const dataPayload = { ...(req.body || {}), id_usulan: id, wilayah: wilayahVal };
    const payload = PEMUTUSAN_COLS.map(k => dataPayload[k] || '');
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${PEMUTUSAN_RANGE.split('!')[0]}!A${rowNumber}:T${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [payload] }
    });
    bumpCacheVersion();
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
    if (idx < 1) return res.status(404).json({ ok: false, error: 'ID usulan tidak ditemukan' });
    const sheetId = await getSheetIdByName(PEMUTUSAN_RANGE.split('!')[0]);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 } }
        }]
      }
    });
    bumpCacheVersion();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ==== Bezetting (sheet bezetting) ==== */
app.get('/bezetting', async (req, res) => {
  try {
    const cached = getCachedResponse('bezetting_list', req.query);
    if (cached) return res.json(cached);
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
    list = list.filter(r => {
      if (wilayahQuery && norm(r.wilayah) !== wilayahQuery) return false;
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
    const response = { ok: true, rows: slice, total, ukpds, statuses, rumpuns, jabatans };
    storeCachedResponse('bezetting_list', req.query, response, BEZETTING_CACHE_TTL);
    res.json(response);
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
    bumpCacheVersion();
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
    bumpCacheVersion();
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
    bumpCacheVersion();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ==== QnA (sheet Q n A) ==== */
app.get('/qna', async (req, res) => {
  try {
    const cached = getCachedResponse('qna_list', req.query);
    if (cached) return res.json(cached);
    const term = norm(req.query.search);
    const statusParam = norm(req.query.status);
    const statusList = statusParam ? statusParam.split(',').map(norm).filter(Boolean) : [];
    const categoryParam = norm(req.query.category);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 20000, 50000));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const sessionUser = getSessionUserFromReq(req);
    const ctx = getRoleContext(sessionUser || {});
    const isPublic = statusList.length === 1 && statusList[0] === 'published';
    if (!ctx.isSuper && !isPublic) return res.status(403).json({ ok: false, error: 'forbidden' });

    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: QNA_RANGE });
    const values = result.data.values || [];
    if (!values.length) {
      const empty = { ok: true, rows: [], total: 0, summary: {}, categories: [] };
      storeCachedResponse('qna_list', req.query, empty, LIST_CACHE_TTL);
      return res.json(empty);
    }

    const [header, ...rows] = values;
    const h = (header && header.length) ? header : QNA_COLS;
    let list = rows.map(r => toQnaRecord(h, r)).filter(r => r.id || r.question || r.answer);

    list = list.filter(r => {
      const matchTerm = !term || [r.question, r.answer].some(v => norm(v).includes(term));
      const matchStatus = !statusList.length || statusList.includes(norm(r.status));
      const matchCategory = !categoryParam || norm(r.category) === categoryParam;
      return matchTerm && matchStatus && matchCategory;
    });

    const parseTime = (val) => {
      const ts = Date.parse(String(val || ''));
      return Number.isNaN(ts) ? 0 : ts;
    };
    list.sort((a, b) => parseTime(b.updated_at || b.created_at) - parseTime(a.updated_at || a.created_at));

    const total = list.length;
    const summary = countBy(list, 'status');
    const categories = uniq(list.map(r => r.category));
    const slice = list.slice(offset, offset + limit);

    const response = { ok: true, rows: slice, total, summary, categories };
    storeCachedResponse('qna_list', req.query, response, LIST_CACHE_TTL);
    res.json(response);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/qna', async (req, res) => {
  const sessionUser = getSessionUserFromReq(req);
  const ctx = getRoleContext(sessionUser || {});
  if (!ctx.isSuper) return res.status(403).json({ ok: false, error: 'forbidden' });
  try {
    const d = req.body || {};
    const id = d.id || `QNA-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const rowData = {
      id,
      category: d.category || '',
      question: d.question || '',
      answer: d.answer || '',
      status: d.status || 'draft',
      created_at: d.created_at || nowIso,
      updated_at: nowIso
    };
    const row = QNA_COLS.map(k => rowData[k] || '');
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: QNA_RANGE,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });
    bumpCacheVersion();
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.put('/qna/:id', async (req, res) => {
  const sessionUser = getSessionUserFromReq(req);
  const ctx = getRoleContext(sessionUser || {});
  if (!ctx.isSuper) return res.status(403).json({ ok: false, error: 'forbidden' });
  const id = req.params.id;
  try {
    const values = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: QNA_RANGE });
    const rows = values.data.values || [];
    const [header, ...data] = rows;
    const h = (header || []).map(x => norm(x));
    const idxId = h.indexOf('id');
    const idx = data.findIndex(r => String(idxId >= 0 ? r[idxId] : r[0] || '').trim() === id);
    if (idx < 0) return res.status(404).json({ ok: false, error: 'ID QnA tidak ditemukan' });
    const rowNumber = idx + 2;
    const nowIso = new Date().toISOString();
    const current = toQnaRecord(header || QNA_COLS, data[idx]);
    const rowData = {
      ...current,
      ...req.body,
      id,
      updated_at: nowIso
    };
    if (!rowData.created_at) rowData.created_at = current.created_at || nowIso;
    const row = QNA_COLS.map(k => rowData[k] || '');
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${QNA_RANGE.split('!')[0]}!A${rowNumber}:G${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] }
    });
    bumpCacheVersion();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/qna/:id', async (req, res) => {
  const sessionUser = getSessionUserFromReq(req);
  const ctx = getRoleContext(sessionUser || {});
  if (!ctx.isSuper) return res.status(403).json({ ok: false, error: 'forbidden' });
  const id = req.params.id;
  try {
    const values = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: QNA_RANGE });
    const rows = values.data.values || [];
    const h = (rows[0] || []).map(x => norm(x));
    const idxId = h.indexOf('id');
    const idx = rows.findIndex(r => String(idxId >= 0 ? r[idxId] : r[0] || '').trim() === id);
    if (idx < 1) return res.status(404).json({ ok: false, error: 'ID QnA tidak ditemukan' });
    const sheetId = await getSheetIdByName(QNA_RANGE.split('!')[0]);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx + 1 } }
        }]
      }
    });
    bumpCacheVersion();
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
    created_at: get('created_at'),
    updated_at: get('updated_at'),
    wilayah_ukpd: get('wilayah_ukpd', 20),
    unit: get('nama_ukpd', 19),
    jabatan: get('nama_jabatan_orb', 3),
    statusKaryawan: get('nama_status_aktif', 5),
    aktif: get('nama_status_aktif', 5)
  };
}

function countStatus(rows) {
  return rows.reduce((acc, r) => {
    const raw = r.nama_status_aktif || '';
    const cleaned = raw.trim();
    const k = (cleaned || 'LAINNYA').toUpperCase();
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
    wilayah_asal: get('wilayah_asal',7),
    wilayah_tujuan: get('wilayah_tujuan',8),
    jenis_mutasi: get('jenis_mutasi',9),
    alasan: get('alasan',10),
    tanggal_usulan: get('tanggal_usulan',11),
    status: get('status',12),
    keterangan: get('keterangan',13),
    abk_j_lama: get('abk_j_lama',14),
    bezetting_j_lama: get('bezetting_j_lama',15),
    abk_j_baru: get('abk_j_baru',16),
    bezetting_j_baru: get('bezetting_j_baru',17),
    berkas_url: get('berkas_url',18),
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
    wilayah: get('wilayah',9),
    nomor_surat: get('nomor_surat',10),
    tanggal_surat: get('tanggal_surat',11),
    alasan_usulan: get('alasan_usulan',12),
    link_dokumen: get('link_dokumen',13),
    verifikasi_oleh: get('verifikasi_oleh',14),
    verifikasi_tanggal: get('verifikasi_tanggal',15),
    verifikasi_catatan: get('verifikasi_catatan',16),
    dibuat_oleh: get('dibuat_oleh',17),
    dibuat_pada: get('dibuat_pada',18),
    diupdate_pada: get('diupdate_pada',19),
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
  return {
    no: get('no',0),
    bidang: get('bidang/bagian',1),
    subbidang: get('subbidang/subbagian/satuan pelaksana',2),
    nama_jabatan_pergub: get('nama jabatan (pergub 1)',3),
    nama_jabatan_permenpan: get('nama jabatan (permenpan)',4),
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

function toQnaRecord(header, row) {
  const h = (header || []).map(x => (x || '').toLowerCase().trim());
  const get = (name, idxFallback) => {
    const idx = h.indexOf(name);
    if (idx >= 0 && typeof row[idx] !== 'undefined') return row[idx] || '';
    if (typeof idxFallback === 'number' && typeof row[idxFallback] !== 'undefined') return row[idxFallback] || '';
    return '';
  };
  return {
    id: get('id', 0),
    category: get('category', 1),
    question: get('question', 2),
    answer: get('answer', 3),
    status: get('status', 4),
    created_at: get('created_at', 5),
    updated_at: get('updated_at', 6)
  };
}

function columnToLetter(idx) {
  let n = idx + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters || 'A';
}

function uniq(list) {
  return Array.from(new Set((list || []).filter(Boolean))).sort();
}

function countBy(list, key) {
  return (list || []).reduce((acc, item) => {
    const val = (item && item[key]) ? String(item[key]).trim() : 'LAINNYA';
    if (!val) return acc;
    const k = val.toUpperCase();
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

function cleanLabel(val) {
  const text = String(val || '').trim();
  return text || '(Tidak Tercatat)';
}

function sumCounts(obj) {
  return Object.keys(obj || {}).reduce((sum, key) => sum + (+obj[key] || 0), 0);
}

function emptyStatusCounts() { return { PNS: 0, CPNS: 0, PPPK: 0, PROFESIONAL: 0, PJLP: 0 }; }
function emptyMaritalCounts() { return { BELUM_MENIKAH: 0, MENIKAH: 0, CERAI_HIDUP: 0, CERAI_MATI: 0 }; }

function makeDatasets(map, labels, order, labelMap, colorMap) {
  return order.map(k => ({
    label: labelMap[k],
    data: labels.map(l => (map[l] && map[l][k]) ? map[l][k] : 0),
    backgroundColor: colorMap[k],
    borderRadius: 6
  }));
}

function normalizeStatusDashboard(raw) {
  const t = String(raw || '').toUpperCase().trim();
  if (!t) return '';
  if (t === 'PNS') return 'PNS';
  if (t === 'CPNS') return 'CPNS';
  if (t.indexOf('PPPK') > -1 || t.indexOf('P3K') > -1) return 'PPPK';
  if (t.indexOf('PJLP') > -1) return 'PJLP';
  if (['NON PNS','NON ASN','PROFESIONAL','PROFESIONAL (NON PNS)','PROFESIONAL/NON PNS','TENAGA PROFESIONAL'].includes(t)) return 'PROFESIONAL';
  return 'LAINNYA';
}

function normalizeGenderDashboard(raw) {
  const t = String(raw || '').toLowerCase().trim();
  if (!t) return '';
  if (t.startsWith('l') || t.indexOf('laki') > -1) return 'LAKI';
  if (t.startsWith('p') || t.indexOf('perempuan') > -1 || t.indexOf('wanita') > -1) return 'PEREMPUAN';
  return '';
}

function normalizeMaritalDashboard(raw) {
  const t = String(raw || '').toLowerCase().trim();
  if (!t) return '';
  if (t.indexOf('belum') > -1 || t.indexOf('single') > -1 || t.indexOf('tidak menikah') > -1) return 'BELUM_MENIKAH';
  if (t.indexOf('cerai') > -1 && t.indexOf('mati') > -1) return 'CERAI_MATI';
  if (t.indexOf('cerai') > -1 && t.indexOf('hidup') > -1) return 'CERAI_HIDUP';
  if (t.indexOf('janda') > -1 || t.indexOf('duda') > -1) return 'CERAI_MATI';
  if (t.indexOf('menikah') > -1 || t.indexOf('kawin') > -1) return 'MENIKAH';
  return '';
}

function emptyDashboardPrepared() {
  const emptyStatus = emptyStatusCounts();
  return {
    statusCounts: { ...emptyStatus },
    genderCounts: { LAKI: 0, PEREMPUAN: 0 },
    maritalCounts: { BELUM_MENIKAH: 0, MENIKAH: 0, CERAI_HIDUP: 0, CERAI_MATI: 0 },
    unitLabelsStatus: [],
    unitLabelsGender: [],
    unitLabelsMarital: [],
    unitDatasetsStatus: [],
    unitDatasetsGender: [],
    unitDatasetsMarital: [],
    rumpunLabelsStatus: [],
    rumpunLabelsGender: [],
    rumpunLabelsMarital: [],
    rumpunDatasetsStatus: [],
    rumpunDatasetsGender: [],
    rumpunDatasetsMarital: [],
    pendidikanLabelsStatus: [],
    pendidikanLabelsGender: [],
    pendidikanLabelsMarital: [],
    pendidikanDatasetsStatus: [],
    pendidikanDatasetsGender: [],
    pendidikanDatasetsMarital: [],
    tableRows: [],
    totalRows: 0
  };
}

function buildDashboardPrepared(records) {
  const statusCounts = emptyStatusCounts();
  const genderCounts = { LAKI: 0, PEREMPUAN: 0 };
  const maritalCounts = { BELUM_MENIKAH: 0, MENIKAH: 0, CERAI_HIDUP: 0, CERAI_MATI: 0 };

  const unitStatusMap = {};
  const unitGenderMap = {};
  const unitMaritalMap = {};
  const wilMap = {};
  const rumpunStatusMap = {};
  const rumpunGenderMap = {};
  const rumpunMaritalMap = {};
  const pendidikanStatusMap = {};
  const pendidikanGenderMap = {};
  const pendidikanMaritalMap = {};

  records.forEach(r => {
    const unit = cleanLabel(r.nama_ukpd);
    const wilayah = cleanLabel(r.wilayah_ukpd || r.wilayah || '');
    const rumpun = cleanLabel(r.nama_status_rumpun);
    const pend = cleanLabel(r.jenjang_pendidikan);

    const st = normalizeStatusDashboard(r.nama_jenis_pegawai || r.nama_status_aktif || r.nama_status_rumpun);
    if (st && st !== 'LAINNYA') {
      statusCounts[st] = (statusCounts[st] || 0) + 1;

      if (!wilMap[wilayah]) wilMap[wilayah] = {};
      if (!wilMap[wilayah][unit]) wilMap[wilayah][unit] = emptyStatusCounts();
      wilMap[wilayah][unit][st] += 1;

      if (!unitStatusMap[unit]) unitStatusMap[unit] = emptyStatusCounts();
      unitStatusMap[unit][st] += 1;

      if (!rumpunStatusMap[rumpun]) rumpunStatusMap[rumpun] = emptyStatusCounts();
      rumpunStatusMap[rumpun][st] += 1;

      if (!pendidikanStatusMap[pend]) pendidikanStatusMap[pend] = emptyStatusCounts();
      pendidikanStatusMap[pend][st] += 1;
    }

    const gender = normalizeGenderDashboard(r.jenis_kelamin);
    if (gender) {
      genderCounts[gender] = (genderCounts[gender] || 0) + 1;

      if (!unitGenderMap[unit]) unitGenderMap[unit] = { LAKI: 0, PEREMPUAN: 0 };
      unitGenderMap[unit][gender] += 1;

      if (!rumpunGenderMap[rumpun]) rumpunGenderMap[rumpun] = { LAKI: 0, PEREMPUAN: 0 };
      rumpunGenderMap[rumpun][gender] += 1;

      if (!pendidikanGenderMap[pend]) pendidikanGenderMap[pend] = { LAKI: 0, PEREMPUAN: 0 };
      pendidikanGenderMap[pend][gender] += 1;
    }

    const marital = normalizeMaritalDashboard(r.status_pernikahan);
    if (marital) {
      maritalCounts[marital] = (maritalCounts[marital] || 0) + 1;

      if (!unitMaritalMap[unit]) unitMaritalMap[unit] = emptyMaritalCounts();
      unitMaritalMap[unit][marital] += 1;

      if (!rumpunMaritalMap[rumpun]) rumpunMaritalMap[rumpun] = emptyMaritalCounts();
      rumpunMaritalMap[rumpun][marital] += 1;

      if (!pendidikanMaritalMap[pend]) pendidikanMaritalMap[pend] = emptyMaritalCounts();
      pendidikanMaritalMap[pend][marital] += 1;
    }
  });

  const unitLabelsStatus = Object.keys(unitStatusMap).sort();
  const unitLabelsGender = Object.keys(unitGenderMap).sort();
  const unitLabelsMarital = Object.keys(unitMaritalMap).sort();

  const rumpunLabelsStatus = Object.keys(rumpunStatusMap).sort((a, b) => sumCounts(rumpunStatusMap[b]) - sumCounts(rumpunStatusMap[a]));
  const rumpunLabelsGender = Object.keys(rumpunGenderMap).sort((a, b) => sumCounts(rumpunGenderMap[b]) - sumCounts(rumpunGenderMap[a]));
  const rumpunLabelsMarital = Object.keys(rumpunMaritalMap).sort((a, b) => sumCounts(rumpunMaritalMap[b]) - sumCounts(rumpunMaritalMap[a]));

  const pendidikanLabelsStatus = Object.keys(pendidikanStatusMap).sort((a, b) => sumCounts(pendidikanStatusMap[b]) - sumCounts(pendidikanStatusMap[a]));
  const pendidikanLabelsGender = Object.keys(pendidikanGenderMap).sort((a, b) => sumCounts(pendidikanGenderMap[b]) - sumCounts(pendidikanGenderMap[a]));
  const pendidikanLabelsMarital = Object.keys(pendidikanMaritalMap).sort((a, b) => sumCounts(pendidikanMaritalMap[b]) - sumCounts(pendidikanMaritalMap[a]));

  const wilayahLabels = Object.keys(wilMap).sort();
  const tableRows = [];

  wilayahLabels.forEach(w => {
    const unitEntries = Object.keys(wilMap[w] || {});
    const unitRows = unitEntries.map(u => {
      const counts = Object.assign(emptyStatusCounts(), wilMap[w][u] || {});
      return { wilayah: w || 'Tidak Tercatat', unit: u || '-', ...counts, total: sumCounts(counts) };
    }).sort((a, b) => b.total - a.total);

    const groupTotals = unitRows.reduce((acc, row) => {
      DASH_STATUS_ORDER.forEach(k => { acc[k] = (acc[k] || 0) + (row[k] || 0); });
      acc.total = (acc.total || 0) + (row.total || 0);
      return acc;
    }, Object.assign(emptyStatusCounts(), { total: 0 }));

    tableRows.push({ isGroup: true, wilayah: w || 'Tidak Tercatat', ...groupTotals });
    unitRows.forEach((row, idx) => tableRows.push({ ...row, no: idx + 1 }));
  });

  return {
    statusCounts,
    genderCounts,
    maritalCounts,
    unitLabelsStatus,
    unitLabelsGender,
    unitLabelsMarital,
    unitDatasetsStatus: makeDatasets(unitStatusMap, unitLabelsStatus, DASH_STATUS_ORDER, DASH_STATUS_LABELS, DASH_STATUS_COLORS),
    unitDatasetsGender: makeDatasets(unitGenderMap, unitLabelsGender, DASH_GENDER_ORDER, DASH_GENDER_LABELS, DASH_GENDER_COLORS),
    unitDatasetsMarital: makeDatasets(unitMaritalMap, unitLabelsMarital, DASH_MARITAL_ORDER, DASH_MARITAL_LABELS, DASH_MARITAL_COLORS),
    rumpunLabelsStatus,
    rumpunLabelsGender,
    rumpunLabelsMarital,
    rumpunDatasetsStatus: makeDatasets(rumpunStatusMap, rumpunLabelsStatus, DASH_STATUS_ORDER, DASH_STATUS_LABELS, DASH_STATUS_COLORS),
    rumpunDatasetsGender: makeDatasets(rumpunGenderMap, rumpunLabelsGender, DASH_GENDER_ORDER, DASH_GENDER_LABELS, DASH_GENDER_COLORS),
    rumpunDatasetsMarital: makeDatasets(rumpunMaritalMap, rumpunLabelsMarital, DASH_MARITAL_ORDER, DASH_MARITAL_LABELS, DASH_MARITAL_COLORS),
    pendidikanLabelsStatus,
    pendidikanLabelsGender,
    pendidikanLabelsMarital,
    pendidikanDatasetsStatus: makeDatasets(pendidikanStatusMap, pendidikanLabelsStatus, DASH_STATUS_ORDER, DASH_STATUS_LABELS, DASH_STATUS_COLORS),
    pendidikanDatasetsGender: makeDatasets(pendidikanGenderMap, pendidikanLabelsGender, DASH_GENDER_ORDER, DASH_GENDER_LABELS, DASH_GENDER_COLORS),
    pendidikanDatasetsMarital: makeDatasets(pendidikanMaritalMap, pendidikanLabelsMarital, DASH_MARITAL_ORDER, DASH_MARITAL_LABELS, DASH_MARITAL_COLORS),
    tableRows
  };
}

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
