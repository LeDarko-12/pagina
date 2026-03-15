/**
 * SAKURA STREAM — API Layer
 * Wrapper para Jikan API v4 (MyAnimeList) con caché y rate limiting
 */

const API = (() => {
  // ─── CACHE ───────────────────────────────────────────────
  const _cache = new Map();

  function _getCached(key) {
    if (!_cache.has(key)) return null;
    const { data, ts } = _cache.get(key);
    if (Date.now() - ts > CONFIG.cacheExpiry) {
      _cache.delete(key);
      return null;
    }
    return data;
  }

  function _setCache(key, data) {
    _cache.set(key, { data, ts: Date.now() });
    // También persistir en sessionStorage para recargas de página
    try {
      sessionStorage.setItem(`api_${key}`, JSON.stringify({ data, ts: Date.now() }));
    } catch (e) { /* sessionStorage llena o no disponible */ }
  }

  function _getSessionCache(key) {
    try {
      const raw = sessionStorage.getItem(`api_${key}`);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > CONFIG.cacheExpiry) {
        sessionStorage.removeItem(`api_${key}`);
        return null;
      }
      return data;
    } catch { return null; }
  }

  // ─── REQUEST QUEUE (evitar rate limit de Jikan) ──────────
  let _queue = [];
  let _processing = false;

  async function _processQueue() {
    if (_processing || _queue.length === 0) return;
    _processing = true;
    while (_queue.length > 0) {
      const { resolve, reject, url, cacheKey } = _queue.shift();
      try {
        const data = await _fetchDirect(url, cacheKey);
        resolve(data);
      } catch (err) {
        reject(err);
      }
      if (_queue.length > 0) {
        await new Promise(r => setTimeout(r, CONFIG.jikanDelay));
      }
    }
    _processing = false;
  }

  async function _fetchDirect(url, cacheKey) {
    // Revisar caché en memoria
    const cached = _getCached(cacheKey) || _getSessionCache(cacheKey);
    if (cached) return cached;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
    const json = await res.json();
    _setCache(cacheKey, json);
    return json;
  }

  function _fetch(url, cacheKey) {
    // Revisar caché primero sin hacer queue
    const cached = _getCached(cacheKey) || _getSessionCache(cacheKey);
    if (cached) return Promise.resolve(cached);

    return new Promise((resolve, reject) => {
      _queue.push({ resolve, reject, url, cacheKey });
      _processQueue();
    });
  }

  // ─── ENDPOINTS PÚBLICOS ──────────────────────────────────

  /** Anime trending / airing ahora */
  function getTopAiring(page = 1) {
    const url = `${CONFIG.jikanBase}/top/anime?filter=airing&page=${page}&limit=24`;
    return _fetch(url, `top_airing_${page}`);
  }

  /** Anime más populares de todos los tiempos */
  function getTopPopular(page = 1) {
    const url = `${CONFIG.jikanBase}/top/anime?filter=bypopularity&page=${page}&limit=24`;
    return _fetch(url, `top_popular_${page}`);
  }

  /** Anime mejor puntuados */
  function getTopRated(page = 1) {
    const url = `${CONFIG.jikanBase}/top/anime?page=${page}&limit=24`;
    return _fetch(url, `top_rated_${page}`);
  }

  /** Temporada actual */
  function getCurrentSeason(page = 1) {
    const url = `${CONFIG.jikanBase}/seasons/now?page=${page}&limit=24`;
    return _fetch(url, `season_now_${page}`);
  }

  /** Favoritos / más queridos */
  function getTopFavorites(page = 1) {
    const url = `${CONFIG.jikanBase}/top/anime?filter=favorite&page=${page}&limit=24`;
    return _fetch(url, `top_favorites_${page}`);
  }

  /** Detalles completos de un anime */
  function getAnimeById(id) {
    const url = `${CONFIG.jikanBase}/anime/${id}/full`;
    return _fetch(url, `anime_full_${id}`);
  }

  /** Lista de episodios de un anime */
  function getAnimeEpisodes(id, page = 1) {
    const url = `${CONFIG.jikanBase}/anime/${id}/episodes?page=${page}`;
    return _fetch(url, `anime_eps_${id}_${page}`);
  }

  /** Información de un episodio específico */
  function getEpisodeById(animeId, epNum) {
    const url = `${CONFIG.jikanBase}/anime/${animeId}/episodes/${epNum}`;
    return _fetch(url, `anime_ep_${animeId}_${epNum}`);
  }

  /** Links de streaming oficiales */
  function getAnimeStreaming(id) {
    const url = `${CONFIG.jikanBase}/anime/${id}/streaming`;
    return _fetch(url, `anime_streaming_${id}`);
  }

  /** Recomendaciones basadas en un anime */
  function getAnimeRecommendations(id) {
    const url = `${CONFIG.jikanBase}/anime/${id}/recommendations`;
    return _fetch(url, `anime_recs_${id}`);
  }

  /** Personajes de un anime */
  function getAnimeCharacters(id) {
    const url = `${CONFIG.jikanBase}/anime/${id}/characters`;
    return _fetch(url, `anime_chars_${id}`);
  }

  /** Búsqueda de anime */
  function searchAnime({ q = '', genres = '', type = '', status = '', order_by = 'score', page = 1 } = {}) {
    const params = new URLSearchParams();
    if (q)       params.set('q', q);
    if (genres)  params.set('genres', genres);
    if (type)    params.set('type', type);
    if (status)  params.set('status', status);
    params.set('order_by', order_by);
    params.set('sort', 'desc');
    params.set('page', page);
    params.set('limit', CONFIG.pageSize);
    const url = `${CONFIG.jikanBase}/anime?${params}`;
    const cacheKey = `search_${params.toString()}`;
    return _fetch(url, cacheKey);
  }

  /** Anime por género */
  function getAnimeByGenre(genreId, page = 1) {
    const url = `${CONFIG.jikanBase}/anime?genres=${genreId}&order_by=score&sort=desc&page=${page}&limit=24`;
    return _fetch(url, `genre_${genreId}_${page}`);
  }

  /** Schedule semanal */
  function getWeeklySchedule(day = 'monday') {
    const url = `${CONFIG.jikanBase}/schedules?filter=${day}&limit=25`;
    return _fetch(url, `schedule_${day}`);
  }

  // ─── HELPERS ─────────────────────────────────────────────

  /** Extrae poster de alta calidad */
  function getPoster(anime) {
    return (anime.images?.webp?.large_image_url ||
            anime.images?.jpg?.large_image_url ||
            anime.images?.webp?.image_url ||
            anime.images?.jpg?.image_url ||
            'assets/placeholder.jpg');
  }

  /** Genera el slug para URLs de embed a partir del título */
  function getEmbedSlug(anime) {
    // Preferir título en inglés para gogoanime
    const title = anime.title_english || anime.title || '';
    return CONFIG.titleToSlug(title);
  }

  /** Formatea duración */
  function formatDuration(dur) {
    if (!dur) return 'N/A';
    return dur.replace(' per ep', '').replace('min.', 'min');
  }

  /** Formatea fecha de emisión */
  function formatDate(dateStr) {
    if (!dateStr) return 'TBA';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /** Clase de estado */
  function getStatusBadge(status) {
    const map = {
      'Currently Airing': { cls: 'badge-green', label: 'En emisión' },
      'Finished Airing':  { cls: 'badge-dark',  label: 'Finalizado' },
      'Not yet aired':    { cls: 'badge-amber',  label: 'Próximamente' },
    };
    return map[status] || { cls: 'badge-dark', label: status };
  }

  // ─── EXPORT ──────────────────────────────────────────────
  return {
    getTopAiring,
    getTopPopular,
    getTopRated,
    getCurrentSeason,
    getTopFavorites,
    getAnimeById,
    getAnimeEpisodes,
    getEpisodeById,
    getAnimeStreaming,
    getAnimeRecommendations,
    getAnimeCharacters,
    searchAnime,
    getAnimeByGenre,
    getWeeklySchedule,
    getPoster,
    getEmbedSlug,
    formatDuration,
    formatDate,
    getStatusBadge,
  };
})();
