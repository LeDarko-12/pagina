/**
 * SAKURA STREAM — Configuration
 * Modifica este archivo para personalizar la plataforma
 */

const CONFIG = {
  // ─── BRANDING ──────────────────────────────────────────
  siteName:    'Anime',
  siteTagline: 'Pagina de anime :)',
  siteUrl:     'https://tu-usuario.github.io/sakura-stream',

  // ─── JIKAN API (MyAnimeList) ────────────────────────────
  // Documentación: https://docs.api.jikan.moe/
  jikanBase: 'https://api.jikan.moe/v4',
  jikanDelay: 400, // ms entre requests (límite: 3/s)

  // ─── SERVIDORES DE EMBED ────────────────────────────────
  // Añade o modifica servers de streaming aquí
  // {slug} = slug del anime (ej: "shingeki-no-kyojin")
  // {ep}   = número de episodio
  embedServers: [
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

// Helper: convierte título a slug para URLs de embed
CONFIG.titleToSlug = (title) => {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

// Helper: obtiene URL de embed para un servidor específico
CONFIG.getEmbedUrl = (serverIndex, slug, ep) => {
  const server = CONFIG.embedServers[serverIndex];
  if (!server) return null;
  return server.url(slug, ep);
};
