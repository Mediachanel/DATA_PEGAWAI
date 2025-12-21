(() => {
  if (window.AppLoader) return;

  const DEFAULT_TITLE = 'Memuat data';
  const DEFAULT_SUB = 'Harap tunggu sebentar.';
  const SHOW_DELAY = 180;
  const MIN_VISIBLE = 280;
  const state = {
    count: 0,
    showTimer: null,
    hideTimer: null,
    overlay: null,
    styleReady: false,
    fetchWrapped: false,
    apiBase: '',
    shownAt: 0,
    lastMessage: ''
  };

  const ensureStyle = () => {
    if (state.styleReady) return;
    const style = document.createElement('style');
    style.id = 'app-loader-style';
    style.textContent = `
      body.app-loading { overflow: hidden; }
      #app-loader {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at 10% 20%, rgba(94, 139, 255, 0.18), transparent 35%),
          radial-gradient(circle at 80% 0%, rgba(255, 159, 104, 0.22), transparent 40%),
          rgba(15, 23, 42, 0.4);
        backdrop-filter: blur(8px) saturate(130%);
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 0.2s ease, visibility 0.2s ease;
        z-index: 9999;
      }
      #app-loader.show {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }
      #app-loader .app-loader-card {
        width: min(420px, calc(100% - 32px));
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), #ffffff);
        border-radius: 20px;
        padding: 16px 18px 18px;
        border: 1px solid rgba(226, 232, 240, 0.9);
        box-shadow: 0 30px 70px rgba(15, 23, 42, 0.35);
        display: grid;
        gap: 14px;
        text-align: left;
        font-family: 'Plus Jakarta Sans','Inter','Segoe UI',Arial,sans-serif;
      }
      #app-loader .app-loader-top {
        height: 6px;
        border-radius: 999px;
        background: linear-gradient(90deg, var(--accent, #5e8bff), var(--accent-2, #ff9f68));
        box-shadow: 0 8px 16px rgba(94, 139, 255, 0.3);
      }
      #app-loader .app-loader-body {
        display: grid;
        grid-template-columns: 72px 1fr;
        gap: 12px;
        align-items: center;
      }
      #app-loader .app-loader-orbit {
        width: 64px;
        height: 64px;
        position: relative;
        display: grid;
        place-items: center;
      }
      #app-loader .app-loader-orbit::before {
        content: '';
        position: absolute;
        inset: 6px;
        border-radius: 50%;
        border: 2px dashed rgba(94, 139, 255, 0.35);
        animation: appLoaderSpin 2.4s linear infinite;
      }
      #app-loader .app-loader-orbit::after {
        content: '';
        position: absolute;
        inset: 14px;
        border-radius: 50%;
        border: 3px solid rgba(255, 159, 104, 0.25);
        border-top-color: var(--accent-2, #ff9f68);
        border-right-color: var(--accent, #5e8bff);
        animation: appLoaderSpin 1.2s linear infinite reverse;
      }
      #app-loader .app-loader-core {
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: radial-gradient(circle, var(--accent-2, #ff9f68), var(--accent, #5e8bff));
        box-shadow: 0 0 0 10px rgba(94, 139, 255, 0.12);
        animation: appLoaderPulse 1.2s ease-in-out infinite;
      }
      #app-loader .app-loader-title {
        font-weight: 800;
        color: #0f172a;
        font-size: 16px;
      }
      #app-loader .app-loader-sub {
        font-size: 12px;
        color: #64748b;
      }
      #app-loader .app-loader-skeleton {
        display: grid;
        gap: 8px;
      }
      #app-loader .app-loader-line {
        height: 10px;
        border-radius: 999px;
        background: linear-gradient(90deg, #eef2f7 25%, #dbe4f3 37%, #eef2f7 63%);
        background-size: 200% 100%;
        animation: appLoaderShimmer 1.2s ease-in-out infinite;
      }
      #app-loader .app-loader-line:nth-child(2) { width: 88%; }
      #app-loader .app-loader-line:nth-child(3) { width: 72%; }
      @keyframes appLoaderSpin { to { transform: rotate(360deg); } }
      @keyframes appLoaderPulse {
        0%, 100% { transform: scale(0.7); opacity: 0.8; }
        50% { transform: scale(1); opacity: 1; }
      }
      @keyframes appLoaderShimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      @media (max-width: 600px) {
        #app-loader .app-loader-card { width: calc(100% - 24px); }
      }
    `;
    document.head.appendChild(style);
    state.styleReady = true;
  };

  const ensureOverlay = () => {
    if (state.overlay) return state.overlay;
    if (!document.body) return null;
    ensureStyle();
    const overlay = document.createElement('div');
    overlay.id = 'app-loader';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="app-loader-card" role="status" aria-live="polite">
        <div class="app-loader-top"></div>
        <div class="app-loader-body">
          <div class="app-loader-orbit">
            <div class="app-loader-core"></div>
          </div>
          <div class="app-loader-text">
            <div class="app-loader-title">${DEFAULT_TITLE}</div>
            <div class="app-loader-sub">${DEFAULT_SUB}</div>
          </div>
        </div>
        <div class="app-loader-skeleton">
          <div class="app-loader-line"></div>
          <div class="app-loader-line"></div>
          <div class="app-loader-line"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    state.overlay = overlay;
    return overlay;
  };

  const setVisible = (visible) => {
    const overlay = ensureOverlay();
    if (!overlay) return;
    overlay.classList.toggle('show', visible);
    overlay.setAttribute('aria-hidden', visible ? 'false' : 'true');
    document.body.classList.toggle('app-loading', visible);
  };

  const show = (message) => {
    const overlay = ensureOverlay();
    if (!overlay) return;
    const titleEl = overlay.querySelector('.app-loader-title');
    const subEl = overlay.querySelector('.app-loader-sub');
    if (titleEl) titleEl.textContent = DEFAULT_TITLE;
    if (subEl) subEl.textContent = message || DEFAULT_SUB;
    setVisible(true);
  };

  const hide = () => setVisible(false);

  const scheduleShow = () => {
    if (state.showTimer) return;
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }
    state.showTimer = setTimeout(() => {
      state.showTimer = null;
      if (state.count > 0) {
        show(state.lastMessage);
        state.shownAt = Date.now();
      }
    }, SHOW_DELAY);
  };

  const scheduleHide = () => {
    if (state.showTimer) {
      clearTimeout(state.showTimer);
      state.showTimer = null;
    }
    const elapsed = Date.now() - state.shownAt;
    const remaining = Math.max(0, MIN_VISIBLE - elapsed);
    if (state.hideTimer) clearTimeout(state.hideTimer);
    state.hideTimer = setTimeout(() => {
      state.hideTimer = null;
      hide();
    }, remaining);
  };

  const start = (message) => {
    state.count += 1;
    if (message) state.lastMessage = message;
    if (state.count === 1) scheduleShow();
  };

  const done = () => {
    state.count = Math.max(0, state.count - 1);
    if (state.count === 0) scheduleHide();
  };

  const getUrl = (input) => {
    if (!input) return '';
    if (typeof input === 'string') return input;
    if (input && typeof input.href === 'string') return input.href;
    if (input && typeof input.url === 'string') return input.url;
    return '';
  };

  const isApiRequest = (url) => {
    if (!url) return false;
    const target = String(url);
    if (state.apiBase && target.indexOf(state.apiBase) === 0) return true;
    if (state.apiBase && target.includes(state.apiBase)) return true;
    return target.includes('action=');
  };

  const wrapFetch = (apiBase) => {
    if (apiBase) state.apiBase = apiBase;
    if (state.fetchWrapped) return;
    if (typeof window.fetch !== 'function') return;
    const originalFetch = window.fetch.bind(window);
    state.fetchWrapped = true;
    window.fetch = (input, init) => {
      const url = getUrl(input);
      if (!isApiRequest(url)) return originalFetch(input, init);
      start();
      return originalFetch(input, init).then(
        (response) => {
          done();
          return response;
        },
        (error) => {
          done();
          throw error;
        }
      );
    };
  };

  const initIdleLogout = () => {
    let idleTimer = null;
    const authUser = (() => {
      try { return JSON.parse(localStorage.getItem('authUser') || 'null'); } catch { return null; }
    })();
    if (!authUser) return;
    const base = (() => {
      const parts = location.pathname.split('/').filter(Boolean);
      return parts.length && parts[0].toUpperCase() === 'DATA_PEGAWAI' ? '/' + parts[0] + '/' : '/';
    })();
    const IDLE_MS = 10 * 60 * 1000;
    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        try { localStorage.removeItem('authUser'); } catch (_) { /* ignore */ }
        window.location.href = base;
      }, IDLE_MS);
    };
    ['click','keydown','mousemove','scroll','touchstart','focus'].forEach((ev) => {
      document.addEventListener(ev, resetIdle, { passive: true });
    });
    resetIdle();
  };

  initIdleLogout();

  window.AppLoader = { show, hide, wrapFetch };
})();
