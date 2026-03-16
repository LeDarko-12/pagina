/**
 * SAKURA STREAM — UI Components
 * Funciones de renderizado de componentes reutilizables
 */

const UI = (() => {

  // ─── TOAST NOTIFICATIONS ─────────────────────────────────
  function toast(msg, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons  = { success: '✓', error: '✕', info: 'ℹ', heart: '♥' };
    const colors = { success: 'var(--accent-green)', error: 'var(--accent-rose)', info: 'var(--accent-light)', heart: 'var(--accent-rose)' };

    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `
      <span style="color:${colors[type]};font-size:1.1rem">${icons[type] || icons.info}</span>
      <span>${msg}</span>
    `;
    container.appendChild(el);
    setTimeout(() => { el.classList.add('hiding'); setTimeout(() => el.remove(), 300); }, duration);
  }

  // ─── SKELETON LOADERS ────────────────────────────────────
  function renderSkeletonCards(count = 6, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = Array.from({ length: count }, () => `
      <div class="skeleton-card">
        <div class="skeleton-card-thumb skeleton"></div>
        <div style="padding:0.75rem">
          <div class="skeleton skeleton-line" style="width:90%"></div>
          <div class="skeleton skeleton-line" style="width:60%"></div>
        </div>
      </div>
    `).join('');
  }

  function renderSkeletonEpCards(count = 5, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = Array.from({ length: count }, () => `
      <div class="ep-card" style="pointer-events:none">
        <div class="skeleton ep-thumb" style="height:68px;width:120px;border-radius:6px"></div>
        <div style="flex:1">
          <div class="skeleton skeleton-line" style="width:30%"></div>
          <div class="skeleton skeleton-line" style="width:80%"></div>
          <div class="skeleton skeleton-line" style="width:60%"></div>
        </div>
      </div>
    `).join('');
  }

  // ─── ANIME CARD ──────────────────────────────────────────
  function renderAnimeCard(anime, options = {}) {
    const {
      linkPrefix = 'anime.html',
      showFav    = true,
      extraClass = '',
      lazy       = true,
    } = options;

    const poster  = API.getPoster(anime);
    const isFav   = showFav && Favorites.isFavorite(anime.mal_id);
    const status  = API.getStatusBadge(anime.status);
    const watched = Favorites.getLastWatched(anime.mal_id);
    const score   = anime.score ? anime.score.toFixed(1) : null;

    return `
      <div class="anime-card ${extraClass}" onclick="window.location.href='${linkPrefix}?id=${anime.mal_id}'" data-id="${anime.mal_id}">
        <div class="anime-card-thumb">
          <img
            ${lazy ? 'loading="lazy"' : ''}
            src="${poster}"
            alt="${escapeHtml(anime.title)}"
            onerror="UI._onPosterError(this, ${anime.mal_id}, '${encodeURIComponent(anime.title)}', '${encodeURIComponent(anime.title_english || '')}')"
          >
          <div class="anime-card-overlay">
            <div class="anime-card-play">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
          ${score ? `<div class="anime-card-score"><span>★</span>${score}</div>` : ''}
          <div class="anime-card-status">
            <span class="badge ${status.cls}">${status.label}</span>
          </div>
          ${showFav ? `
          <button
            class="anime-card-fav${isFav ? ' active' : ''}"
            onclick="event.stopPropagation(); UI.toggleFavBtn(this, ${anime.mal_id})"
            title="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}"
            data-anime='${encodeURIComponent(JSON.stringify({
              mal_id: anime.mal_id, title: anime.title,
              images: anime.images, score: anime.score,
              episodes: anime.episodes, status: anime.status,
            }))}'
          >${isFav ? '♥' : '♡'}</button>` : ''}
          ${watched ? `
          <div style="position:absolute;bottom:4px;left:4px;right:4px">
            <div class="progress-bar" title="Visto hasta ep ${watched.ep}">
              <div class="progress-bar-fill" style="width:${Math.min(100, (watched.ep / (anime.episodes || watched.ep)) * 100)}%"></div>
            </div>
          </div>` : ''}
        </div>
        <div class="anime-card-body">
          <div class="anime-card-title">${escapeHtml(anime.title)}</div>
          <div class="anime-card-meta">
            ${anime.year ? `<span>${anime.year}</span><span>·</span>` : ''}
            ${anime.episodes ? `<span class="anime-card-eps">${anime.episodes} eps</span>` : ''}
            ${anime.type ? `<span>${anime.type}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // Fallback TMDB para pósters de cards
  async function _onPosterError(img, malId, title, titleEn) {
    // Evitar loop si TMDB también falla
    img.onerror = () => { img.src = 'assets/placeholder.jpg'; };
    if (!CONFIG.tmdbEnabled) { img.src = 'assets/placeholder.jpg'; return; }
    try {
      const url = await TMDB.getPoster(
        decodeURIComponent(title),
        decodeURIComponent(titleEn)
      );
      img.src = url || 'assets/placeholder.jpg';
    } catch {
      img.src = 'assets/placeholder.jpg';
    }
  }

  function toggleFavBtn(btn, malId) {
    try {
      const animeData = JSON.parse(decodeURIComponent(btn.dataset.anime));
      const added = Favorites.toggleFavorite(animeData);
      btn.textContent = added ? '♥' : '♡';
      btn.classList.toggle('active', added);
      toast(added ? 'Añadido a favoritos' : 'Eliminado de favoritos', added ? 'heart' : 'info');
    } catch (e) { console.error(e); }
  }

  // ─── RENDER GRID ─────────────────────────────────────────
  function renderAnimeGrid(animeList, containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!animeList || animeList.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><h3>No se encontraron resultados</h3></div>';
      return;
    }
    container.innerHTML = animeList.map(a => renderAnimeCard(a, options)).join('');
  }

  function renderCarousel(animeList, containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = animeList.map(a => renderAnimeCard(a, { ...options, extraClass: '' })).join('');
  }

  // ─── EPISODE CARD ────────────────────────────────────────
  /**
   * Renderiza una card de episodio.
   * @param {object} ep          Datos del episodio (desde Jikan)
   * @param {number} animeId     MAL ID del anime
   * @param {string} animeSlug   Slug para el reproductor
   * @param {string} animeTitle  Título del anime
   * @param {object} extras      { tmdbThumb, aonUrl, aonSlug }
   */
  function renderEpisodeCard(ep, animeId, animeSlug, animeTitle, extras = {}) {
    const { tmdbThumb = null, aonUrl = null, aonSlug = null } = extras;
    const watched = Favorites.isWatched(animeId, ep.mal_id || ep.episode_id);
    const epNum   = ep.mal_id || ep.episode_id;

    // Prioridad de imagen: TMDB > MAL > placeholder
    const malThumb = ep.images?.jpg?.image_url || '';
    const thumb    = tmdbThumb || malThumb || 'assets/ep-placeholder.jpg';

    // URL del episodio: incluye slug de AON si existe
    const slugParam    = aonSlug ? encodeURIComponent(aonSlug) : encodeURIComponent(animeSlug);
    const episodeHref  = `episode.html?anime=${animeId}&ep=${epNum}&slug=${slugParam}&title=${encodeURIComponent(animeTitle)}`;

    return `
      <div class="ep-card${watched ? ' watched' : ''}"
           onclick="window.location.href='${episodeHref}'"
           data-ep="${epNum}" data-anime="${animeId}">
        <div class="ep-thumb-wrapper" style="flex-shrink:0">
          <img class="ep-thumb"
               src="${thumb}"
               loading="lazy"
               alt="Ep ${epNum}"
               data-mal-thumb="${malThumb}"
               data-ep-num="${epNum}"
               data-anime-id="${animeId}"
               onerror="_epThumbFallback(this)">
          <div class="ep-thumb-play">▶</div>
        </div>
        <div style="flex:1;min-width:0">
          <div class="ep-num">Episodio ${epNum}${aonUrl ? ' <span class="badge badge-cyan" style="font-size:0.65rem;padding:1px 5px;vertical-align:middle">AON</span>' : ''}</div>
          <div class="ep-title">${ep.title ? escapeHtml(ep.title) : `Episodio ${epNum}`}</div>
          ${ep.aired ? `<div class="ep-desc">${API.formatDate(ep.aired)}</div>` : ''}
        </div>
        ${watched ? `<div class="ep-watched-badge"><span class="badge badge-green">✓ Visto</span></div>` : ''}
      </div>
    `;
  }

  // Fallback para thumbnails de episodios
  window._epThumbFallback = function(img) {
    const malThumb = img.dataset.malThumb;
    if (malThumb && img.src !== malThumb) {
      img.onerror = () => { img.src = 'assets/ep-placeholder.jpg'; };
      img.src = malThumb;
    } else {
      img.src = 'assets/ep-placeholder.jpg';
      img.onerror = null;
    }
  };

  /**
   * Actualiza las miniaturas de episodios con imágenes de TMDB
   * una vez que se han cargado de forma asíncrona.
   * @param {object} thumbMap  { epNum: imageUrl }
   * @param {string} containerId  ID del contenedor de episodios
   */
  function updateEpisodeThumbnails(thumbMap, containerId = 'episodesGrid') {
    if (!thumbMap || !Object.keys(thumbMap).length) return;
    const container = document.getElementById(containerId);
    if (!container) return;

    container.querySelectorAll('img[data-ep-num]').forEach(img => {
      const epNum = parseInt(img.dataset.epNum);
      if (thumbMap[epNum]) {
        img.src = thumbMap[epNum];
        img.onerror = () => {
          const malThumb = img.dataset.malThumb;
          img.src = malThumb || 'assets/ep-placeholder.jpg';
          img.onerror = null;
        };
      }
    });
  }

  // ─── GENRE BADGES ────────────────────────────────────────
  function renderGenreBadges(genres = []) {
    const colors = ['badge-violet','badge-cyan','badge-rose','badge-amber','badge-green'];
    return genres.map((g, i) => `
      <a href="search.html?genre=${g.mal_id}&gname=${encodeURIComponent(g.name)}" class="badge ${colors[i % colors.length]}">${g.name}</a>
    `).join('');
  }

  // ─── CONTINUE WATCHING GRID ──────────────────────────────
  function renderContinueWatching(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const list = Favorites.getContinueWatching();
    if (list.length === 0) { container.closest('section')?.remove(); return; }
    container.innerHTML = list.map(h => `
      <div class="continue-card" onclick="window.location.href='episode.html?anime=${h.mal_id}&ep=${h.ep}&slug=${encodeURIComponent(h.slug || '')}&title=${encodeURIComponent(h.title)}'">
        <img class="continue-thumb" src="${h.image}" loading="lazy" alt="${escapeHtml(h.title)}" onerror="this.src='assets/placeholder.jpg'">
        <div class="continue-overlay">
          <div class="continue-info">
            <div class="continue-title">${escapeHtml(h.title)}</div>
            <div class="continue-ep">Ep ${h.ep}${h.total ? ` / ${h.total}` : ''}</div>
          </div>
          <div style="flex-shrink:0;width:40px;height:40px;background:rgba(124,58,237,0.8);border-radius:50%;display:flex;align-items:center;justify-content:center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        ${h.total ? `<div class="progress-bar" style="position:absolute;bottom:0;left:0;right:0;height:3px;border-radius:0"><div class="progress-bar-fill" style="width:${Math.min(100,(h.ep/h.total)*100)}%"></div></div>` : ''}
      </div>
    `).join('');
  }

  // ─── HERO CAROUSEL ──────────────────────────────────────
  let _heroTimer = null;
  let _heroIndex = 0;
  let _heroSlides = [];

  function initHero(animeList, heroId = 'hero') {
    const hero = document.getElementById(heroId);
    if (!hero || !animeList.length) return;

    _heroSlides = animeList.slice(0, 6);
    const slidesEl = hero.querySelector('.hero-slides');
    const dotsEl   = hero.querySelector('.hero-dots');
    if (!slidesEl) return;

    slidesEl.innerHTML = _heroSlides.map((a, i) => `
      <div class="hero-slide${i === 0 ? ' active' : ''}" data-idx="${i}">
        <img class="hero-bg" src="${API.getPoster(a)}" loading="${i === 0 ? 'eager' : 'lazy'}" alt="" onerror="this.src='assets/placeholder.jpg'">
        <div class="hero-overlay"></div>
        <div class="hero-content">
          <div class="hero-badges">
            ${a.genres?.slice(0,3).map(g => `<span class="badge badge-violet">${g.name}</span>`).join('') || ''}
            ${a.status === 'Currently Airing' ? '<span class="badge badge-green">En emisión</span>' : ''}
          </div>
          <h1 class="hero-title">${escapeHtml(a.title)}</h1>
          <div class="hero-meta">
            ${a.score    ? `<span class="hero-score"><span>★</span>${a.score.toFixed(1)}</span>` : ''}
            ${a.year     ? `<span style="color:var(--text-secondary)">${a.year}</span>` : ''}
            ${a.episodes ? `<span style="color:var(--text-secondary)">${a.episodes} Eps</span>` : ''}
            ${a.type     ? `<span class="badge badge-dark">${a.type}</span>` : ''}
          </div>
          <p class="hero-desc">${escapeHtml((a.synopsis || '').substring(0, 220))}${a.synopsis?.length > 220 ? '...' : ''}</p>
          <div class="hero-actions">
            <a href="episode.html?anime=${a.mal_id}&ep=1&slug=${encodeURIComponent(API.getEmbedSlug(a))}&title=${encodeURIComponent(a.title)}" class="btn btn-primary btn-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              Ver ahora
            </a>
            <a href="anime.html?id=${a.mal_id}" class="btn btn-secondary btn-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Más info
            </a>
          </div>
        </div>
      </div>
    `).join('');

    if (dotsEl) {
      dotsEl.innerHTML = _heroSlides.map((_, i) => `
        <button class="hero-dot${i === 0 ? ' active' : ''}" onclick="UI.setHeroSlide(${i})"></button>
      `).join('');
    }

    _heroIndex = 0;
    clearInterval(_heroTimer);
    _heroTimer = setInterval(() => setHeroSlide((_heroIndex + 1) % _heroSlides.length), 7000);
  }

  function setHeroSlide(idx) {
    const slides = document.querySelectorAll('.hero-slide');
    const dots   = document.querySelectorAll('.hero-dot');
    if (!slides.length) return;
    slides.forEach((s, i) => s.classList.toggle('active', i === idx));
    dots.forEach((d, i)   => d.classList.toggle('active', i === idx));
    _heroIndex = idx;
  }

  // ─── NAVBAR ──────────────────────────────────────────────
  function initNavbar() {
    const nav = document.querySelector('.navbar');
    if (!nav) return;
    window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 80), { passive: true });
    const toggle = nav.querySelector('.nav-mobile-toggle');
    if (toggle) toggle.addEventListener('click', () => nav.classList.toggle('mobile-open'));
  }

  function initBackToTop() {
    const btn = document.getElementById('backToTop');
    if (!btn) return;
    window.addEventListener('scroll', () => btn.classList.toggle('visible', window.scrollY > 400), { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  function initCarouselBtn(prevId, nextId, carouselId) {
    const prev = document.getElementById(prevId);
    const next = document.getElementById(nextId);
    const c    = document.getElementById(carouselId);
    if (!prev || !next || !c) return;
    const scroll = dir => { const w = (c.firstElementChild?.offsetWidth || 180) + 20; c.scrollBy({ left: dir * w * 3, behavior: 'smooth' }); };
    prev.addEventListener('click', () => scroll(-1));
    next.addEventListener('click', () => scroll(1));
  }

  // ─── LIVE SEARCH NAV ─────────────────────────────────────
  function initNavSearch() {
    const input    = document.getElementById('navSearchInput');
    const dropdown = document.getElementById('searchDropdown');
    if (!input || !dropdown) return;

    let debounceTimer;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const q = input.value.trim();
      if (q.length < 2) { dropdown.classList.remove('visible'); return; }
      debounceTimer = setTimeout(async () => {
        try {
          const data    = await API.searchAnime({ q, page: 1 });
          const results = data.data?.slice(0, 6) || [];
          if (!results.length) { dropdown.classList.remove('visible'); return; }
          dropdown.innerHTML = results.map(a => `
            <div class="search-dropdown-item" onclick="window.location.href='anime.html?id=${a.mal_id}'">
              <img class="search-dropdown-thumb" src="${API.getPoster(a)}" loading="lazy" onerror="this.src='assets/placeholder.jpg'">
              <div class="search-dropdown-info">
                <div class="search-dropdown-title">${escapeHtml(a.title)}</div>
                <div class="search-dropdown-meta">${a.type || ''} · ${a.year || 'N/A'} · ${a.score ? '★'+a.score.toFixed(1) : 'Sin puntuación'}</div>
              </div>
            </div>
          `).join('') + `
            <div class="search-dropdown-item" style="justify-content:center;color:var(--accent-light)" onclick="window.location.href='search.html?q=${encodeURIComponent(q)}'">
              Ver todos los resultados →
            </div>
          `;
          dropdown.classList.add('visible');
        } catch (e) { console.error(e); }
      }, 350);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = input.value.trim();
        if (q) window.location.href = `search.html?q=${encodeURIComponent(q)}`;
      }
    });

    document.addEventListener('click', e => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('visible');
      }
    });
  }

  // ─── PAGE LOADER ─────────────────────────────────────────
  function hideLoader() {
    const loader = document.getElementById('pageLoader');
    if (loader) setTimeout(() => loader.classList.add('hidden'), 400);
  }

  function clearContinue() {
    if (!confirm('¿Limpiar el historial de "continuar viendo"?')) return;
    try { localStorage.removeItem('ss_history'); localStorage.removeItem('ss_watching'); } catch {}
    const section = document.getElementById('continueSection');
    if (section) section.style.display = 'none';
    toast('Historial limpiado', 'info');
  }

  // ─── UTILITIES ───────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function setActiveNav() {
    const page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === page);
    });
  }

  function setPageMeta(title, description = '', image = '') {
    document.title = `${title} — ${CONFIG.siteName}`;
    if (description) {
      document.querySelector('meta[name="description"]')?.setAttribute('content', description);
      document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
    }
    if (image) document.querySelector('meta[property="og:image"]')?.setAttribute('content', image);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', `${title} — ${CONFIG.siteName}`);
  }

  return {
    toast,
    renderSkeletonCards,
    renderSkeletonEpCards,
    renderAnimeCard,
    renderAnimeGrid,
    renderCarousel,
    renderEpisodeCard,
    updateEpisodeThumbnails,
    renderGenreBadges,
    renderContinueWatching,
    initHero,
    setHeroSlide,
    initNavbar,
    initBackToTop,
    initCarouselBtn,
    initNavSearch,
    hideLoader,
    clearContinue,
    escapeHtml,
    setActiveNav,
    setPageMeta,
    toggleFavBtn,
    _onPosterError,
  };
})();

// Globales
window.UI = UI;
function escapeHtml(str) { return UI.escapeHtml(str); }
