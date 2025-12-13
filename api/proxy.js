// Vercel Serverless Function sebagai proxy ke Apps Script / Sheets API.
// Set env WEB_APP_BASE ke URL Apps Script (mis. https://script.google.com/macros/s/xxx/exec).

export default async function handler(req, res) {
  const base = process.env.WEB_APP_BASE;
  if (!base) return res.status(500).json({ ok: false, error: 'WEB_APP_BASE not set' });

  // Teruskan path/query setelah /api/proxy ke target
  const target = base + req.url.replace(/^\/api\/proxy/, '');
  const init = {
    method: req.method,
    headers: {}
  };

  const ct = req.headers['content-type'];
  if (ct) init.headers['content-type'] = ct;

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    // Vercel sudah mem-parse req.body jika JSON; kirim ulang sebagai string/plain
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  }

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    return res.status(204).end();
  }

  try {
    const upstream = await fetch(target, init);
    const text = await upstream.text();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.status(upstream.status).send(text);
  } catch (err) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    return res.status(500).json({ ok: false, error: err.message });
  }
}
