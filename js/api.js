/**
 * SAKURA STREAM — API Layer
 * Wrapper para Jikan API v4 (MyAnimeList) con caché y rate limiting
 * + AnimeonlineNinja scraper para episodios en español
 * + TMDB fallback para imágenes
 */

const API = (() => {
  // ─── CACHE ───────────────────────────────────────────────
  const _cache = new Map();

  function _getCached(key) {
    if (!_cache.has(key)) return null;
    const { data, ts } = _cache.get(key);
    if (Date.now() - ts > CONFIG.cacheExpiry) { _cache.delete(key); return null; }
    return data;
  }

  function _setCache(key, data) {
    _cache.set(key, { data, ts: Date.now() });
    try { sessionStorage.setItem(`api_${key}`, JSON.stringify({ data, ts: Date.now() })); } catch {}
  }

  function _getSessionCache(key) {
    try {
      const raw = sessionStorage.getItem(`api_${key}`);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > CONFIG.cacheExpiry) { sessionStorage.removeItem(`api_${key}`); return null; }
      return data;
    } catch { return null; }
  }

  // ─── REQUEST QUEUE (rate limit Jikan ≈ 3 req/s) ─────────
  let _queue      = [];
  let _processing = false;

  async function _processQueue() {
    if (_processing || _queue.length === 0) return;
    _processing = true;
    while (_queue.length > 0) {
      const { resolve, reject, url, cacheKey } = _queue.shift();
      try   { resolve(await _fetchDirect(url, cacheKey)); }
      catch (err) { reject(err); }
      if (_queue.length > 0) await new Promise(r => setTimeout(r, CONFIG.jikanDelay));
    }
    _processing = false;
  }

  async function _fetchDirect(url, cacheKey) {
    const cached = _getCached(cacheKey) || _getSessionCache(cacheKey);
    if (cached) return cached;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
    const json = await res.json();
    _setCache(cacheKey, json);
    return json;
  }

  function _fetch(url, cacheKey) {
    const cached = _getCached(cacheKey) || _getSessionCache(cacheKey);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
      _queue.push({ resolve, reject, url, cacheKey });
      _processQueue();
    });
  }

  // ─── ENDPOINTS JIKAN ────────────────────────────────────
  function getTopAiring(page = 1)    { return _fetch(`${CONFIG.jikanBase}/top/anime?filter=airing&page=${page}&limit=24`, `top_airing_${page}`); }
  function getTopPopular(page = 1)   { return _fetch(`${CONFIG.jikanBase}/top/anime?filter=bypopularity&page=${page}&limit=24`, `top_popular_${page}`); }
  function getTopRated(page = 1)     { return _fetch(`${CONFIG.jikanBase}/top/anime?page=${page}&limit=24`, `top_rated_${page}`); }
  function getCurrentSeason(page=1)  { return _fetch(`${CONFIG.jikanBase}/seasons/now?page=${page}&limit=24`, `season_now_${page}`); }
  function getTopFavorites(page = 1) { return _fetch(`${CONFIG.jikanBase}/top/anime?filter=favorite&page=${page}&limit=24`, `top_favorites_${page}`); }
  function getAnimeById(id)          { return _fetch(`${CONFIG.jikanBase}/anime/${id}/full`, `anime_full_${id}`); }
  function getAnimeEpisodes(id, page = 1) { return _fetch(`${CONFIG.jikanBase}/anime/${id}/episodes?page=${page}`, `anime_eps_${id}_${page}`); }
  function getEpisodeById(animeId, epNum) { return _fetch(`${CONFIG.jikanBase}/anime/${animeId}/episodes/${epNum}`, `anime_ep_${animeId}_${epNum}`); }
  function getAnimeStreaming(id)     { return _fetch(`${CONFIG.jikanBase}/anime/${id}/streaming`, `anime_streaming_${id}`); }
  function getAnimeRecommendations(id){ return _fetch(`${CONFIG.jikanBase}/anime/${id}/recommendations`, `anime_recs_${id}`); }
  function getAnimeCharacters(id)    { return _fetch(`${CONFIG.jikanBase}/anime/${id}/characters`, `anime_chars_${id}`); }
  function getAnimeByGenre(genreId, page = 1) { return _fetch(`${CONFIG.jikanBase}/anime?genres=${genreId}&order_by=score&sort=desc&page=${page}&limit=24`, `genre_${genreId}_${page}`); }
  function getWeeklySchedule(day='monday') { return _fetch(`${CONFIG.jikanBase}/schedules?filter=${day}&limit=25`, `schedule_${day}`); }

  function searchAnime({ q = '', genres = '', type = '', status = '', order_by = 'score', page = 1 } = {}) {
    const params = new URLSearchParams();
    if (q)      params.set('q', q);
    if (genres) params.set('genres', genres);
    if (type)   params.set('type', type);
    if (status) params.set('status', status);
    params.set('order_by', order_by);
    params.set('sort', 'desc');
    params.set('page', page);
    params.set('limit', CONFIG.pageSize);
    const url = `${CONFIG.jikanBase}/anime?${params}`;
    return _fetch(url, `search_${params.toString()}`);
  }

  // ─── HELPERS JIKAN ───────────────────────────────────────

  /** Póster: intenta MAL primero, luego TMDB como fallback (async) */
  function getPoster(anime) {
    return (anime.images?.webp?.large_image_url ||
            anime.images?.jpg?.large_image_url  ||
            anime.images?.webp?.image_url        ||
            anime.images?.jpg?.image_url         ||
            'assets/placeholder.jpg');
  }

  /** Póster con fallback TMDB (devuelve Promise) */
  async function getPosterWithFallback(anime) {
    const mal = getPoster(anime);
    // Si MAL tiene imagen válida (no placeholder), úsala
    if (mal && !mal.includes('placeholder') && !mal.includes('assets/')) return mal;
    // Intentar TMDB si está habilitado
    if (CONFIG.tmdbEnabled) {
      try {
        const tmdb = await TMDB.getPoster(
          anime.title,
          anime.title_english || '',
          anime.year || null
        );
        if (tmdb) return tmdb;
      } catch {}
    }
    return mal;
  }

  function getEmbedSlug(anime) {
    const title = anime.title_english || anime.title || '';
    return CONFIG.titleToSlug(title);
  }

  function formatDuration(dur) {
    if (!dur) return 'N/A';
    return dur.replace(' per ep', '').replace('min.', 'min');
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'TBA';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function getStatusBadge(status) {
    const map = {
      'Currently Airing': { cls: 'badge-green', label: 'En emisión'    },
      'Finished Airing':  { cls: 'badge-dark',  label: 'Finalizado'    },
      'Not yet aired':    { cls: 'badge-amber',  label: 'Próximamente' },
    };
    return map[status] || { cls: 'badge-dark', label: status };
  }

  // ─── EXPORT ──────────────────────────────────────────────
  return {
    // Jikan
    getTopAiring, getTopPopular, getTopRated, getCurrentSeason, getTopFavorites,
    getAnimeById, getAnimeEpisodes, getEpisodeById,
    getAnimeStreaming, getAnimeRecommendations, getAnimeCharacters,
    searchAnime, getAnimeByGenre, getWeeklySchedule,
    // Helpers
    getPoster, getPosterWithFallback, getEmbedSlug,
    formatDuration, formatDate, getStatusBadge,
  };
})();

// ═══════════════════════════════════════════════════════════
//  ANIMEONLINE NINJA — Scraper de episodios
// ═══════════════════════════════════════════════════════════
const AnimeonlineAPI = (() => {
  const BASE  = CONFIG.aonBase;  // 'https://ww3.animeonline.ninja'
  const PROXY = CONFIG.corsProxy; // 'https://corsproxy.io/?'

  // Caché persistente en localStorage (los slugs no cambian)
  const LS_KEY = 'ss_aon_slugs';
  const _slugCache = (() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
  })();
  function _saveSlugCache() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(_slugCache)); } catch {}
  }

  const _epCache  = new Map(); // episodios en memoria
  const _urlCache = new Map(); // embed URLs en memoria

  // ─── FETCH VÍA PROXY ─────────────────────────────────────
  async function _proxyFetch(url) {
    const res = await fetch(PROXY + encodeURIComponent(url));
    if (!res.ok) throw new Error(`AON proxy ${res.status}: ${url}`);
    return res.text();
  }

  function _parseHTML(html) {
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
  }

  // ─── EXTRAER SLUG DE LA URL ───────────────────────────────
  function _slugFromUrl(href) {
    // https://ww3.animeonline.ninja/kimetsu-no-yaiba/ → kimetsu-no-yaiba
    return href
      .replace(BASE, '')
      .replace(/\//g, '')
      .trim()
      .replace(/-\d+$/, ''); // quitar sufijo numérico si existe
  }

  // ─── BUSCAR ANIME EN AON ──────────────────────────────────
  /**
   * Busca el anime en animeonline.ninja y devuelve su slug.
   * El slug se guarda en localStorage para no repetir la búsqueda.
   * @param {string} title         Título original (MAL)
   * @param {string} titleEn       Título en inglés (más exacto para buscar)
   * @param {number} malId         ID de MAL (usado como clave de caché)
   * @returns {string|null}        Slug en AON o null si no se encuentra
   */
  async function findSlug(title, titleEn, malId) {
    if (!CONFIG.aonEnabled) return null;
    const cacheKey = String(malId);

    // 1. Caché localStorage
    if (_slugCache[cacheKey]) return _slugCache[cacheKey];

    // Intentar varias queries (inglés primero, luego original)
    const queries = [titleEn, title].filter(Boolean);

    for (const q of queries) {
      try {
        const searchUrl = `${BASE}/?s=${encodeURIComponent(q)}`;
        const html = await _proxyFetch(searchUrl);
        const doc  = _parseHTML(html);

        // Selectores comunes en themes de streaming de WordPress
        const selectors = [
          '.result-item article .image a',
          '.items .item a.item-img',
          '.ml-item a',
          'article.result-item a[href]',
          '.search-page .items article a',
        ];

        let href = null;
        for (const sel of selectors) {
          const el = doc.querySelector(sel);
          if (el) { href = el.getAttribute('href'); break; }
        }

        if (href && href.includes(BASE)) {
          const slug = _slugFromUrl(href);
          if (slug) {
            _slugCache[cacheKey] = slug;
            _saveSlugCache();
            console.info(`[AON] Slug encontrado para "${q}": ${slug}`);
            return slug;
          }
        }
      } catch (e) {
        console.warn(`[AON] Búsqueda fallida para "${q}":`, e.message);
      }
    }

    // Fallback: generar slug desde el título (puede que no funcione)
    const fallback = CONFIG.titleToSlug(titleEn || title);
    console.warn(`[AON] Usando slug generado para "${title}": ${fallback}`);
    return fallback || null;
  }

  // ─── GUARDAR SLUG MANUALMENTE ─────────────────────────────
  /**
   * Permite que el usuario o el sistema guarde el slug correcto para un anime.
   */
  function saveSlug(malId, slug) {
    _slugCache[String(malId)] = slug;
    _saveSlugCache();
  }

  // ─── LISTAR EPISODIOS ────────────────────────────────────
  /**
   * Obtiene la lista de episodios de un anime desde AON.
   * Devuelve array de { num, url, title, thumb } o [] si falla.
   */
  async function getEpisodeList(slug) {
    if (!CONFIG.aonEnabled || !slug) return [];

    const cacheKey = `eps_${slug}`;
    if (_epCache.has(cacheKey)) return _epCache.get(cacheKey);

    try {
      const animeUrl = `${BASE}/${slug}/`;
      const html     = await _proxyFetch(animeUrl);
      const doc      = _parseHTML(html);

      // Diferentes themes usan distintos selectores para la lista de episodios
      const selectors = [
        '.episodios li a',
        '#episode_by_temp li a',
        '.episodes-list li a',
        '.ListEpisodes li a',
        '.list-episodes li a',
        'ul.episodios a',
      ];

      let links = [];
      for (const sel of selectors) {
        links = Array.from(doc.querySelectorAll(sel));
        if (links.length) break;
      }

      const episodes = links.map(el => {
        const href  = el.getAttribute('href') || '';
        const text  = el.textContent.trim();
        // Extraer número de episodio del texto o de la URL
        const numMatch = text.match(/\d+/) || href.match(/-(\d+)\/?$/);
        const num   = numMatch ? parseInt(numMatch[1] || numMatch[0]) : 0;
        // Miniatura si existe
        const img   = el.querySelector('img');
        const thumb = img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '';
        const title = el.getAttribute('title') || el.getAttribute('aria-label') || `Episodio ${num}`;
        return { num, url: href, title, thumb };
      }).filter(e => e.num > 0).sort((a, b) => a.num - b.num);

      _epCache.set(cacheKey, episodes);
      console.info(`[AON] ${episodes.length} episodios encontrados para "${slug}"`);
      return episodes;
    } catch (e) {
      console.warn('[AON] getEpisodeList falló:', e.message);
      return [];
    }
  }

  // ─── OBTENER URL DE EMBED ────────────────────────────────
  /**
   * Obtiene la URL real del iframe de video del episodio.
   * Primero intenta la URL de la página de episodio, luego extrae el iframe.
   * Devuelve la URL del embed o null.
   */
  async function getEpisodeEmbed(slug, epNum) {
    if (!CONFIG.aonEnabled || !slug) return null;

    const cacheKey = `embed_${slug}_${epNum}`;
    if (_urlCache.has(cacheKey)) return _urlCache.get(cacheKey);

    // Patrones de URL más comunes en estos sites (WordPress + Anime)
    const epUrlPatterns = [
      `${BASE}/episodio/${slug}-${epNum}/`,
      `${BASE}/episodio/${slug}-episodio-${epNum}/`,
      `${BASE}/${slug}-episodio-${epNum}/`,
      `${BASE}/${slug}-${epNum}/`,
      `${BASE}/ver/${slug}-${epNum}/`,
      `${BASE}/capitulo/${slug}-${epNum}/`,
    ];

    for (const epUrl of epUrlPatterns) {
      try {
        const html = await _proxyFetch(epUrl);
        if (!html || html.length < 500) continue; // respuesta vacía/error

        const doc = _parseHTML(html);

        // Selectores comunes para el player iframe
        const playerSelectors = [
          '.player-container iframe',
          '#player iframe',
          '.embed-responsive iframe',
          '#videojs-player iframe',
          '.video-player iframe',
          'iframe[src*="dood"]',
          'iframe[src*="stream"]',
          'iframe[src*="fembed"]',
          'iframe[src*="sb"]',
          'iframe[src*="tape"]',
          'iframe[allowfullscreen]',
          'iframe[src]',
        ];

        let embedSrc = null;
        for (const sel of playerSelectors) {
          const iframe = doc.querySelector(sel);
          if (iframe) {
            embedSrc = iframe.getAttribute('src') || iframe.getAttribute('data-src');
            if (embedSrc) break;
          }
        }

        // Buscar en scripts si no encontramos iframe
        if (!embedSrc) {
          const scripts = Array.from(doc.querySelectorAll('script:not([src])'));
          for (const script of scripts) {
            const text = script.textContent;
            // Patrones comunes en players embebidos
            const patterns = [
              /['"]file['"]\s*:\s*['"]([^'"]+)['"]/,
              /source\s*:\s*\{[^}]*file\s*:\s*['"]([^'"]+)['"]/,
              /player\.setup\([^)]*file\s*:\s*['"]([^'"]+)['"]/,
              /var\s+videoUrl\s*=\s*['"]([^'"]+)['"]/,
              /embedUrl\s*=\s*['"]([^'"]+)['"]/,
            ];
            for (const pat of patterns) {
              const m = text.match(pat);
              if (m && m[1]) { embedSrc = m[1]; break; }
            }
            if (embedSrc) break;
          }
        }

        if (embedSrc) {
          // Asegurarse que tenga protocolo
          if (embedSrc.startsWith('//')) embedSrc = 'https:' + embedSrc;
          _urlCache.set(cacheKey, embedSrc);
          console.info(`[AON] Embed encontrado para ep ${epNum}: ${embedSrc.substring(0, 80)}...`);
          return embedSrc;
        }

        // Si la página cargó pero no encontramos iframe, guardar la URL de la página
        // (puede que el player cargue dinámicamente con JS)
        _urlCache.set(cacheKey, epUrl);
        return epUrl;

      } catch (e) {
        // Este patrón de URL no funcionó, intentar el siguiente
        continue;
      }
    }

    console.warn(`[AON] No se encontró embed para ${slug} ep ${epNum}`);
    _urlCache.set(cacheKey, null);
    return null;
  }

  // ─── URL COMPLETA DEL EPISODIO (para enlace externo) ──────
  /**
   * Construye la URL de la página del episodio en AON.
   * Útil para ofrecer un enlace "Ver en AON" en caso de que el embed falle.
   */
  function getEpisodePageUrl(slug, epNum) {
    if (!slug) return null;
    return `${BASE}/episodio/${slug}-${epNum}/`;
  }

  // ─── LIMPIAR CACHÉ ────────────────────────────────────────
  function clearSlugCache() {
    try { localStorage.removeItem(LS_KEY); } catch {}
    Object.keys(_slugCache).forEach(k => delete _slugCache[k]);
    console.info('[AON] Slug cache cleared');
  }

  return {
    findSlug,
    saveSlug,
    getEpisodeList,
    getEpisodeEmbed,
    getEpisodePageUrl,
    clearSlugCache,
  };
})();
