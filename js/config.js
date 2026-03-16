/**
 * SAKURA STREAM — Configuration
 * Modifica este archivo para personalizar la plataforma
 */

const CONFIG = {
  // ─── BRANDING ──────────────────────────────────────────
  siteName:    'SakuraStream',
  siteTagline: 'Tu universo anime, un click de distancia',
  siteUrl:     'https://tu-usuario.github.io/sakura-stream',

  // ─── JIKAN API (MyAnimeList) ────────────────────────────
  jikanBase:  'https://api.jikan.moe/v4',
  jikanDelay: 400, // ms entre requests (límite: ~3/s)

  // ─── TMDB API (The Movie Database) ──────────────────────
  // Usada para: miniaturas de episodios + pósters alternativos
  tmdbKey:       '8a2de0488825903a0a4b7d0ff12a3873',
  tmdbBase:      'https://api.themoviedb.org/3',
  tmdbImageBase: 'https://image.tmdb.org/t/p/',
  tmdbEnabled:   true, // Pon en false para desactivar TMDB

  // ─── ANIMEONLINE.NINJA ──────────────────────────────────
  // Fuente de episodios en español
  aonBase:    'https://ww3.animeonline.ninja',
  aonEnabled: true,
  // Proxy CORS para scraping del lado del cliente
  // Si falla, prueba: 'https://api.allorigins.win/raw?url=' o 'https://corsproxy.io/?'
  corsProxy:  'https://corsproxy.io/?',

  // ─── SERVIDORES DE EMBED ────────────────────────────────
  // {slug} = slug del anime (ej: "shingeki-no-kyojin")
  // {ep}   = número de episodio
  embedServers: [
    // ── AnimeonlineNinja (auto-detectado vía scraper) ──
    {
      name: 'AON España',
      lang: 'sub-es',
      icon: '🌐',
      // El slug real se resuelve con AnimeonlineAPI.getEmbedUrl()
      // Esta URL es el fallback si el slug ya está configurado
      url: (slug, ep) => `https://ww3.animeonline.ninja/episodio/${slug}-${ep}/`,
    },
    // ── Gogoanime / Anitaku ────────────────────────────
    {
      name: 'Gogo SUB',
      lang: 'sub',
      icon: '🟢',
      url: (slug, ep) => `https://emb.anitaku.to/?id=${slug}-episode-${ep}`,
    },
    {
      name: 'Gogo DUB',
      lang: 'dub',
      icon: '🔵',
      url: (slug, ep) => `https://emb.anitaku.to/?id=${slug}-dub-episode-${ep}`,
    },
    // ── Servidores alternativos ────────────────────────
    {
      name: 'StreamSB',
      lang: 'sub',
      icon: '🟡',
      url: (slug, ep) => `https://watchsb.com/e/${slug}-${ep}`,
    },
    {
      name: 'Filemoon',
      lang: 'sub',
      icon: '🟠',
      url: (slug, ep) => `https://filemoon.sx/e/${slug}${ep}`,
    },
    {
      name: 'Doodstream',
      lang: 'sub',
      icon: '🔴',
      url: (slug, ep) => `https://dood.wf/e/${slug}${ep}`,
    },
    {
      name: 'VoeStream',
      lang: 'sub',
      icon: '🟣',
      url: (slug, ep) => `https://voe.sx/e/${slug}${ep}`,
    },
  ],

  // ─── GÉNEROS POPULARES PARA FILTROS ────────────────────
  popularGenres: [
    { id: 1,   name: 'Action' },
    { id: 2,   name: 'Adventure' },
    { id: 4,   name: 'Comedy' },
    { id: 8,   name: 'Drama' },
    { id: 10,  name: 'Fantasy' },
    { id: 14,  name: 'Horror' },
    { id: 7,   name: 'Mystery' },
    { id: 22,  name: 'Romance' },
    { id: 24,  name: 'Sci-Fi' },
    { id: 36,  name: 'Slice of Life' },
    { id: 30,  name: 'Sports' },
    { id: 37,  name: 'Supernatural' },
    { id: 41,  name: 'Suspense' },
    { id: 9,   name: 'Ecchi' },
    { id: 50,  name: 'Adult Cast' },
  ],

  // ─── CACHÉ ─────────────────────────────────────────────
  cacheExpiry: 15 * 60 * 1000, // 15 minutos en ms

  // ─── PAGINACIÓN ────────────────────────────────────────
  pageSize: 24,
};

// ─── HELPERS ──────────────────────────────────────────────

/** Convierte título a slug para URLs de embed */
CONFIG.titleToSlug = (title) => {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

/** URL de embed para un servidor dado */
CONFIG.getEmbedUrl = (serverIndex, slug, ep) => {
  const server = CONFIG.embedServers[serverIndex];
  if (!server) return null;
  return server.url(slug, ep);
};

/** URL de imagen TMDB */
CONFIG.tmdbImage = (path, size = 'w500') => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${CONFIG.tmdbImageBase}${size}${path}`;
};
