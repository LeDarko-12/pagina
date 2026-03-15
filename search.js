/**
 * SAKURA STREAM — Search & Filters
 * Búsqueda en tiempo real con filtros y scroll infinito
 */

const Search = (() => {
  let _state = {
    query:    '',
    genreId:  null,
    genreName: '',
    type:     '',
    status:   '',
    orderBy:  'score',
    page:     1,
    loading:  false,
    hasMore:  true,
    results:  [],
  };

  let _debounceTimer = null;

  // ─── INIT ─────────────────────────────────────────────────
  function init() {
    _readUrlParams();
    _bindEvents();
    _renderGenreFilters();
    _renderTypeFilters();
    _renderSortOptions();
    _doSearch(true);
    _initInfiniteScroll();
  }

  function _readUrlParams() {
    const p = new URLSearchParams(location.search);
    _state.query    = p.get('q') || '';
    _state.genreId  = p.get('genre') || null;
    _state.genreName = p.get('gname') || '';
    _state.type     = p.get('type') || '';
    _state.status   = p.get('status') || '';

    const input = document.getElementById('searchPageInput');
    if (input && _state.query) input.value = _state.query;

    // Actualizar título de la página
    if (_state.genreName) {
      UI.setPageMeta(`Género: ${_state.genreName}`);
      const subtitle = document.getElementById('searchSubtitle');
      if (subtitle) subtitle.textContent = `Explorando: ${_state.genreName}`;
    } else if (_state.query) {
      UI.setPageMeta(`Buscar: "${_state.query}"`);
    }
  }

  function _bindEvents() {
    const input = document.getElementById('searchPageInput');
    if (input) {
      input.addEventListener('input', () => {
        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(() => {
          _state.query = input.value.trim();
          _state.page = 1;
          _state.results = [];
          _state.hasMore = true;
          _updateUrl();
          _doSearch(true);
        }, 400);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(_debounceTimer);
          _state.query = input.value.trim();
          _state.page = 1;
          _state.results = [];
          _state.hasMore = true;
          _updateUrl();
          _doSearch(true);
        }
      });
    }
  }

  // ─── GENRE FILTER PILLS ──────────────────────────────────
  function _renderGenreFilters() {
    const container = document.getElementById('genreFilters');
    if (!container) return;

    container.innerHTML = `
      <button class="genre-pill${!_state.genreId ? ' active' : ''}" onclick="Search.setGenre(null, '')">Todos</button>
      ${CONFIG.popularGenres.map(g => `
        <button
          class="genre-pill${_state.genreId == g.id ? ' active' : ''}"
          onclick="Search.setGenre(${g.id}, '${g.name}')"
        >${g.name}</button>
      `).join('')}
    `;
  }

  function _renderTypeFilters() {
    const container = document.getElementById('typeFilters');
    if (!container) return;

    const types = [
      { val: '',       label: 'Todos' },
      { val: 'tv',     label: 'TV' },
      { val: 'movie',  label: 'Película' },
      { val: 'ova',    label: 'OVA' },
      { val: 'ona',    label: 'ONA' },
      { val: 'special',label: 'Especial' },
    ];

    container.innerHTML = types.map(t => `
      <button
        class="genre-pill${_state.type === t.val ? ' active' : ''}"
        onclick="Search.setType('${t.val}')"
      >${t.label}</button>
    `).join('');
  }

  function _renderSortOptions() {
    const sel = document.getElementById('sortSelect');
    if (!sel) return;

    const opts = [
      { val: 'score',    label: 'Mejor puntuación' },
      { val: 'popularity', label: 'Más popular' },
      { val: 'members',  label: 'Más miembros' },
      { val: 'title',    label: 'Título A-Z' },
      { val: 'start_date', label: 'Más reciente' },
    ];

    sel.innerHTML = opts.map(o => `<option value="${o.val}">${o.label}</option>`).join('');
    sel.value = _state.orderBy;
    sel.addEventListener('change', () => {
      _state.orderBy = sel.value;
      _state.page = 1;
      _state.results = [];
      _doSearch(true);
    });
  }

  // ─── SEARCH EXECUTION ────────────────────────────────────
  async function _doSearch(reset = false) {
    if (_state.loading) return;
    if (!_state.hasMore && !reset) return;

    _state.loading = true;
    _showLoading(reset);

    try {
      let data;

      // Búsqueda por género sin texto
      if (_state.genreId && !_state.query) {
        data = await API.getAnimeByGenre(_state.genreId, _state.page);
      } else {
        data = await API.searchAnime({
          q:        _state.query,
          genres:   _state.genreId || '',
          type:     _state.type,
          order_by: _state.orderBy,
          page:     _state.page,
        });
      }

      const newItems = data.data || [];
      _state.hasMore = !!data.pagination?.has_next_page;
      _state.page++;

      if (reset) _state.results = newItems;
      else _state.results = [..._state.results, ...newItems];

      _renderResults(reset);
      _updateCount(data.pagination?.items?.total || _state.results.length);
    } catch (e) {
      console.error('Search error:', e);
      _showError();
    } finally {
      _state.loading = false;
      _hideLoadingSpinner();
    }
  }

  function _renderResults(reset) {
    const grid = document.getElementById('searchResultsGrid');
    if (!grid) return;

    if (_state.results.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">🔍</div>
          <h3>Sin resultados</h3>
          <p style="color:var(--text-muted);margin-top:0.5rem">Intenta con otro término o ajusta los filtros</p>
        </div>`;
      return;
    }

    if (reset) {
      grid.innerHTML = _state.results.map(a => UI.renderAnimeCard(a)).join('');
    } else {
      _state.results.slice(-CONFIG.pageSize).forEach(a => {
        grid.insertAdjacentHTML('beforeend', UI.renderAnimeCard(a));
      });
    }
  }

  function _updateCount(total) {
    const el = document.getElementById('resultsCount');
    if (el) el.textContent = total ? `${total.toLocaleString()} resultados` : '';
  }

  function _showLoading(reset) {
    const spinner = document.getElementById('searchSpinner');
    if (spinner) spinner.style.display = 'block';
    if (reset) {
      const grid = document.getElementById('searchResultsGrid');
      if (grid) UI.renderSkeletonCards(12, 'searchResultsGrid');
    }
  }

  function _hideLoadingSpinner() {
    const spinner = document.getElementById('searchSpinner');
    if (spinner) spinner.style.display = 'none';
  }

  function _showError() {
    const grid = document.getElementById('searchResultsGrid');
    if (grid) grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">⚠️</div>
        <h3>Error al cargar</h3>
        <p style="color:var(--text-muted);margin-top:0.5rem">Verifica tu conexión e intenta de nuevo</p>
        <button class="btn btn-primary" style="margin-top:1rem" onclick="Search.retry()">Reintentar</button>
      </div>`;
  }

  // ─── INFINITE SCROLL ─────────────────────────────────────
  function _initInfiniteScroll() {
    const sentinel = document.getElementById('scrollSentinel');
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !_state.loading && _state.hasMore) {
        _doSearch(false);
      }
    }, { threshold: 0.1 });

    observer.observe(sentinel);
  }

  // ─── URL UPDATE ──────────────────────────────────────────
  function _updateUrl() {
    const url = new URL(window.location.href);
    if (_state.query) url.searchParams.set('q', _state.query);
    else url.searchParams.delete('q');
    history.replaceState(null, '', url.toString());
  }

  // ─── PUBLIC SETTERS ──────────────────────────────────────
  function setGenre(id, name) {
    _state.genreId  = id;
    _state.genreName = name;
    _state.page = 1;
    _state.results = [];
    _state.hasMore = true;

    // Actualizar pills
    document.querySelectorAll('#genreFilters .genre-pill').forEach((p, i) => {
      const isAll  = (id === null && p.textContent.trim() === 'Todos');
      const isThis = (id !== null && p.getAttribute('onclick')?.includes(`setGenre(${id},`));
      p.classList.toggle('active', isAll || isThis);
    });

    _doSearch(true);
  }

  function setType(type) {
    _state.type = type;
    _state.page = 1;
    _state.results = [];
    _state.hasMore = true;
    document.querySelectorAll('#typeFilters .genre-pill').forEach(p => {
      p.classList.toggle('active', p.textContent.toLowerCase() === type || (type === '' && p.textContent === 'Todos'));
    });
    _doSearch(true);
  }

  function retry() {
    _state.page = 1;
    _state.results = [];
    _state.hasMore = true;
    _doSearch(true);
  }

  return { init, setGenre, setType, retry };
})();
