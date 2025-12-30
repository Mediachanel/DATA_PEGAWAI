// Cloudflare Worker proxy untuk Apps Script Web App.
// Set environment variables di Workers (Settings -> Variables):
// - WEB_APP_BASE: URL Apps Script Web App (/exec)
// - PROXY_KEY: nilai header X-Proxy-Key dari frontend
// - APPS_SCRIPT_KEY: API key yang diteruskan ke Apps Script via query `key`
// - CACHE_TTL: durasi cache (detik) untuk request GET list (default 30)
// Hybrid sync variables:
// - SYNC_KEY: secret untuk header X-SYNC-KEY (Apps Script -> Worker)
// - DB_HTTP_URL: URL HTTP MySQL gateway (Worker -> DB) (opsional jika pakai Hyperdrive)
// - DB_HTTP_TOKEN: bearer token untuk DB gateway
// - DB_GATEWAY_URL: URL HTTP gateway untuk endpoint /db/query

export default {
  async fetch(req, env, ctx) {
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    };
    const cacheTtlDefault = Math.max(5, parseInt(env.CACHE_TTL || '30', 10));
    const cacheTtlBezetting = Math.max(5, parseInt(env.CACHE_TTL_BEZETTING || String(cacheTtlDefault), 10));
    const cacheableActions = new Set(['list','dashboard_stats','mutasi_list','pemutusan_jf_list','bezetting_list','qna_list']);

    if (req.method === 'OPTIONS') {
      return new Response('', { status: 204, headers: corsHeaders });
    }

    const url = new URL(req.url);
    if (url.protocol !== 'https:') {
      return json({ ok: false, error: 'https_required' }, 400);
    }

    if (url.pathname === '/db/query') {
      return handleDbQuery(req, env, corsHeaders);
    }

    // API gateway (Worker -> mysql-gateway via Tunnel)
    if (url.pathname.startsWith('/api/')) {
      return handleApiProxy(req, env, url, corsHeaders);
    }

    // Hybrid sync endpoints (Apps Script -> Worker -> MySQL)
    // Tidak memakai X-Proxy-Key (khusus backend), hanya X-SYNC-KEY.
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts[0] === 'sync' && req.method === 'POST' && pathParts[1]) {
      return handleSyncAny(req, env, pathParts[1]);
    }
    if (pathParts[0] === 'refresh' && req.method === 'POST' && pathParts[1] && pathParts[2]) {
      if (pathParts[2] === 'start') return handleRefreshStart(req, env, pathParts[1]);
      if (pathParts[2] === 'chunk') return handleRefreshChunk(req, env, pathParts[1]);
      if (pathParts[2] === 'commit') return handleRefreshCommit(req, env, pathParts[1]);
    }
    if (pathParts[0] === 'reconcile' && req.method === 'GET' && pathParts[1]) {
      if (pathParts[1] === 'pegawai') return handleReconcilePegawai(req, env);
    }

    const base = env.WEB_APP_BASE;
    if (!base) {
      return new Response(JSON.stringify({ ok: false, error: 'WEB_APP_BASE not set' }), {
        status: 500,
        headers: { 'content-type': 'application/json', ...corsHeaders },
      });
    }

    const proxyKey = env.PROXY_KEY || '';
    const incomingKey = req.headers.get('x-proxy-key') || '';
    if (!proxyKey || incomingKey !== proxyKey) {
      return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
        status: 401,
        headers: { 'content-type': 'application/json', ...corsHeaders },
      });
    }

    const action = (url.searchParams.get('action') || '').toLowerCase();
    const cacheTtl = action === 'bezetting_list' ? cacheTtlBezetting : cacheTtlDefault;
    const shouldCache = req.method === 'GET' && cacheableActions.has(action);
    if (shouldCache) {
      const cached = await caches.default.match(req);
      if (cached) return cached;
    }
    const targetUrl = new URL(base);
    url.searchParams.forEach((value, key) => {
      targetUrl.searchParams.append(key, value);
    });
    const appsKey = env.APPS_SCRIPT_KEY || '';
    if (appsKey) targetUrl.searchParams.set('key', appsKey);

    const init = { method: req.method, headers: {}, redirect: 'follow' };
    const ct = req.headers.get('content-type');
    if (ct) init.headers['content-type'] = ct;
    if (!['GET', 'HEAD'].includes(req.method)) {
      init.body = await req.arrayBuffer();
    }

    const upstream = await fetch(targetUrl.toString(), init);
    const text = await upstream.text();
    const headers = {
      'content-type': upstream.headers.get('content-type') || 'application/json',
      ...corsHeaders,
    };
    if (shouldCache && upstream.ok) headers['cache-control'] = `public, max-age=${cacheTtl}`;
    const response = new Response(text, {
      status: upstream.status,
      headers,
    });
    if (shouldCache && upstream.ok && ctx) {
      ctx.waitUntil(caches.default.put(req, response.clone()));
    }
    return response;
  },
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function sleep_(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function joinPaths(basePath, nextPath) {
  const left = String(basePath || '/');
  const right = String(nextPath || '/');
  const joined = `${left.replace(/\/+$/, '')}/${right.replace(/^\/+/, '')}`;
  return joined || '/';
}

function getDbToken(req) {
  const raw = req.headers.get('x-db-token') || req.headers.get('authorization') || '';
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase().startsWith('bearer ')) {
    return trimmed.slice(7).trim();
  }
  return trimmed;
}

async function handleDbQuery(req, env, corsHeaders) {
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405, corsHeaders);
  }

  const expected = String(env.DB_HTTP_TOKEN || '').trim();
  const got = getDbToken(req);
  if (!expected || !got || got !== expected) {
    return json({ ok: false, error: 'unauthorized' }, 401, corsHeaders);
  }

  const gatewayUrl = String(env.DB_GATEWAY_URL || '').trim();
  if (!gatewayUrl) {
    return json({ ok: false, error: 'db_gateway_not_set' }, 500, corsHeaders);
  }

  const init = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-db-token': expected,
    },
    body: await req.arrayBuffer(),
    redirect: 'follow',
  };

  const upstream = await fetch(gatewayUrl, init);
  const body = await upstream.arrayBuffer();
  const headers = {
    'content-type': upstream.headers.get('content-type') || 'application/json',
    ...corsHeaders,
  };
  return new Response(body, {
    status: upstream.status,
    headers,
  });
}

async function handleApiProxy(req, env, url, corsHeaders) {
  const origin = String(env.API_ORIGIN || '').trim();
  if (!origin) {
    return new Response(JSON.stringify({ ok: false, error: 'API_ORIGIN not set' }), {
      status: 500,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }

  const proxyKey = String(env.API_PROXY_KEY || '').trim();
  const incomingKey = String(req.headers.get('x-proxy-key') || '').trim();
  if (!proxyKey || incomingKey !== proxyKey) {
    return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
      status: 401,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }

  const targetUrl = new URL(origin);
  const apiPath = url.pathname.replace(/^\/api/, '') || '/';
  targetUrl.pathname = joinPaths(targetUrl.pathname, apiPath);
  url.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  const init = { method: req.method, headers: {}, redirect: 'follow' };
  const ct = req.headers.get('content-type');
  if (ct) init.headers['content-type'] = ct;

  const dbApiKey = String(env.DB_API_KEY || '').trim();
  if (dbApiKey) init.headers['x-api-key'] = dbApiKey;

  if (!['GET', 'HEAD'].includes(req.method)) {
    init.body = await req.arrayBuffer();
  }

  const upstream = await fetch(targetUrl.toString(), init);
  const text = await upstream.text();
  const headers = {
    'content-type': upstream.headers.get('content-type') || 'application/json',
    ...corsHeaders,
  };
  return new Response(text, {
    status: upstream.status,
    headers,
  });
}

function getSyncKeyOk(req, env) {
  const expected = String(env.SYNC_KEY || '').trim();
  const got = String(req.headers.get('x-sync-key') || '').trim();
  return expected && got && expected === got;
}

function norm1(v) {
  return String(v || '').trim().replace(/\s+/g, ' ');
}

function upper1(v) {
  return norm1(v).toUpperCase();
}

const PEGAWAI_DB_COLS = [
  'sid',
  'nama_pegawai','npwp','no_bpjs','nama_jabatan_orb','nama_jabatan_prb','nama_status_aktif','nama_status_rumpun',
  'jenis_kontrak','nip','jenis_kelamin','tmt_kerja_ukpd','tempat_lahir','tanggal_lahir','agama',
  'jenjang_pendidikan','jurusan_pendidikan','no_tlp','email','nama_ukpd','wilayah_ukpd','golongan_darah','gelar_depan',
  'gelar_belakang','status_pernikahan','nama_jenis_pegawai','catatan_revisi_biodata','alamat_ktp','alamat_domisili',
  'created_at','updated_at',
  'sync_status','sync_error','synced_at',
  'row_hash',
  'db_synced_at',
];

const USERNAME_DB_COLS = [
  'sid',
  'nama_ukpd','username','password','hak_akses','wilayah',
  'sync_status','sync_error','synced_at',
  'row_hash',
  'db_synced_at',
];

const USULAN_MUTASI_DB_COLS = [
  'sid',
  'id','nip','nama_pegawai','gelar_depan','gelar_belakang','pangkat_golongan','jabatan','abk_j_lama',
  'bezetting_j_lama','nonasn_bezetting_lama','nonasn_abk_lama','jabatan_baru','abk_j_baru','bezetting_j_baru',
  'nonasn_bezetting_baru','nonasn_abk_baru','nama_ukpd','ukpd_tujuan','alasan','tanggal_usulan','status',
  'berkas_path','created_by_ukpd','created_at','updated_at','keterangan','mutasi_id','jenis_mutasi','verif_checklist',
  'sync_status','sync_error','synced_at',
  'row_hash',
  'db_synced_at',
];

const USULAN_PEMUTUSAN_DB_COLS = [
  'sid',
  'id','nip','pangkat_golongan','nama_pegawai','jabatan','jabatan_baru','angka_kredit','alasan_pemutusan',
  'nomor_surat','tanggal_surat','hal','pimpinan','asal_surat','nama_ukpd','tanggal_usulan','status',
  'berkas_path','created_by_ukpd','created_at','updated_at','keterangan',
  'sync_status','sync_error','synced_at',
  'row_hash',
  'db_synced_at',
];

const QNA_DB_COLS = [
  'sid',
  'id','category','question','answer','status','created_at','updated_at',
  'sync_status','sync_error','synced_at',
  'row_hash',
  'db_synced_at',
];

const BEZETTING_DB_COLS = [
  'sid',
  'no','bidang','subbidang','nama_jabatan_pergub','nama_jabatan_permenpan','jabatan_orb','pangkat_golongan',
  'rumpun_jabatan','kode','abk','eksisting','selisih','nama_pegawai','nip','nrk','status_formasi','pendidikan',
  'keterangan','sisa_formasi_2026','kebutuhan_asn_2026','perencanaan_kebutuhan','program_studi',
  'perencanaan_pendidikan_lanjutan','ukpd','wilayah',
  'sync_status','sync_error','synced_at',
  'row_hash',
  'db_synced_at',
];

const TABLE_CONFIGS = {
  pegawai: { cols: PEGAWAI_DB_COLS },
  username: { cols: USERNAME_DB_COLS },
  usulan_mutasi: { cols: USULAN_MUTASI_DB_COLS },
  usulan_pemutusan_jf: { cols: USULAN_PEMUTUSAN_DB_COLS },
  qna: { cols: QNA_DB_COLS },
  bezetting: { cols: BEZETTING_DB_COLS },
};

function normalizeDateOnly(v) {
  const s = norm1(v);
  if (!s) return null;
  // Accept ISO or YYYY-MM-DD; keep only date part for DATE column.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function normalizeDateTime(v) {
  const s = norm1(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 19).replace('T', ' ');
    }
    return s.replace('T', ' ').replace('Z', '').split('.')[0];
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s} 00:00:00`;
  if (/^\d{4}-\d{2}-\d{2} /.test(s)) return s.slice(0, 19);
  return s;
}

function normalizePegawaiRowForDb({ sid, nip, row, rowHash }) {
  const r = row || {};
  const out = {};
  out.sid = sid;
  out.nip = nip;

  out.nama_pegawai = norm1(r.nama_pegawai);
  out.npwp = norm1(r.npwp) || null;
  out.no_bpjs = norm1(r.no_bpjs) || null;
  out.nama_jabatan_orb = norm1(r.nama_jabatan_orb) || null;
  out.nama_jabatan_prb = norm1(r.nama_jabatan_prb) || null;
  out.nama_status_aktif = upper1(r.nama_status_aktif) || null;
  out.nama_status_rumpun = upper1(r.nama_status_rumpun) || null;
  out.jenis_kontrak = upper1(r.jenis_kontrak) || null;
  out.jenis_kelamin = upper1(r.jenis_kelamin) || null;
  out.tmt_kerja_ukpd = norm1(r.tmt_kerja_ukpd) || null;
  out.tempat_lahir = norm1(r.tempat_lahir) || null;
  out.tanggal_lahir = normalizeDateOnly(r.tanggal_lahir);
  out.agama = upper1(r.agama) || null;
  out.jenjang_pendidikan = upper1(r.jenjang_pendidikan) || null;
  out.jurusan_pendidikan = norm1(r.jurusan_pendidikan) || null;
  out.no_tlp = norm1(r.no_tlp) || null;
  out.email = norm1(r.email) || null;
  out.nama_ukpd = upper1(r.nama_ukpd) || null;
  out.wilayah_ukpd = upper1(r.wilayah_ukpd) || null;
  out.golongan_darah = upper1(r.golongan_darah) || null;
  out.gelar_depan = norm1(r.gelar_depan) || null;
  out.gelar_belakang = norm1(r.gelar_belakang) || null;
  out.status_pernikahan = upper1(r.status_pernikahan) || null;
  out.nama_jenis_pegawai = upper1(r.nama_jenis_pegawai) || null;
  out.catatan_revisi_biodata = norm1(r.catatan_revisi_biodata) || null;
  out.alamat_ktp = norm1(r.alamat_ktp) || null;
  out.alamat_domisili = norm1(r.alamat_domisili) || null;

  out.created_at = normalizeDateTime(r.created_at);
  out.updated_at = normalizeDateTime(r.updated_at);

  out.sync_status = upper1(r.sync_status) || null;
  out.sync_error = norm1(r.sync_error) || null;
  out.synced_at = normalizeDateTime(r.synced_at);

  out.row_hash = norm1(rowHash) || null;
  out.db_synced_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

  return out;
}

function getTableConfig(table) {
  return TABLE_CONFIGS[table];
}

function normalizeGenericRowForDb({ table, sid, row, rowHash }) {
  const cfg = getTableConfig(table);
  if (!cfg) throw new Error('table_not_allowed');
  const r = row || {};
  const out = {};
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  cfg.cols.forEach((col) => {
    if (col === 'sid') {
      out.sid = sid;
      return;
    }
    if (col === 'row_hash') {
      out.row_hash = rowHash || null;
      return;
    }
    if (col === 'db_synced_at') {
      out.db_synced_at = now;
      return;
    }
    const val = r[col];
    if (val === undefined || val === null || String(val).trim() === '') {
      out[col] = null;
    } else {
      if (col.endsWith('_at') || col.startsWith('tanggal_') || col === 'tanggal') {
        out[col] = normalizeDateTime(val);
      } else {
        out[col] = typeof val === 'string' ? val.trim() : val;
      }
    }
  });

  return out;
}

function buildUpsertSql(table, cols) {
  const placeholders = cols.map(() => '?').join(',');
  const updates = cols
    .filter(c => !['sid', 'db_synced_at'].includes(c))
    .map(c => `${c}=VALUES(${c})`)
    .concat(['db_synced_at=NOW()'])
    .join(', ');
  return `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;
}

async function readJson(req) {
  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new Error('content_type_must_be_json');
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}

async function dbQuery(env, sql, params = []) {
  const url = String(env.DB_HTTP_URL || '').trim();
  if (!url) throw new Error('DB_HTTP_URL not set');
  const token = String(env.DB_HTTP_TOKEN || '').trim();
  const maxAttempts = 3;

  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sql, params }),
      });

      const text = await res.text();
      let body = null;
      try { body = text ? JSON.parse(text) : {}; } catch { body = { ok: false, error: text }; }
      if (!res.ok || !body || body.ok === false) {
        const msg = body && (body.error || body.message) ? (body.error || body.message) : text;
        const err = new Error(`db_error: ${res.status} ${msg || ''}`.trim());
        if ([502, 503, 504].includes(res.status) && attempt < maxAttempts) {
          await sleep_(200 * attempt);
          continue;
        }
        throw err;
      }
      return body;
    } catch (e) {
      lastErr = e;
      if (attempt >= maxAttempts) break;
      await sleep_(200 * attempt);
    }
  }
  throw lastErr || new Error('db_error');
}

async function handleSyncPegawai(req, env) {
  if (!getSyncKeyOk(req, env)) return json({ ok: false, error: 'forbidden' }, 401);

  let body;
  try { body = await readJson(req); } catch (e) { return json({ ok: false, error: e.message }, 400); }

  const sid = norm1(body.sid);
  if (!sid) return json({ ok: false, error: 'SID wajib' }, 400);

  const row = body && typeof body.row === 'object' && body.row ? body.row : {};
  const nipRaw = norm1(body.nip || row.nip);
  const nip = nipRaw ? nipRaw : null;
  const namaPegawai = norm1(row.nama_pegawai);
  if (!namaPegawai) return json({ ok: false, error: 'nama_pegawai wajib' }, 400);

  const payload = normalizePegawaiRowForDb({ sid, nip, row, rowHash: body.row_hash });

  try {
    if (payload.nip) {
      const check = await dbQuery(env, 'SELECT sid, nip FROM pegawai WHERE nip = ? LIMIT 1', [payload.nip]);
      const found = (check.rows || [])[0];
      if (found && String(found.sid) !== payload.sid) {
        await safeLog(env, {
          sid: payload.sid,
          nip: payload.nip,
          action: 'error',
          ok: 0,
          message: `NIP conflict: already used by sid=${found.sid}`,
          row_hash: payload.row_hash,
        });
        return json({ ok: false, error: 'NIP conflict', sid: payload.sid, nip: payload.nip, conflict_sid: found.sid }, 409);
      }
    }

    const cols = PEGAWAI_DB_COLS;
    const placeholders = cols.map(() => '?').join(',');
    const updates = cols
      .filter(c => !['sid', 'db_synced_at'].includes(c))
      .map(c => `${c}=VALUES(${c})`)
      .concat(['db_synced_at=NOW()'])
      .join(', ');

    const upsertSql = `INSERT INTO pegawai (${cols.join(',')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;
    const params = cols.map((c) => payload[c] ?? null);
    const res = await dbQuery(env, upsertSql, params);

    const action = res.affectedRows === 1 ? 'insert' : 'update';
    await safeLog(env, {
      sid: payload.sid,
      nip: payload.nip,
      action,
      ok: 1,
      message: null,
      row_hash: payload.row_hash,
    });

    return json({ ok: true, action, sid: payload.sid, nip: payload.nip, hash: payload.row_hash });
  } catch (e) {
    await safeLog(env, {
      sid: payload.sid,
      nip: payload.nip,
      action: 'error',
      ok: 0,
      message: String(e && e.message ? e.message : e),
      row_hash: payload.row_hash,
    });
    return json({ ok: false, error: e.message }, 500);
  }
}

async function handleSyncAny(req, env, table) {
  if (!getSyncKeyOk(req, env)) return json({ ok: false, error: 'forbidden' }, 401);
  const safeTable = String(table || '').trim();
  if (!getTableConfig(safeTable)) return json({ ok: false, error: 'table_not_allowed' }, 400);
  if (safeTable === 'pegawai') return handleSyncPegawai(req, env);

  let body;
  try { body = await readJson(req); } catch (e) { return json({ ok: false, error: e.message }, 400); }

  const row = body && typeof body.row === 'object' && body.row ? body.row : {};
  const sid = norm1(body.sid || row.sid);
  if (!sid) return json({ ok: false, error: 'SID wajib' }, 400);

  const payload = normalizeGenericRowForDb({ table: safeTable, sid, row, rowHash: body.row_hash });

  try {
    const cfg = getTableConfig(safeTable);
    const sql = buildUpsertSql(safeTable, cfg.cols);
    const params = cfg.cols.map((c) => payload[c] ?? null);
    const res = await dbQuery(env, sql, params);

    const action = res.affectedRows === 1 ? 'insert' : 'update';
    await safeLog(env, {
      sid: payload.sid,
      nip: payload.nip || null,
      action: `${safeTable}:${action}`,
      ok: 1,
      message: null,
      row_hash: payload.row_hash || null,
    });

    return json({ ok: true, table: safeTable, action, sid: payload.sid });
  } catch (e) {
    await safeLog(env, {
      sid: payload.sid,
      nip: payload.nip || null,
      action: `${safeTable}:error`,
      ok: 0,
      message: String(e && e.message ? e.message : e),
      row_hash: payload.row_hash || null,
    });
    return json({ ok: false, error: e.message }, 500);
  }
}

async function handleRefreshStart(req, env) {
  return handleRefreshStartForTable(req, env, 'pegawai');
}

async function handleRefreshChunk(req, env) {
  return handleRefreshChunkForTable(req, env, 'pegawai');
}

async function handleRefreshCommit(req, env) {
  return handleRefreshCommitForTable(req, env, 'pegawai');
}

async function handleRefreshStartForTable(req, env, table) {
  if (!getSyncKeyOk(req, env)) return json({ ok: false, error: 'forbidden' }, 401);
  const safeTable = String(table || '').trim();
  const cfg = getTableConfig(safeTable);
  if (!cfg) return json({ ok: false, error: 'table_not_allowed' }, 400);
  const refreshId = crypto.randomUUID();
  const stageTable = `${safeTable}_stage`;
  try {
    await dbQuery(env, `CREATE TABLE IF NOT EXISTS ${stageTable} LIKE ${safeTable}`);
    await dbQuery(env, `TRUNCATE TABLE ${stageTable}`);
    await dbQuery(env,
      'INSERT INTO refresh_runs (refresh_id, entity, status, started_at) VALUES (?, ?, ?, NOW())',
      [refreshId, safeTable, 'STARTED']
    );
    return json({ ok: true, refresh_id: refreshId });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

async function handleRefreshChunkForTable(req, env, table) {
  if (!getSyncKeyOk(req, env)) return json({ ok: false, error: 'forbidden' }, 401);
  let body;
  try { body = await readJson(req); } catch (e) { return json({ ok: false, error: e.message }, 400); }

  const safeTable = String(table || '').trim();
  const cfg = getTableConfig(safeTable);
  if (!cfg) return json({ ok: false, error: 'table_not_allowed' }, 400);

  const refreshId = norm1(body.refresh_id);
  const chunkIndex = Number(body.chunk_index);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!refreshId) return json({ ok: false, error: 'refresh_id wajib' }, 400);
  if (!Number.isFinite(chunkIndex) || chunkIndex < 0) return json({ ok: false, error: 'chunk_index invalid' }, 400);
  if (!rows.length) return json({ ok: true, inserted: 0 });

  try {
    const exists = await dbQuery(env, 'SELECT refresh_id, status FROM refresh_runs WHERE refresh_id = ? LIMIT 1', [refreshId]);
    const run = (exists.rows || [])[0];
    if (!run) return json({ ok: false, error: 'refresh_id not found' }, 404);
    if (String(run.status) === 'COMMITTED') return json({ ok: false, error: 'already committed' }, 409);

    const batchSize = 20;
    let inserted = 0;
    const cols = cfg.cols;

    const insertBatch = async (batch) => {
      const placeholders = batch.map(() => `(${cols.map(() => '?').join(',')})`).join(',');
      const sql = `INSERT INTO ${safeTable}_stage (${cols.join(',')}) VALUES ${placeholders}`;
      const params = [];
      let added = 0;

      for (const r of batch) {
        const row = r && typeof r.row === 'object' && r.row ? r.row : {};
        const sid = norm1(r.sid || row.sid);
        if (!sid) continue;

        let normalized;
        if (safeTable === 'pegawai') {
          const nip = norm1(r.nip || row.nip) || null;
          const namaPegawai = norm1(row.nama_pegawai);
          if (!namaPegawai) continue;
          normalized = normalizePegawaiRowForDb({ sid, nip, row, rowHash: r.row_hash });
        } else {
          normalized = normalizeGenericRowForDb({ table: safeTable, sid, row, rowHash: r.row_hash });
        }
        for (const c of cols) params.push(normalized[c] ?? null);
        added += 1;
      }
      if (!params.length) return 0;
      await dbQuery(env, sql, params);
      return added;
    };

    const queue = [];
    for (let i = 0; i < rows.length; i += batchSize) {
      queue.push(rows.slice(i, i + batchSize));
    }

    while (queue.length) {
      const batch = queue.shift();
      if (!batch || !batch.length) continue;
      try {
        inserted += await insertBatch(batch);
      } catch (e) {
        if (batch.length <= 1) throw e;
        const mid = Math.ceil(batch.length / 2);
        queue.unshift(batch.slice(0, mid), batch.slice(mid));
      }
    }

    await dbQuery(env,
      'UPDATE refresh_runs SET status = ?, received_row_count = received_row_count + ?, last_chunk_index = ? WHERE refresh_id = ?',
      ['RECEIVING', inserted, chunkIndex, refreshId]
    );

    await safeLog(env, { sid: null, nip: null, action: `${safeTable}:refresh-chunk`, ok: 1, message: `refresh_id=${refreshId} chunk=${chunkIndex} inserted=${inserted}`, row_hash: null });
    return json({ ok: true, inserted });
  } catch (e) {
    await safeLog(env, { sid: null, nip: null, action: `${safeTable}:refresh-chunk`, ok: 0, message: e.message, row_hash: null });
    return json({ ok: false, error: e.message }, 500);
  }
}

async function handleRefreshCommitForTable(req, env, table) {
  if (!getSyncKeyOk(req, env)) return json({ ok: false, error: 'forbidden' }, 401);
  let body;
  try { body = await readJson(req); } catch (e) { return json({ ok: false, error: e.message }, 400); }

  const safeTable = String(table || '').trim();
  const cfg = getTableConfig(safeTable);
  if (!cfg) return json({ ok: false, error: 'table_not_allowed' }, 400);

  const refreshId = norm1(body.refresh_id);
  const expected = Number(body.expected_row_count);
  if (!refreshId) return json({ ok: false, error: 'refresh_id wajib' }, 400);
  if (!Number.isFinite(expected) || expected < 0) return json({ ok: false, error: 'expected_row_count invalid' }, 400);

  const backupName = `${safeTable}_backup_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
  const stageTable = `${safeTable}_stage`;
  const newTable = `${safeTable}_new`;

  try {
    const countRes = await dbQuery(env, `SELECT COUNT(*) AS cnt FROM ${stageTable}`);
    const stageCount = Number((countRes.rows || [])[0]?.cnt || 0);
    if (stageCount !== expected) {
      return json({ ok: false, error: 'stage row count mismatch', expected, stageCount }, 409);
    }

    const dupSid = await dbQuery(env, `SELECT sid, COUNT(*) c FROM ${stageTable} GROUP BY sid HAVING c > 1 LIMIT 1`);
    if ((dupSid.rows || []).length) return json({ ok: false, error: 'duplicate SID in stage', sid: dupSid.rows[0].sid }, 409);

    if (safeTable === 'pegawai') {
      const dupNip = await dbQuery(env, `SELECT nip, COUNT(*) c FROM ${stageTable} WHERE nip IS NOT NULL AND nip <> '' GROUP BY nip HAVING c > 1 LIMIT 1`);
      if ((dupNip.rows || []).length) return json({ ok: false, error: 'duplicate NIP in stage', nip: dupNip.rows[0].nip }, 409);
    }

    await dbQuery(env, 'UPDATE refresh_runs SET expected_row_count = ? WHERE refresh_id = ?', [expected, refreshId]);

    await dbQuery(env, `DROP TABLE IF EXISTS ${newTable}`);
    await dbQuery(env, `CREATE TABLE ${newTable} LIKE ${safeTable}`);
    await dbQuery(env, `
      INSERT INTO ${newTable}
        (${cfg.cols.filter(c => c !== 'db_synced_at').join(',')}, db_synced_at)
      SELECT
        ${cfg.cols.filter(c => c !== 'db_synced_at').join(',')}, NOW()
      FROM ${stageTable}
    `);

    await dbQuery(env, `RENAME TABLE ${safeTable} TO ${backupName}, ${newTable} TO ${safeTable}`);
    await dbQuery(env, `TRUNCATE TABLE ${stageTable}`);
    await dbQuery(env, 'UPDATE refresh_runs SET status = ?, committed_at = NOW() WHERE refresh_id = ?', ['COMMITTED', refreshId]);

    await safeLog(env, { sid: null, nip: null, action: `${safeTable}:commit`, ok: 1, message: `refresh_id=${refreshId} committed rows=${expected}`, row_hash: null });
    return json({ ok: true, refresh_id: refreshId, committed: expected, backup_table: backupName });
  } catch (e) {
    try {
      await dbQuery(env, 'UPDATE refresh_runs SET status = ?, error = ? WHERE refresh_id = ?', ['FAILED', String(e.message || e).slice(0, 1800), refreshId]);
    } catch {}
    await safeLog(env, { sid: null, nip: null, action: `${safeTable}:commit`, ok: 0, message: e.message, row_hash: null });
    return json({ ok: false, error: e.message }, 500);
  }
}

async function handleReconcilePegawai(req, env) {
  // DB-only best-effort reconcile (Worker tidak punya akses langsung ke Spreadsheet).
  const limit = Math.max(1, Math.min(500, Number(new URL(req.url).searchParams.get('limit') || 200)));
  try {
    const missingHash = await dbQuery(env, 'SELECT sid, nip, nama FROM pegawai WHERE row_hash IS NULL OR row_hash = \'\' LIMIT ?', [limit]);
    const missingUpdatedAt = await dbQuery(env, 'SELECT sid, nip, nama FROM pegawai WHERE source_updated_at IS NULL LIMIT ?', [limit]);
    const dupNip = await dbQuery(env, "SELECT nip, COUNT(*) c FROM pegawai WHERE nip IS NOT NULL AND nip <> '' GROUP BY nip HAVING c > 1 LIMIT ?", [limit]);
    return json({
      ok: true,
      db_only: true,
      missing_hash: missingHash.rows || [],
      missing_source_updated_at: missingUpdatedAt.rows || [],
      duplicate_nip: dupNip.rows || [],
    });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}

async function safeLog(env, entry) {
  try {
    const sql = 'INSERT INTO sync_log (sid, nip, action, ok, message, row_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())';
    await dbQuery(env, sql, [
      entry.sid || null,
      entry.nip || null,
      String(entry.action || '').slice(0, 20),
      entry.ok ? 1 : 0,
      entry.message ? String(entry.message).slice(0, 1000) : null,
      entry.row_hash || null,
    ]);
  } catch {
    // ignore log failure
  }
}
