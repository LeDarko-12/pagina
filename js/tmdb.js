/**
 * SAKURA STREAM — TMDB API Module
 * The Movie Database — miniaturas de episodios y pósters alternativos
 * Documentación: https://developer.themoviedb.org/docs
 */

const TMDB = (() => {
  const BASE     = 'https://api.themoviedb.org/3';
  const KEY      = '8a2de0488825903a0a4b7d0ff12a3873';
  const IMG_BASE = 'https://image.tmdb.org/t/p/';
  const TTL      = 30 * 60 * 1000; // 30 min caché

  const _mem = new Map();

  // ─── CACHÉ ────────────────────────────────────────────────
  function _getCached(key) {
    const e = _mem.get(key);
    if (!e) return _getSession(key);
    if (Date.now() - e.ts > TTL) { _mem.delete(key); return null; }
    return e.data;
  }

  function _setCache(key, data) {
    _mem.set(key, { data, ts: Date.now() });
    try { sessionStorage.setItem(`tmdb_${key}`, JSON.stringify({ data, ts: Date.now() })); } catch {}
  }

  function _getSession(key) {
    try {
      const raw = sessionStorage.getItem(`tmdb_${key}`);
      if (!raw) return undefined; // undefined = no hay cache (null = se guardó null a propósito)
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > TTL) { sessionStorage.removeItem(`tmdb_${key}`); return undefined; }
      return data;
    } catch { return undefined; }
  }

  // ─── FETCH CON CACHÉ ──────────────────────────────────────
  async function _fetch(path, cacheKey) {
    const cached = _getCached(cacheKey);
    if (cached !== undefined) return cached;

    const sep = path.includes('?') ? '&' : '?';
    const url = `${BASE}${path}${sep}api_key=${KEY}&language=es-ES`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`);
    const data = await res.json();
    _setCache(cacheKey, data);
    return data;
  }

  // ─── BUSCAR SHOW POR TÍTULO ───────────────────────────────
  /**
   * Devuelve el tmdbId del mejor match de TV show para un título
   * Intenta también con el título en inglés si se provee
   */
  async function findShowId(title, titleEn = '', year = null) {
    if (!title && !titleEn) return null;

    // Intentar con título en inglés primero (más exacto en TMDB)
    const queries = [titleEn, title].filter(Boolean);

    for (const q of queries) {
      const clean = q.trim();
      const yearParam = year ? `&first_air_date_year=${year}` : '';
      const cacheKey  = `sid_${clean.toLowerCase()}_${year || ''}`;
      const cached    = _getCached(cacheKey);
      if (cached !== undefined) return cached;

      try {
        const data = await _fetch(
          `/search/tv?query=${encodeURIComponent(clean)}${yearParam}`,
          `raw_search_${cacheKey}`
        );

        const results = data.results || [];
        if (!results.length) { _setCache(cacheKey, null); continue; }

        // Preferir coincidencia exacta
        const exact = results.find(r =>
          r.name?.toLowerCase() === clean.toLowerCase() ||
          r.original_name?.toLowerCase() === clean.toLowerCase()
        );

        const tmdbId = (exact || results[0]).id;
        _setCache(cacheKey, tmdbId);
        return tmdbId;
      } catch (e) {
        console.warn(`[TMDB] Search failed for "${clean}":`, e.message);
      }
    }

    return null;
  }

  // ─── MINIATURA DE EPISODIO ────────────────────────────────
  /**
   * Devuelve la URL de la imagen (still) de un episodio en TMDB.
   * Casi todos los anime son temporada 1 en TMDB.
   * size: 'w300' | 'w400' | 'w780' | 'original'
   */
  async function getEpisodeThumbnail(tmdbId, season, epNum, size = 'w400') {
    if (!tmdbId || !epNum) return null;
    const cacheKey = `epthumb_${tmdbId}_s${season}_e${epNum}`;
    const cached   = _getCached(cacheKey);
    if (cached !== undefined) return cached;

    try {
      const data = await _fetch(
        `/tv/${tmdbId}/season/${season}/episode/${epNum}`,
        `raw_ep_${cacheKey}`
      );
      const url = data.still_path ? `${IMG_BASE}${size}${data.still_path}` : null;
      _setCache(cacheKey, url);
      return url;
    } catch {
      _setCache(cacheKey, null);
      return null;
    }
  }

  // ─── PÓSTER ALTERNATIVO ───────────────────────────────────
  /**
   * Obtiene el póster de TMDB como alternativa al de MAL
   */
  async function getPoster(title, titleEn = '', year = null, size = 'w500') {
    const tmdbId = await findShowId(title, titleEn, year);
    if (!tmdbId) return null;

    const cacheKey = `poster_${tmdbId}_${size}`;
    const cached   = _getCached(cacheKey);
    if (cached !== undefined) return cached;

    try {
      const data = await _fetch(`/tv/${tmdbId}`, `raw_tv_${tmdbId}`);
      const url  = data.poster_path ? `${IMG_BASE}${size}${data.poster_path}` : null;
      _setCache(cacheKey, url);
      return url;
    } catch {
      return null;
    }
  }

  // ─── BATCH THUMBNAILS ─────────────────────────────────────
  /**
   * Pre-carga miniaturas para una lista de episodios.
   * Devuelve { epNum: imageUrl } para todos los que tengan imagen en TMDB.
   * Peticiones en lotes de 5 para no saturar la API.
   */
  async function batchEpisodeThumbnails(animeTitle, animeEn, year, episodes, season = 1) {
    const tmdbId = await findShowId(animeTitle, animeEn, year);
    if (!tmdbId) {
      console.info('[TMDB] No match found for', animeTitle);
      return {};
    }

    const thumbMap = {};
    const BATCH    = 5;
    const DELAY    = 200; // ms entre lotes

    for (let i = 0; i < episodes.length; i += BATCH) {
      const batch = episodes.slice(i, i + BATCH);
      await Promise.all(batch.map(async (ep) => {
        const epNum = ep.mal_id || ep.episode_id;
        if (!epNum) return;
        const url = await getEpisodeThumbnail(tmdbId, season, epNum);
        if (url) thumbMap[epNum] = url;
      }));
      if (i + BATCH < episodes.length) {
        await new Promise(r => setTimeout(r, DELAY));
      }
    }

    console.info(`[TMDB] Loaded ${Object.keys(thumbMap).length}/${episodes.length} episode thumbs`);
    return thumbMap;
  }

  // ─── INFO COMPLETA DEL SHOW ───────────────────────────────
  async function getShowInfo(title, titleEn = '', year = null) {
    const tmdbId = await findShowId(title, titleEn, year);
    if (!tmdbId) return null;

    try {
      const data = await _fetch(`/tv/${tmdbId}`, `raw_tv_${tmdbId}`);
      return {
        id:       tmdbId,
        name:     data.name,
        overview: data.overview,
        poster:   data.poster_path   ? `${IMG_BASE}w500${data.poster_path}`   : null,
        backdrop: data.backdrop_path ? `${IMG_BASE}w1280${data.backdrop_path}` : null,
        seasons:  data.number_of_seasons,
        episodes: data.number_of_episodes,
        rating:   data.vote_average,
        genres:   data.genres || [],
      };
    } catch {
      return null;
    }
  }

  // ─── HELPER: URL DE IMAGEN ────────────────────────────────
  function imageUrl(path, size = 'w500') {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${IMG_BASE}${size}${path}`;
  }

  return {
    findShowId,
    getEpisodeThumbnail,
    getPoster,
    batchEpisodeThumbnails,
    getShowInfo,
    imageUrl,
  };
})();
