import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mysql from 'mysql2/promise';

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 3000);
const API_KEY = String(process.env.API_KEY || '').trim();
const DB_HTTP_TOKEN = String(process.env.DB_HTTP_TOKEN || '').trim();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`
    );
  });
  next();
});

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'sisdmk2',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
  queueLimit: Number(process.env.DB_QUEUE_LIMIT || 0),
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 10000),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: 'Z'
});

function jsonError(res, status, message) {
  return res.status(status).json({ ok: false, error: message });
}

function logError(label, err) {
  const msg = err instanceof Error ? err.message : String(err || 'unknown_error');
  console.error(`[${new Date().toISOString()}] ${label}: ${msg}`);
}

function requireApiKey(req, res, next) {
  if (!API_KEY) return jsonError(res, 500, 'api_key_not_configured');
  const got = String(req.headers['x-api-key'] || '').trim();
  if (!got || got !== API_KEY) return jsonError(res, 401, 'unauthorized');
  return next();
}

function requireDbToken(req, res, next) {
  if (!DB_HTTP_TOKEN) return jsonError(res, 500, 'db_http_token_not_configured');
  const auth = String(req.headers.authorization || '');
  if (!auth.toLowerCase().startsWith('bearer ')) return jsonError(res, 401, 'unauthorized');
  const token = auth.slice(7).trim();
  if (!token || token !== DB_HTTP_TOKEN) return jsonError(res, 401, 'unauthorized');
  return next();
}

function isAllowedSql(sql) {
  const first = String(sql || '').trim().split(/\s+/)[0]?.toUpperCase() || '';
  return [
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'CREATE',
    'DROP',
    'RENAME'
  ].includes(first);
}

async function queryDb(sql, params) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

app.get('/health', async (_req, res) => {
  try {
    await queryDb('SELECT 1');
    return res.json({ ok: true });
  } catch (err) {
    logError('health', err);
    return jsonError(res, 500, 'db_unavailable');
  }
});

app.get('/pegawai', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 200);
    const where = [];
    const params = [];
    if (q) {
      const like = `%${q}%`;
      where.push('(nama LIKE ? OR nip LIKE ? OR ukpd LIKE ?)');
      params.push(like, like, like);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `
      SELECT id, nip, nama, ukpd, created_at
      FROM pegawai
      ${clause}
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `;
    params.push(limit);
    const rows = await queryDb(sql, params);
    return res.json({ ok: true, rows });
  } catch (err) {
    logError('pegawai_list', err);
    return jsonError(res, 500, 'internal_error');
  }
});

app.get('/pegawai/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return jsonError(res, 400, 'invalid_id');
  try {
    const rows = await queryDb(
      'SELECT id, nip, nama, ukpd, created_at FROM pegawai WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows.length) return jsonError(res, 404, 'not_found');
    return res.json({ ok: true, data: rows[0] });
  } catch (err) {
    logError('pegawai_detail', err);
    return jsonError(res, 500, 'internal_error');
  }
});

app.post('/sync/pegawai', requireApiKey, async (req, res) => {
  const body = req.body || {};
  const nama = String(body.nama || '').trim();
  const nipRaw = body.nip === '' ? null : body.nip;
  const nip = nipRaw === null ? null : String(nipRaw || '').trim();
  const ukpd = body.ukpd === undefined ? null : String(body.ukpd || '').trim();

  if (!nama) return jsonError(res, 400, 'nama_required');

  try {
    const sql = `
      INSERT INTO pegawai (nip, nama, ukpd)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nama = VALUES(nama),
        ukpd = VALUES(ukpd)
    `;
    const [result] = await pool.execute(sql, [nip, nama, ukpd]);
    const affectedRows = result?.affectedRows ?? 0;
    const inserted = affectedRows === 1;
    const updated = affectedRows === 2;
    return res.json({
      ok: true,
      inserted,
      updated,
      affectedRows,
      insertId: result?.insertId ?? null
    });
  } catch (err) {
    logError('sync_pegawai', err);
    return jsonError(res, 500, 'internal_error');
  }
});

app.post('/db/query', requireDbToken, async (req, res) => {
  const body = req.body || {};
  const sql = typeof body.sql === 'string' ? body.sql : '';
  const params = Array.isArray(body.params) ? body.params : [];
  if (!sql.trim()) return jsonError(res, 400, 'sql_required');
  if (sql.includes(';')) return jsonError(res, 400, 'multi_statement_not_allowed');
  if (!isAllowedSql(sql)) return jsonError(res, 400, 'statement_not_allowed');

  try {
    const [rows] = await pool.execute(sql, params);
    if (Array.isArray(rows)) {
      return res.json({ ok: true, rows });
    }
    return res.json({
      ok: true,
      affectedRows: rows?.affectedRows ?? 0,
      insertId: rows?.insertId ?? null
    });
  } catch (err) {
    logError('db_query', err);
    return jsonError(res, 500, 'internal_error');
  }
});

app.use((_req, res) => jsonError(res, 404, 'not_found'));

app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.too.large') {
    return jsonError(res, 413, 'payload_too_large');
  }
  if (err) {
    logError('unhandled', err);
  }
  return jsonError(res, 500, 'internal_error');
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
