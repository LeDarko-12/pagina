/**
 * SAKURA STREAM — Admin Panel Logic
 * Gestión de datos del sitio desde el panel de administrador
 */

const Admin = (() => {

  // ─── STORAGE KEYS ─────────────────────────────────────────
  const KEYS = {
    auth:     'ss_admin_auth',
    thumbs:   'ss_admin_thumbs',   // { "malId:epNum": "url" }
    aon:      'ss_aon_slugs',      // compartido con AnimeonlineAPI
    featured: 'ss_admin_featured', // [{ mal_id, title, image, reason }]
    custom:   'ss_admin_custom',   // anime personalizados fuera de MAL
    cfg:      'ss_admin_config',   // sobreescrituras de config
    log:      'ss_admin_log',      // historial de cambios
  };

  // ─── CONTRASEÑA ───────────────────────────────────────────
  // SHA-256 simple via SubtleCrypto
  async function _hash(str) {
    const buf  = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function login(password) {
    const hash     = await _hash(password);
    const stored   = localStorage.getItem(KEYS.auth);
    // Primera vez: cualquier contraseña la seteamos como la correcta
    if (!stored) {
      localStorage.setItem(KEYS.auth, hash);
      _log('login', 'Primera sesión — contraseña configurada');
      return true;
    }
    if (stored === hash) {
      _log('login', 'Sesión iniciada');
      return true;
    }
    return false;
  }

  async function changePassword(oldPass, newPass) {
    const oldHash = await _hash(oldPass);
    if (localStorage.getItem(KEYS.auth) !== oldHash) return false;
    localStorage.setItem(KEYS.auth, await _hash(newPass));
    _log('security', 'Contraseña cambiada');
    return true;
  }

  function isLoggedIn() {
    return !!localStorage.getItem(KEYS.auth);
  }

  function logout() {
    // No borramos el hash, solo la sesión en memoria
    sessionStorage.removeItem('ss_admin_session');
  }

  // ─── LOG DE ACTIVIDAD ─────────────────────────────────────
  function _log(type, msg, data = null) {
    const log = _load(KEYS.log);
    log.unshift({ type, msg, data, ts: Date.now() });
    _save(KEYS.log, log.slice(0, 100)); // últimas 100 acciones
  }

  function getLog() { return _load(KEYS.log); }

  // ─── HELPERS ─────────────────────────────────────────────
  function _load(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  }
  function _save(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); return true; } catch { return false; }
  }
  function _loadObj(key) { return _load(key, {}); }

  // ─── MINIATURAS DE EPISODIOS ──────────────────────────────
  function getThumbs() { return _loadObj(KEYS.thumbs); }

  function setThumb(malId, epNum, url) {
    const thumbs = getThumbs();
    const key    = `${malId}:${epNum}`;
    if (url) {
      thumbs[key] = url.trim();
      _log('thumb', `Miniatura ep ${epNum} de anime ${malId} actualizada`);
    } else {
      delete thumbs[key];
      _log('thumb', `Miniatura ep ${epNum} de anime ${malId} eliminada`);
    }
    return _save(KEYS.thumbs, thumbs);
  }

  function getThumb(malId, epNum) {
    return getThumbs()[`${malId}:${epNum}`] || null;
  }

  function getThumbsForAnime(malId) {
    const all = getThumbs();
    const prefix = `${malId}:`;
    return Object.fromEntries(
      Object.entries(all)
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, v]) => [parseInt(k.split(':')[1]), v])
    );
  }

  function deleteAllThumbsForAnime(malId) {
    const thumbs = getThumbs();
    const prefix = `${malId}:`;
    let count = 0;
    Object.keys(thumbs).forEach(k => { if (k.startsWith(prefix)) { delete thumbs[k]; count++; } });
    _save(KEYS.thumbs, thumbs);
    _log('thumb', `${count} miniaturas eliminadas para anime ${malId}`);
    return count;
  }

  // ─── AON SLUGS ───────────────────────────────────────────
  function getAONSlugs() { return _loadObj(KEYS.aon); }

  function setAONSlug(malId, slug) {
    const slugs = getAONSlugs();
    slugs[String(malId)] = slug.trim();
    _log('aon', `Slug AON para ${malId}: "${slug}"`);
    return _save(KEYS.aon, slugs);
  }

  function removeAONSlug(malId) {
    const slugs = getAONSlugs();
    delete slugs[String(malId)];
    _log('aon', `Slug AON eliminado para ${malId}`);
    return _save(KEYS.aon, slugs);
  }

  // ─── ANIME DESTACADOS (FEATURED) ─────────────────────────
  function getFeatured() { return _load(KEYS.featured); }

  function addFeatured(anime, reason = 'Destacado manualmente') {
    const list = getFeatured();
    if (list.find(a => a.mal_id === anime.mal_id)) return false;
    list.unshift({
      mal_id:  anime.mal_id,
      title:   anime.title,
      image:   anime.image || '',
      score:   anime.score || null,
      reason,
      ts:      Date.now(),
    });
    _log('featured', `Anime "${anime.title}" (${anime.mal_id}) añadido a destacados`);
    return _save(KEYS.featured, list);
  }

  function removeFeatured(malId) {
    const list = getFeatured().filter(a => a.mal_id !== malId);
    _log('featured', `Anime ${malId} eliminado de destacados`);
    return _save(KEYS.featured, list);
  }

  function reorderFeatured(fromIdx, toIdx) {
    const list = getFeatured();
    const [item] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, item);
    return _save(KEYS.featured, list);
  }

  // ─── ANIME PERSONALIZADOS ────────────────────────────────
  function getCustomAnime() { return _load(KEYS.custom); }

  function saveCustomAnime(anime) {
    const list = getCustomAnime();
    const idx  = list.findIndex(a => a.id === anime.id);
    if (idx >= 0) list[idx] = anime;
    else list.unshift(anime);
    _log('custom', `Anime personalizado "${anime.title}" guardado`);
    return _save(KEYS.custom, list);
  }

  function deleteCustomAnime(id) {
    const list = getCustomAnime().filter(a => a.id !== id);
    _log('custom', `Anime personalizado ${id} eliminado`);
    return _save(KEYS.custom, list);
  }

  // ─── CONFIG OVERRIDES ────────────────────────────────────
  function getConfig() { return _loadObj(KEYS.cfg); }

  function saveConfig(overrides) {
    _log('config', 'Configuración actualizada', overrides);
    return _save(KEYS.cfg, overrides);
  }

  // Aplica las sobreescrituras al objeto CONFIG global
  function applyConfigOverrides() {
    const overrides = getConfig();
    Object.entries(overrides).forEach(([k, v]) => {
      if (k in CONFIG) CONFIG[k] = v;
    });
  }

  // ─── ESTADÍSTICAS ─────────────────────────────────────────
  function getStats() {
    const favs     = _load('ss_favorites');
    const history  = _load('ss_history');
    const watching = _loadObj('ss_watching');
    const thumbs   = getThumbs();
    const slugs    = getAONSlugs();
    const custom   = getCustomAnime();
    const featured = getFeatured();

    // Tamaño de localStorage
    let lsSize = 0;
    try {
      for (const k of Object.keys(localStorage)) {
        lsSize += (localStorage.getItem(k) || '').length;
      }
    } catch {}

    return {
      favorites:  favs.length,
      history:    history.length,
      watching:   Object.keys(watching).length,
      thumbOverrides: Object.keys(thumbs).length,
      aonSlugs:   Object.keys(slugs).length,
      customAnime: custom.length,
      featured:   featured.length,
      lsSizeKB:   Math.round(lsSize / 1024),
    };
  }

  // ─── EXPORT / IMPORT ─────────────────────────────────────
  function exportData() {
    const data = {
      version: '1.0',
      ts: Date.now(),
      thumbs:   getThumbs(),
      aon:      getAONSlugs(),
      featured: getFeatured(),
      custom:   getCustomAnime(),
      config:   getConfig(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `sakura-admin-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    _log('export', 'Backup exportado');
  }

  function importData(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (data.thumbs)   _save(KEYS.thumbs,   data.thumbs);
      if (data.aon)      _save(KEYS.aon,       data.aon);
      if (data.featured) _save(KEYS.featured,  data.featured);
      if (data.custom)   _save(KEYS.custom,    data.custom);
      if (data.config)   _save(KEYS.cfg,       data.config);
      _log('import', 'Backup importado', { version: data.version, ts: data.ts });
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  }

  function clearAllAdminData() {
    [KEYS.thumbs, KEYS.featured, KEYS.custom, KEYS.cfg, KEYS.log].forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });
  }

  // ─── HELPERS PÚBLICOS ────────────────────────────────────
  function formatDate(ts) {
    return new Date(ts).toLocaleString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return {
    login, logout, changePassword, isLoggedIn,
    // Thumbs
    getThumbs, setThumb, getThumb, getThumbsForAnime, deleteAllThumbsForAnime,
    // AON
    getAONSlugs, setAONSlug, removeAONSlug,
    // Featured
    getFeatured, addFeatured, removeFeatured, reorderFeatured,
    // Custom anime
    getCustomAnime, saveCustomAnime, deleteCustomAnime,
    // Config
    getConfig, saveConfig, applyConfigOverrides,
    // Stats
    getStats,
    // Log
    getLog,
    // IO
    exportData, importData, clearAllAdminData,
    // Utils
    formatDate,
  };
})();

window.Admin = Admin;
