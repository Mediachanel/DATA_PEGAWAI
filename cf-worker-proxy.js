// Cloudflare Worker proxy untuk Apps Script Web App
// Set environment variable di Workers (Settings -> Variables):
// WEB_APP_BASE = https://script.google.com/macros/s/AKfycbxpYfK6Q2_GQzMM0_sTD7ts_SMz2z8aMa-pDd_WfGfuCLagwxf-UjNJDyV1TTLIk0AKxQ/exec

export default {
  async fetch(req, env) {
    const base = env.WEB_APP_BASE;
    if (!base) return new Response('WEB_APP_BASE not set', { status: 500 });
    const url = new URL(req.url);
    // Teruskan path/query ke Apps Script (opsional hapus prefix /api)
    const baseClean = base.replace(/\/$/, '');
    const path = url.pathname.replace(/^\/api/, '') || '/';
    const target = baseClean + path + url.search;
    const init = { method: req.method, headers: {}, redirect: 'follow' };
    // Salin content-type saja; header lain optional
    const ct = req.headers.get('content-type');
    if (ct) init.headers['content-type'] = ct;
    if (!['GET', 'HEAD'].includes(req.method)) {
      init.body = await req.arrayBuffer();
    }

    // Tangani preflight OPTIONS agar browser tidak blok
    if (req.method === 'OPTIONS') {
      return new Response('', {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
      });
    }

    const upstream = await fetch(target, init);
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
      },
    });
  },
};
