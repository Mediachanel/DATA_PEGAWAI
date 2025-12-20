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
        background: rgba(15, 23, 42, 0.38);
        backdrop-filter: blur(6px) saturate(120%);
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
        width: min(360px, calc(100% - 32px));
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), #ffffff);
        border-radius: 18px;
        padding: 18px 18px 16px;
        border: 1px solid rgba(226, 232, 240, 0.9);
        box-shadow: 0 25px 60px rgba(15, 23, 42, 0.35);
        display: grid;
        gap: 12px;
        text-align: center;
        font-family: 'Plus Jakarta Sans','Inter','Segoe UI',Arial,sans-serif;
      }
      #app-loader .app-loader-icon {
        width: 64px;
        height: 64px;
        margin: 0 auto;
        position: relative;
        display: grid;
        place-items: center;
      }
      #app-loader .app-loader-ring {
        width: 58px;
        height: 58px;
        border-radius: 50%;
        border: 3px solid rgba(94, 139, 255, 0.22);
        border-top-color: var(--accent, #5e8bff);
        border-right-color: var(--accent-2, #ff9f68);
        animation: appLoaderSpin 1s linear infinite;
      }
      #app-loader .app-loader-pulse {
        position: absolute;
        width: 14px;
        height: 14px;
        border-radius: 999px;
        background: radial-gradient(circle, var(--accent-2, #ff9f68), var(--accent, #5e8bff));
        box-shadow: 0 0 0 8px rgba(94, 139, 255, 0.12);
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
      #app-loader .app-loader-bar {
        height: 6px;
        background: #edf2ff;
        border-radius: 999px;
        overflow: hidden;
      }
      #app-loader .app-loader-bar span {
        display: block;
        height: 100%;
        width: 45%;
        background: linear-gradient(90deg, var(--accent, #5e8bff), var(--accent-2, #ff9f68));
        border-radius: inherit;
        animation: appLoaderBar 1.1s ease-in-out infinite;
      }
      @keyframes appLoaderSpin { to { transform: rotate(360deg); } }
      @keyframes appLoaderPulse {
        0%, 100% { transform: scale(0.7); opacity: 0.8; }
        50% { transform: scale(1); opacity: 1; }
      }
      @keyframes appLoaderBar {
        0% { transform: translateX(-60%); }
        50% { transform: translateX(40%); }
        100% { transform: translateX(160%); }
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
        <div class="app-loader-icon">
          <div class="app-loader-ring"></div>
          <div class="app-loader-pulse"></div>
        </div>
        <div class="app-loader-text">
          <div class="app-loader-title">${DEFAULT_TITLE}</div>
          <div class="app-loader-sub">${DEFAULT_SUB}</div>
        </div>
        <div class="app-loader-bar"><span></span></div>
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

  window.AppLoader = { show, hide, wrapFetch };
})();
