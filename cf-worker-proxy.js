// Cloudflare Worker proxy untuk Apps Script Web App.
// Set environment variables di Workers (Settings -> Variables):
// - WEB_APP_BASE: URL Apps Script Web App (/exec)
// - PROXY_KEY: nilai header X-Proxy-Key dari frontend
// - APPS_SCRIPT_KEY: API key yang diteruskan ke Apps Script via query `key`
// - CACHE_TTL: durasi cache (detik) untuk request GET list (default 30)

export default {
  async fetch(req, env, ctx) {
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    };
    const cacheTtl = Math.max(5, parseInt(env.CACHE_TTL || '30', 10));
    const cacheableActions = new Set(['list','dashboard_stats','mutasi_list','pemutusan_jf_list','bezetting_list','qna_list']);

    if (req.method === 'OPTIONS') {
      return new Response('', { status: 204, headers: corsHeaders });
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

    const url = new URL(req.url);
    const action = (url.searchParams.get('action') || '').toLowerCase();
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
