/**
 * SAKURA STREAM — Video Player
 * Soporte para iframes normales + extracción de video desde AON vía proxy CORS
 * Reproducción directa con HLS.js cuando el sitio bloquea iframes
 */

const Player = (() => {

  let _state = {
    animeId:      null,
    animeTitle:   null,
    slug:         null,
    aonSlug:      null,
    currentEp:    1,
    totalEps:     null,
    activeServer: 0,
    activeLang:   'sub',
    episodes:     [],
    _hlsInstance: null,
  };

  // Servidores que requieren extracción (no aceptan iframe directo)
  const EXTRACT_SERVERS = ['aon'];

  function _needsExtraction(serverIdx) {
    const name = (CONFIG.embedServers[serverIdx]?.name || '').toLowerCase();
    return EXTRACT_SERVERS.some(k => name.includes(k));
  }

  // ─── INIT ──────────────────────────────────────────────────
  function init(params) {
    _state = { ..._state, ...params };
    _renderServerButtons();
    _renderLangToggle();
    loadEpisode(_state.currentEp, _state.activeServer);
  }

  // ─── LOAD EPISODE ──────────────────────────────────────────
  function loadEpisode(epNum, serverIdx = _state.activeServer) {
    _state.currentEp    = epNum;
    _state.activeServer = serverIdx;

    const wrapper = document.getElementById('playerWrapper');
    if (!wrapper) return;

    const slug = _state.slug;

    if (_needsExtraction(serverIdx)) {
      _loadAONEpisode(epNum);
    } else {
      const embedUrl = CONFIG.getEmbedUrl(serverIdx, slug, epNum);
      if (embedUrl && slug) {
        _showIframe(embedUrl);
      } else {
        _showNoSlugMessage();
      }
    }

    _updateSidebarActive(epNum);
    _updateNavButtons();
    _markWatched(epNum);
    _saveHistory(epNum);
    _updateUrl(epNum);
  }

  // ─── IFRAME NORMAL ─────────────────────────────────────────
  function _showIframe(embedUrl) {
    _destroyHLS();
    const wrapper = document.getElementById('playerWrapper');
    const ph      = document.getElementById('playerPlaceholder');
    if (ph) ph.style.display = 'none';

    // Ocultar video directo si existía
    const video = document.getElementById('playerVideo');
    if (video) { video.pause(); video.src = ''; video.style.display = 'none'; }

    let iframe = document.getElementById('playerFrame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id              = 'playerFrame';
      iframe.allowFullscreen = true;
      iframe.allow           = 'autoplay; fullscreen; picture-in-picture';
      iframe.style.cssText   = 'width:100%;height:100%;border:none;display:block';
      wrapper.appendChild(iframe);
    } else {
      iframe.style.display = 'block';
    }
    iframe.src = embedUrl;
  }

  // ─── SIN SLUG ──────────────────────────────────────────────
  function _showNoSlugMessage() {
    _destroyHLS();
    _hideIframe();
    _showPlaceholder(`
      <div class="player-placeholder-icon">⚠️</div>
      <p style="color:var(--text-secondary);text-align:center;max-width:320px;font-size:0.9rem">
        Sin slug configurado.<br>
        <span style="font-size:0.8rem;color:var(--text-muted)">Configúralo en Admin → AON Slugs</span>
      </p>
      <div id="streamingLinks" style="display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:center;margin-top:1rem"></div>
    `);
    _loadStreamingLinks();
  }

  // ─── EXTRACCIÓN DE VIDEO DESDE AON ─────────────────────────
  async function _loadAONEpisode(epNum) {
    _destroyHLS();
    _hideIframe();

    const aonSlug = _state.aonSlug || _state.slug;
    if (!aonSlug) { _showNoSlugMessage(); return; }

    // Spinner de carga
    _showPlaceholder(`
      <div class="spinner" style="width:36px;height:36px;border-width:3px;margin:0 auto"></div>
      <p style="color:var(--text-secondary);margin-top:1rem;font-size:0.9rem">Cargando episodio...</p>
      <p style="color:var(--text-muted);font-size:0.75rem;font-family:var(--font-mono);margin-top:0.25rem">
        Extrayendo fuente de video...
      </p>
    `);

    // Intentar múltiples patrones de URL
    const urlPatterns = [
      `${CONFIG.aonBase}/episodio/${aonSlug}-${epNum}/`,
      `${CONFIG.aonBase}/episodio/${aonSlug}-episodio-${epNum}/`,
      `${CONFIG.aonBase}/${aonSlug}-${epNum}/`,
      `${CONFIG.aonBase}/ver/${aonSlug}-${epNum}/`,
    ];

    let lastError = null;
    for (const pageUrl of urlPatterns) {
      try {
        UI.toast('Buscando fuente de video...', 'info', 2500);
        const result = await _extractVideoFromPage(pageUrl);

        if (result.type === 'hls' || result.type === 'mp4') {
          _playDirectVideo(result.url, result.type);
          return;
        } else if (result.type === 'iframe') {
          _showIframe(result.url);
          return;
        }
      } catch (err) {
        lastError = err;
        console.warn(`[Player] Failed for ${pageUrl}:`, err.message);
      }
    }

    console.error('[Player] All patterns failed:', lastError);
    _showExtractionError(epNum, aonSlug);
  }

  // ─── EXTRACTOR DE VIDEO ────────────────────────────────────
  async function _extractVideoFromPage(pageUrl) {
    const proxy = CONFIG.corsProxy;
    const res   = await fetch(proxy + encodeURIComponent(pageUrl));
    if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
    const html  = await res.text();

    if (html.length < 200) throw new Error('Respuesta vacía del proxy');

    // Patrones para encontrar m3u8
    const m3u8Patterns = [
      /['"]file['"]\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i,
      /source\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i,
      /(?:src|file)\s*[=:]\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i,
      /(https?:\/\/[^\s'"<>\\]+\.m3u8[^\s'"<>\\]*)/i,
      /['"]hls['"]\s*:\s*['"]([^'"]+)['"]/i,
    ];
    for (const pat of m3u8Patterns) {
      const m = html.match(pat);
      if (m?.[1]) {
        let url = m[1].replace(/\\/g, '').replace(/&amp;/g, '&');
        if (url.startsWith('//')) url = 'https:' + url;
        if (url.startsWith('http')) return { type: 'hls', url };
      }
    }

    // Patrones para mp4
    const mp4Patterns = [
      /['"]file['"]\s*:\s*['"]([^'"]+\.mp4[^'"]*)['"]/i,
      /(https?:\/\/[^\s'"<>\\]+\.mp4[^\s'"<>\\]*)/i,
    ];
    for (const pat of mp4Patterns) {
      const m = html.match(pat);
      if (m?.[1]) {
        let url = m[1].replace(/\\/g, '').replace(/&amp;/g, '&');
        if (url.startsWith('//')) url = 'https:' + url;
        if (url.startsWith('http')) return { type: 'mp4', url };
      }
    }

    // Buscar iframe del player en el DOM
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const iframeSelectors = [
      '.video-player iframe', '.player-container iframe',
      '#player iframe', '.embed-responsive iframe',
      'iframe[src*="fembed"]', 'iframe[src*="streamtape"]',
      'iframe[src*="dood"]', 'iframe[src*="watchsb"]',
      'iframe[src*="okru"]', 'iframe[src*="ok.ru"]',
      'iframe[src*="mp4upload"]', 'iframe[src*="filemoon"]',
      'iframe[src*="voe.sx"]', 'iframe[allowfullscreen]',
    ];

    for (const sel of iframeSelectors) {
      const el = doc.querySelector(sel);
      if (el) {
        let src = el.getAttribute('src') || el.getAttribute('data-src') || '';
        if (src.startsWith('//')) src = 'https:' + src;
        if (src.startsWith('http') && !src.includes('google') && !src.includes('facebook')) {
          // Intentar extraer video del iframe interno también
          try {
            const inner = await _extractVideoFromPage(src);
            if (inner.type !== 'iframe') return inner;
          } catch {}
          return { type: 'iframe', url: src };
        }
      }
    }

    // Buscar en scripts inline (JWPlayer, Plyr, etc.)
    const scripts = Array.from(doc.querySelectorAll('script:not([src])'));
    for (const s of scripts) {
      const txt = s.textContent;

      // JWPlayer
      const jwMatch = txt.match(/\.setup\s*\(\s*\{([\s\S]+?)\}\s*\)/);
      if (jwMatch) {
        const fileMatch = jwMatch[1].match(/['"]file['"]\s*:\s*['"]([^'"]+)['"]/);
        if (fileMatch?.[1]) {
          let url = fileMatch[1].replace(/\\/g, '');
          if (url.startsWith('//')) url = 'https:' + url;
          if (url.startsWith('http')) {
            return { type: url.includes('.m3u8') ? 'hls' : 'mp4', url };
          }
        }
      }

      // Cualquier URL de stream en el script
      const streamMatch = txt.match(/https?:\/\/[^\s'"<>\\]+(?:\.m3u8|\.mp4)[^\s'"<>\\]*/i);
      if (streamMatch?.[0]) return { type: streamMatch[0].includes('.m3u8') ? 'hls' : 'mp4', url: streamMatch[0] };
    }

    throw new Error('No se encontró fuente de video en la página');
  }

  // ─── REPRODUCIR CON HLS.JS ─────────────────────────────────
  function _playDirectVideo(url, type) {
    const wrapper = document.getElementById('playerWrapper');
    const ph      = document.getElementById('playerPlaceholder');
    if (ph) ph.style.display = 'none';

    // Asegurarnos de que HLS.js esté cargado
    if (type === 'hls' && !window.Hls) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.7/hls.min.js';
      script.onload = () => _playDirectVideo(url, type);
      document.head.appendChild(script);
      return;
    }

    let video = document.getElementById('playerVideo');
    if (!video) {
      video = document.createElement('video');
      video.id = 'playerVideo';
      video.controls = true;
      video.autoplay = true;
      video.style.cssText = 'width:100%;height:100%;background:#000;display:block;outline:none';
      video.setAttribute('playsinline', '');
      // Controles personalizados básicos
      video.setAttribute('controlsList', 'nodownload');
      wrapper.appendChild(video);
    } else {
      video.style.display = 'block';
    }

    _destroyHLS();

    if (type === 'hls' && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, backBufferLength: 60 });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) UI.toast('Error en la reproducción', 'error');
      });
      _state._hlsInstance = hls;

    } else if (type === 'hls' && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari: HLS nativo
      video.src = url;
      video.play().catch(() => {});

    } else if (type === 'mp4') {
      video.src = url;
      video.play().catch(() => {});

    } else {
      UI.toast('Tu navegador no soporta este formato. Prueba Chrome.', 'error');
      return;
    }

    UI.toast('¡Reproduciendo!', 'success', 1800);
  }

  function _destroyHLS() {
    if (_state._hlsInstance) {
      try { _state._hlsInstance.destroy(); } catch {}
      _state._hlsInstance = null;
    }
  }

  function _hideIframe() {
    const iframe = document.getElementById('playerFrame');
    if (iframe) { iframe.style.display = 'none'; iframe.src = 'about:blank'; }
    const video = document.getElementById('playerVideo');
    if (video) { video.pause(); video.src = ''; video.style.display = 'none'; }
  }

  // ─── PLACEHOLDER ───────────────────────────────────────────
  function _showPlaceholder(html) {
    const wrapper = document.getElementById('playerWrapper');
    let ph = document.getElementById('playerPlaceholder');
    if (!ph) {
      ph = document.createElement('div');
      ph.id        = 'playerPlaceholder';
      ph.className = 'player-placeholder';
      wrapper.appendChild(ph);
    }
    ph.style.display = 'flex';
    ph.innerHTML     = html;
  }

  // ─── ERROR DE EXTRACCIÓN ───────────────────────────────────
  function _showExtractionError(epNum, aonSlug) {
    _showPlaceholder(`
      <div style="text-align:center;max-width:400px;padding:1rem">
        <div style="font-size:3rem;margin-bottom:0.75rem">😵</div>
        <h3 style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;margin-bottom:0.5rem">
          No se pudo extraer el video
        </h3>
        <p style="color:var(--text-secondary);font-size:0.84rem;line-height:1.6;margin-bottom:1rem">
          El slug <code style="background:var(--bg-surface);padding:1px 5px;border-radius:4px;font-size:0.8rem">${aonSlug}</code>
          puede ser incorrecto o el sitio cambió su estructura.
        </p>
        <button class="btn btn-primary" style="margin-bottom:0.75rem;width:100%;justify-content:center"
          onclick="Player._retryAON()">↺ Reintentar</button>
        <div style="display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:center;margin-bottom:0.75rem">
          ${CONFIG.embedServers.map((s, i) => {
            if (_needsExtraction(i)) return '';
            const u = CONFIG.getEmbedUrl(i, _state.slug, epNum);
            if (!u || !_state.slug) return '';
            return `<button class="btn btn-ghost btn-sm" onclick="Player.switchServer(${i})">${s.icon} ${s.name}</button>`;
          }).join('')}
        </div>
        <div id="streamingLinks" style="display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:center"></div>
      </div>
    `);
    _loadStreamingLinks();
  }

  function _retryAON() {
    loadEpisode(_state.currentEp, _state.activeServer);
  }

  // ─── STREAMING LINKS ───────────────────────────────────────
  async function _loadStreamingLinks(containerId = 'streamingLinks') {
    const el = document.getElementById(containerId);
    if (!el || !_state.animeId) return;
    try {
      const data  = await API.getAnimeStreaming(_state.animeId);
      const links = data.data || [];
      if (!links.length) return;
      el.innerHTML = links.slice(0, 4).map(l => `
        <a href="${l.url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
          ${l.name}
        </a>`).join('');
    } catch {}
  }

  // ─── SERVER BUTTONS ────────────────────────────────────────
  function _renderServerButtons() {
    const container = document.getElementById('serverSelector');
    if (!container) return;
    container.innerHTML = CONFIG.embedServers.map((s, i) => `
      <button
        class="server-btn${i === _state.activeServer ? ' active' : ''}"
        onclick="Player.switchServer(${i})"
        title="Cambiar a ${s.name}"
      >${s.icon} ${s.name}</button>
    `).join('');
  }

  function _renderLangToggle() {
    const container = document.getElementById('langToggle');
    if (!container) return;
    ['sub', 'dub'].forEach(lang => {
      const btn = container.querySelector(`[data-lang="${lang}"]`);
      if (btn) btn.classList.toggle('active', lang === _state.activeLang);
    });
  }

  function switchServer(serverIdx) {
    _state.activeServer = serverIdx;
    document.querySelectorAll('.server-btn').forEach((b, i) => b.classList.toggle('active', i === serverIdx));
    loadEpisode(_state.currentEp, serverIdx);
    UI.toast(`Servidor: ${CONFIG.embedServers[serverIdx]?.name}`, 'info', 1800);
  }

  function switchLang(lang) {
    _state.activeLang = lang;
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
    const idx = CONFIG.embedServers.findIndex(s => s.lang === lang);
    if (idx >= 0) switchServer(idx);
  }

  function nextEpisode() {
    if (_state.totalEps && _state.currentEp >= _state.totalEps) { UI.toast('Ya estás en el último episodio 🎉', 'info'); return; }
    loadEpisode(_state.currentEp + 1);
  }

  function prevEpisode() {
    if (_state.currentEp <= 1) { UI.toast('Ya estás en el primer episodio', 'info'); return; }
    loadEpisode(_state.currentEp - 1);
  }

  function toggleFullscreen() {
    const wrapper = document.getElementById('playerWrapper');
    if (!wrapper) return;
    if (!document.fullscreenElement) wrapper.requestFullscreen().catch(() => UI.toast('No se pudo activar pantalla completa', 'error'));
    else document.exitFullscreen();
  }

  function renderEpisodeSidebar(episodes, containerId = 'episodeSidebar') {
    _state.episodes = episodes;
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = episodes.map(ep => {
      const epNum  = ep.mal_id || ep.episode_id;
      const watched = Favorites.isWatched(_state.animeId, epNum);
      return `
        <div class="sidebar-ep-item${epNum === _state.currentEp ? ' active' : ''}${watched ? ' watched' : ''}"
             id="sidebar-ep-${epNum}" onclick="Player.loadEpisode(${epNum})">
          <span class="sidebar-ep-num">${epNum}</span>
          <span class="sidebar-ep-title">${ep.title ? escapeHtml(ep.title) : `Episodio ${epNum}`}</span>
          ${watched ? '<span class="watched-dot" title="Visto"></span>' : ''}
        </div>`;
    }).join('');
  }

  function _updateSidebarActive(epNum) {
    document.querySelectorAll('.sidebar-ep-item').forEach(el => el.classList.remove('active'));
    const active = document.getElementById(`sidebar-ep-${epNum}`);
    if (active) { active.classList.add('active'); active.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }

  function _updateNavButtons() {
    const prevBtn = document.getElementById('prevEpBtn');
    const nextBtn = document.getElementById('nextEpBtn');
    if (prevBtn) prevBtn.disabled = _state.currentEp <= 1;
    if (nextBtn) nextBtn.disabled = !!(_state.totalEps && _state.currentEp >= _state.totalEps);
    const titleEl = document.getElementById('currentEpTitle');
    if (titleEl) {
      const ep = _state.episodes.find(e => (e.mal_id || e.episode_id) === _state.currentEp);
      titleEl.textContent = ep?.title ? `Ep ${_state.currentEp}: ${ep.title}` : `Episodio ${_state.currentEp}`;
    }
  }

  function _markWatched(epNum) {
    const el = document.getElementById(`sidebar-ep-${epNum}`);
    if (el) {
      el.classList.add('watched');
      if (!el.querySelector('.watched-dot')) el.insertAdjacentHTML('beforeend', '<span class="watched-dot"></span>');
    }
  }

  function _saveHistory(epNum) {
    if (!_state.animeId || !_state.animeTitle) return;
    const ep = _state.episodes.find(e => (e.mal_id || e.episode_id) === epNum);
    Favorites.addToHistory(
      { mal_id: _state.animeId, title: _state.animeTitle, slug: _state.slug, episodes: _state.totalEps },
      epNum, ep?.title || ''
    );
  }

  function _updateUrl(epNum) {
    const url = new URL(window.location.href);
    url.searchParams.set('ep', epNum);
    history.replaceState(null, '', url.toString());
  }

  function initKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === 'n') nextEpisode();
      if (e.key === 'ArrowLeft'  || e.key === 'p') prevEpisode();
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    });
  }

  return {
    init, loadEpisode, switchServer, switchLang,
    nextEpisode, prevEpisode, toggleFullscreen,
    renderEpisodeSidebar, initKeyboard,
    _retryAON,
  };
})();
