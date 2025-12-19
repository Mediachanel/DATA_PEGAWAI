// Cloudflare Worker proxy untuk Apps Script Web App.
// Set environment variables di Workers (Settings -> Variables):
// - WEB_APP_BASE: URL Apps Script Web App (/exec)
// - PROXY_KEY: nilai header X-Proxy-Key dari frontend
// - APPS_SCRIPT_KEY: API key yang diteruskan ke Apps Script via query `key`

export default {
  async fetch(req, env) {
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    };

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
    return new Response(text, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        ...corsHeaders,
      },
    });
  },
};
