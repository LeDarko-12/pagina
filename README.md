# 🌸 SakuraStream — Plataforma de Streaming de Anime

Una plataforma de streaming de anime moderna y completamente estática, diseñada para funcionar al 100% en **GitHub Pages** sin necesidad de backend.

![Preview](assets/og-image.jpg)

---

## ✨ Características

- 🎌 **Catálogo completo** desde Jikan API (MyAnimeList) con miles de anime
- 🔍 **Búsqueda en tiempo real** con debounce y filtros avanzados
- 🎞️ **Reproductor con múltiples servidores** de embed configurable
- 📺 **Lista de episodios** paginada con progreso de visualización
- ♥ **Sistema de favoritos** persistente (localStorage)
- 🕐 **Historial de reproducción** con "continuar viendo"
- 🎯 **Filtros por género, tipo y ordenamiento**
- ♾️ **Scroll infinito** en resultados de búsqueda
- 🌙 **Diseño Dark Mode** moderno tipo Netflix/Crunchyroll
- 📱 **Totalmente responsivo** para móvil, tablet y desktop
- ⚡ **Lazy loading** de imágenes para carga rápida
- 🗃️ **Caché** de API requests (15 min) para reducir peticiones

---

## 🚀 Despliegue en GitHub Pages

### Opción 1 — Subir directamente

```bash
# 1. Crea un repositorio en GitHub (ej: sakura-stream)
# 2. Clona el repo
git clone https://github.com/TU_USUARIO/sakura-stream.git

# 3. Copia todos los archivos del proyecto en la carpeta clonada
# 4. Sube los archivos
git add .
git commit -m "🌸 Initial commit: SakuraStream"
git push origin main

# 5. En GitHub → Settings → Pages → Source: main / root
# Tu sitio estará en: https://TU_USUARIO.github.io/sakura-stream
```

### Opción 2 — GitHub CLI

```bash
gh repo create sakura-stream --public
git init
git add .
git commit -m "🌸 SakuraStream"
gh repo set-default
git push -u origin main
# Activar Pages en Settings → Pages
```

---

## 📁 Estructura del Proyecto

```
sakura-stream/
├── index.html          ← Página principal (home)
├── anime.html          ← Página de detalle de anime
├── episode.html        ← Reproductor de episodio
├── search.html         ← Búsqueda y exploración
├── favorites.html      ← Favoritos e historial
├── css/
│   └── styles.css      ← Sistema de diseño completo
├── js/
│   ├── config.js       ← ⚙️ Configuración (servidores, API)
│   ├── api.js          ← Wrapper para Jikan API v4
│   ├── ui.js           ← Componentes de UI
│   ├── favorites.js    ← Favoritos e historial (localStorage)
│   ├── player.js       ← Reproductor de video
│   └── search.js       ← Búsqueda con filtros e infinite scroll
└── assets/
    ├── placeholder.jpg ← Imagen de placeholder para anime
    └── ep-placeholder.jpg ← Placeholder para episodios
```

---

## ⚙️ Configuración

Edita `js/config.js` para personalizar:

### Cambiar nombre del sitio
```javascript
siteName: 'MiAnimeStream',
siteTagline: 'Mi plataforma de anime',
```

### Agregar/modificar servidores de streaming
```javascript
embedServers: [
  {
    name: 'Mi Servidor',
    lang: 'sub',
    icon: '🟢',
    url: (slug, ep) => `https://mi-servidor.com/embed/${slug}-episode-${ep}`,
  },
  // ... más servidores
]
```

### Configurar el slug para el reproductor
El slug es el identificador usado por los servidores de streaming para encontrar el anime. Se genera automáticamente desde el título en inglés del anime, pero puede diferir de lo que usa el servidor.

**Ejemplo:**
- Título MAL: "Shingeki no Kyojin"
- Título en inglés: "Attack on Titan"
- Slug generado: `attack-on-titan`
- URL de embed: `https://emb.anitaku.to/?id=attack-on-titan-episode-1`

Si el embed no funciona, prueba ajustando el slug en la URL:
```
episode.html?anime=16498&ep=1&slug=shingeki-no-kyojin&title=Attack+on+Titan
```

---

## 🎮 API Utilizada

Este proyecto usa **[Jikan API v4](https://docs.api.jikan.moe/)**, el API no oficial de MyAnimeList. Es completamente gratuita y no requiere autenticación.

**Rate Limiting:** Jikan permite ~3 requests/segundo. El código incluye un request queue para respetarlo.

**Endpoints usados:**
| Endpoint | Uso |
|----------|-----|
| `GET /top/anime` | Trending, populares, mejor puntuados |
| `GET /seasons/now` | Temporada actual |
| `GET /anime/{id}/full` | Detalle del anime |
| `GET /anime/{id}/episodes` | Lista de episodios |
| `GET /anime/{id}/streaming` | Links de streaming oficial |
| `GET /anime/{id}/recommendations` | Recomendaciones |
| `GET /anime/{id}/characters` | Personajes |
| `GET /anime` | Búsqueda y filtros |

---

## 🛠️ Tecnologías

- **HTML5** — Estructura semántica
- **CSS3** — Sistema de diseño con CSS Custom Properties
- **JavaScript (ES6+)** — Sin frameworks externos
- **Google Fonts** — Tipografía: Syne + DM Sans + JetBrains Mono
- **Jikan API** — Datos de anime desde MyAnimeList
- **localStorage / sessionStorage** — Caché y persistencia de datos

---

## 📝 Notas Importantes

1. **Los servidores de embed** pueden no funcionar siempre. Son servicios de terceros que cambian frecuentemente sus URLs. Actualiza `js/config.js` con los servidores actuales.

2. **Jikan API** tiene un rate limit. Si aparecen errores 429, espera unos segundos y recarga. El caché de 15 minutos ayuda a reducir peticiones.

3. **CORS:** Los embeds de algunos servidores pueden bloquear iframes. En ese caso, el botón de "Ver también en:" mostrará links a servicios oficiales.

4. **Sin DMCA:** Este proyecto no aloja ningún video. Solo enlaza a reproductores externos. Úsalo responsablemente.

---

## 📄 Licencia

MIT — Libre para uso personal y educativo.

---

Hecho con ♥ para la comunidad otaku | Datos por [Jikan/MyAnimeList](https://jikan.moe)
