/**
 * SAKURA STREAM — Favoritos & Historial
 * Gestión de favoritos e historial usando localStorage
 */

const Favorites = (() => {
  const KEYS = {
    favorites: 'ss_favorites',
    history:   'ss_history',
    watching:  'ss_watching', // progreso de episodios
  };

  // ─── HELPERS ─────────────────────────────────────────────
  function _load(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch { return []; }
  }

  function _save(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.warn('localStorage lleno'); }
  }

  function _loadObj(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
  }

  // ─── FAVORITOS ───────────────────────────────────────────
  function getFavorites() { return _load(KEYS.favorites); }

  function addFavorite(anime) {
    const list = getFavorites();
    if (!list.find(a => a.mal_id === anime.mal_id)) {
      list.unshift({
        mal_id:   anime.mal_id,
        title:    anime.title,
        image:    API.getPoster(anime),
        score:    anime.score,
        episodes: anime.episodes,
        status:   anime.status,
        addedAt:  Date.now(),
      });
      _save(KEYS.favorites, list);
      return true;
    }
    return false;
  }

  function removeFavorite(malId) {
    const list = getFavorites().filter(a => a.mal_id !== malId);
    _save(KEYS.favorites, list);
  }

  function isFavorite(malId) {
    return getFavorites().some(a => a.mal_id === malId);
  }

  function toggleFavorite(anime) {
    if (isFavorite(anime.mal_id)) {
      removeFavorite(anime.mal_id);
      return false;
    } else {
      addFavorite(anime);
      return true;
    }
  }

  // ─── HISTORIAL ───────────────────────────────────────────
  function getHistory() { return _load(KEYS.history); }

  /** Registra la visita a un episodio */
  function addToHistory(anime, epNum, epTitle = '') {
    const list = getHistory();
    // Eliminar entrada anterior del mismo anime (mover al frente)
    const filtered = list.filter(h => !(h.mal_id === anime.mal_id && h.ep === epNum));
    filtered.unshift({
      mal_id:   anime.mal_id,
      title:    anime.title,
      image:    typeof anime.image === 'string' ? anime.image : API.getPoster(anime),
      ep:       epNum,
      epTitle:  epTitle,
      total:    anime.episodes,
      slug:     typeof anime.slug === 'string' ? anime.slug : API.getEmbedSlug(anime),
      watchedAt: Date.now(),
    });
    // Limitar a 50 entradas
    _save(KEYS.history, filtered.slice(0, 50));
  }

  function clearHistory() { _save(KEYS.history, []); }

  function isWatched(malId, epNum) {
    return getHistory().some(h => h.mal_id === malId && h.ep === epNum);
  }

  /** Último episodio visto de un anime */
  function getLastWatched(malId) {
    return getHistory().find(h => h.mal_id === malId) || null;
  }

  // ─── PROGRESO (continue watching) ───────────────────────
  function getWatching() { return _loadObj(KEYS.watching); }

  function saveProgress(malId, epNum, progress = 0) {
    const data = getWatching();
    data[malId] = { ep: epNum, progress, ts: Date.now() };
    _save(KEYS.watching, data);
  }

  function getProgress(malId) {
    return getWatching()[malId] || null;
  }

  // ─── CONTINUE WATCHING ───────────────────────────────────
  /** Retorna los últimos animes en progreso (para el home) */
  function getContinueWatching() {
    return getHistory()
      .reduce((acc, h) => {
        if (!acc.find(x => x.mal_id === h.mal_id)) acc.push(h);
        return acc;
      }, [])
      .slice(0, 8);
  }

  return {
    getFavorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
    getHistory,
    addToHistory,
    clearHistory,
    isWatched,
    getLastWatched,
    saveProgress,
    getProgress,
    getContinueWatching,
  };
})();
