/**
 * SAKURA STREAM — Video Player
 * Gestión del reproductor de video con iframe embeds y selección de servidor
 */

const Player = (() => {
  let _state = {
    animeId:    null,
    animeTitle: null,
    slug:       null,
    currentEp:  1,
    totalEps:   null,
    activeServer: 0,
    activeLang:   'sub',
    episodes:    [],
  };

  // ─── INIT ─────────────────────────────────────────────────
  function init(params) {
    _state = { ..._state, ...params };
    _renderServerButtons();
    _renderLangToggle();
    loadEpisode(_state.currentEp, _state.activeServer);
  }

  // ─── LOAD EPISODE ─────────────────────────────────────────
  function loadEpisode(epNum, serverIdx = _state.activeServer) {
    _state.currentEp  = epNum;
    _state.activeServer = serverIdx;

    const wrapper = document.getElementById('playerWrapper');
    const iframe  = document.getElementById('playerFrame');
    const placeholder = document.getElementById('playerPlaceholder');

    if (!wrapper) return;

    const slug = _state.slug;
    const embedUrl = CONFIG.getEmbedUrl(serverIdx, slug, epNum);

    if (embedUrl && slug) {
      if (placeholder) placeholder.style.display = 'none';
      if (!iframe) {
        const frame = document.createElement('iframe');
        frame.id = 'playerFrame';
        frame.allowFullscreen = true;
        frame.allow = 'autoplay; fullscreen; picture-in-picture';
        frame.style.cssText = 'width:100%;height:100%;border:none';
        frame.src = embedUrl;
        wrapper.appendChild(frame);
      } else {
        iframe.src = embedUrl;
      }
    } else {
      // Sin slug: mostrar placeholder con links externos
      if (iframe) iframe.remove();
      if (placeholder) {
        placeholder.style.display = 'flex';
        placeholder.innerHTML = `
          <div class="player-placeholder-icon">▶</div>
          <p style="color:var(--text-secondary);font-size:0.95rem;text-align:center;max-width:400px">
            Configura el slug del anime en la URL o usa los links de streaming oficial
          </p>
          <div id="streamingLinks" style="display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:center;margin-top:1rem"></div>
        `;
        _loadStreamingLinks();
      }
    }

    // Actualizar sidebar
    _updateSidebarActive(epNum);
    // Actualizar botones nav
    _updateNavButtons();
    // Marcar como visto
    _markWatched(epNum);
    // Historial
    _saveHistory(epNum);
    // Actualizar URL
    _updateUrl(epNum);
  }

  // ─── STREAMING LINKS FALLBACK ────────────────────────────
  async function _loadStreamingLinks() {
    const el = document.getElementById('streamingLinks');
    if (!el || !_state.animeId) return;
    try {
      const data = await API.getAnimeStreaming(_state.animeId);
      const links = data.data || [];
      if (links.length) {
        el.innerHTML = links.map(l => `
          <a href="${l.url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
            ${l.name}
          </a>
        `).join('');
      }
    } catch (e) { console.warn('No streaming links'); }
  }

  // ─── SERVER BUTTONS ──────────────────────────────────────
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

  // ─── LANG TOGGLE ─────────────────────────────────────────
  function _renderLangToggle() {
    const container = document.getElementById('langToggle');
    if (!container) return;
    ['sub', 'dub'].forEach(lang => {
      const btn = container.querySelector(`[data-lang="${lang}"]`);
      if (btn) btn.classList.toggle('active', lang === _state.activeLang);
    });
  }

  // ─── SWITCH SERVER ────────────────────────────────────────
  function switchServer(serverIdx) {
    _state.activeServer = serverIdx;
    document.querySelectorAll('.server-btn').forEach((b, i) => {
      b.classList.toggle('active', i === serverIdx);
    });
    loadEpisode(_state.currentEp, serverIdx);
    UI.toast(`Cambiando a ${CONFIG.embedServers[serverIdx]?.name}...`, 'info', 2000);
  }

  // ─── SWITCH LANG ─────────────────────────────────────────
  function switchLang(lang) {
    _state.activeLang = lang;
    document.querySelectorAll('.lang-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === lang);
    });
    // Buscar primer servidor con ese idioma
    const idx = CONFIG.embedServers.findIndex(s => s.lang === lang);
    if (idx >= 0) switchServer(idx);
  }

  // ─── NAV: SIGUIENTE / ANTERIOR ───────────────────────────
  function nextEpisode() {
    if (_state.totalEps && _state.currentEp >= _state.totalEps) {
      UI.toast('Ya estás en el último episodio 🎉', 'info');
      return;
    }
    loadEpisode(_state.currentEp + 1);
  }

  function prevEpisode() {
    if (_state.currentEp <= 1) {
      UI.toast('Ya estás en el primer episodio', 'info');
      return;
    }
    loadEpisode(_state.currentEp - 1);
  }

  // ─── FULLSCREEN ──────────────────────────────────────────
  function toggleFullscreen() {
    const wrapper = document.getElementById('playerWrapper');
    if (!wrapper) return;
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().catch(e => UI.toast('No se pudo activar pantalla completa', 'error'));
    } else {
      document.exitFullscreen();
    }
  }

  // ─── SIDEBAR ─────────────────────────────────────────────
  function renderEpisodeSidebar(episodes, containerId = 'episodeSidebar') {
    _state.episodes = episodes;
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = episodes.map(ep => {
      const epNum = ep.mal_id || ep.episode_id;
      const watched = Favorites.isWatched(_state.animeId, epNum);
      return `
        <div
          class="sidebar-ep-item${epNum === _state.currentEp ? ' active' : ''}${watched ? ' watched' : ''}"
          id="sidebar-ep-${epNum}"
          onclick="Player.loadEpisode(${epNum})"
        >
          <span class="sidebar-ep-num">${epNum}</span>
          <span class="sidebar-ep-title">${ep.title ? escapeHtml(ep.title) : `Episodio ${epNum}`}</span>
          ${watched ? '<span class="watched-dot" title="Visto"></span>' : ''}
        </div>
      `;
    }).join('');
  }

  function _updateSidebarActive(epNum) {
    document.querySelectorAll('.sidebar-ep-item').forEach(el => {
      el.classList.remove('active');
    });
    const active = document.getElementById(`sidebar-ep-${epNum}`);
    if (active) {
      active.classList.add('active');
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  // ─── NAV BUTTONS ─────────────────────────────────────────
  function _updateNavButtons() {
    const prevBtn = document.getElementById('prevEpBtn');
    const nextBtn = document.getElementById('nextEpBtn');
    if (prevBtn) prevBtn.disabled = _state.currentEp <= 1;
    if (nextBtn) nextBtn.disabled = _state.totalEps && _state.currentEp >= _state.totalEps;

    const titleEl = document.getElementById('currentEpTitle');
    if (titleEl) {
      const ep = _state.episodes.find(e => (e.mal_id || e.episode_id) === _state.currentEp);
      titleEl.textContent = ep?.title
        ? `Ep ${_state.currentEp}: ${ep.title}`
        : `Episodio ${_state.currentEp}`;
    }
  }

  // ─── HISTORY & WATCHED ───────────────────────────────────
  function _markWatched(epNum) {
    const el = document.getElementById(`sidebar-ep-${epNum}`);
    if (el) {
      el.classList.add('watched');
      if (!el.querySelector('.watched-dot')) {
        el.insertAdjacentHTML('beforeend', '<span class="watched-dot"></span>');
      }
    }
  }

  function _saveHistory(epNum) {
    if (!_state.animeId || !_state.animeTitle) return;
    const ep = _state.episodes.find(e => (e.mal_id || e.episode_id) === epNum);
    Favorites.addToHistory(
      { mal_id: _state.animeId, title: _state.animeTitle, slug: _state.slug, episodes: _state.totalEps },
      epNum,
      ep?.title || ''
    );
  }

  // ─── URL UPDATE ──────────────────────────────────────────
  function _updateUrl(epNum) {
    const url = new URL(window.location.href);
    url.searchParams.set('ep', epNum);
    history.replaceState(null, '', url.toString());
  }

  // ─── KEYBOARD SHORTCUTS ──────────────────────────────────
  function initKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === 'n') nextEpisode();
      if (e.key === 'ArrowLeft'  || e.key === 'p') prevEpisode();
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    });
  }

  return {
    init,
    loadEpisode,
    switchServer,
    switchLang,
    nextEpisode,
    prevEpisode,
    toggleFullscreen,
    renderEpisodeSidebar,
    initKeyboard,
  };
})();
