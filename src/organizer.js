// organizer.js — Mode selection, drag-and-drop, arrangement

let _state, _helpers;
let pageSortable = null;
let blockSortable = null;

export function initOrganizer(state, helpers) {
  _state = state;
  _helpers = helpers;

  const modePageBtn = document.getElementById('mode-page');
  const modeBlockBtn = document.getElementById('mode-block');

  modePageBtn.addEventListener('click', () => switchMode('page'));
  modeBlockBtn.addEventListener('click', () => switchMode('block'));

  // Listen for organize-ready event
  window.addEventListener('organize-ready', () => renderWorkspace());

  // Filename input
  const filenameInput = document.getElementById('filename-input');
  const exportBtn = document.getElementById('export-btn');
  filenameInput.addEventListener('input', () => {
    let val = filenameInput.value.replace(/[/\\:*?"<>|]/g, '');
    _state.exportFilename = val;
    updateExportButton();
  });
}

function updateExportButton() {
  const exportBtn = document.getElementById('export-btn');
  const hasPages = _helpers.getArrangedPages().length > 0;
  const hasName = _state.exportFilename.trim().length > 0;
  exportBtn.disabled = !hasPages || !hasName;
}

function switchMode(newMode) {
  if (newMode === _state.mode) return;

  if (newMode === 'block' && _state.mode === 'page') {
    if (!confirm('Switching to block mode will reset your page arrangement. Continue?')) return;
    _state.removedPages = [];
  }

  _state.mode = newMode;
  _helpers.buildArrangement();

  // Update mode buttons
  document.getElementById('mode-page').classList.toggle('active', newMode === 'page');
  document.getElementById('mode-page').setAttribute('aria-checked', newMode === 'page');
  document.getElementById('mode-block').classList.toggle('active', newMode === 'block');
  document.getElementById('mode-block').setAttribute('aria-checked', newMode === 'block');

  renderWorkspace();
}

function renderWorkspace() {
  if (_state.mode === 'page') {
    document.getElementById('page-workspace').classList.remove('hidden');
    document.getElementById('block-workspace').classList.add('hidden');
    renderPageGrid();
  } else {
    document.getElementById('page-workspace').classList.add('hidden');
    document.getElementById('block-workspace').classList.remove('hidden');
    renderBlockList();
  }
  updateRemovedTray();
  updateExportButton();
}

// === Page-by-Page Mode ===

function renderPageGrid() {
  const grid = document.getElementById('page-grid');
  grid.innerHTML = '';

  const pageMap = new Map();
  _state.files.forEach(f => f.pages.forEach(p => pageMap.set(p.id, p)));

  _state.arrangement.forEach((pageId, idx) => {
    const page = pageMap.get(pageId);
    if (!page) return;
    const thumb = createPageThumb(page, idx + 1);
    grid.appendChild(thumb);
  });

  // Init SortableJS
  if (pageSortable) pageSortable.destroy();
  pageSortable = new Sortable(grid, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    onEnd: (evt) => {
      // Update arrangement
      const items = grid.querySelectorAll('.page-thumb');
      _state.arrangement = Array.from(items).map(el => el.dataset.pageId);
      updateSequenceNumbers();
    },
  });
}

function createPageThumb(page, seqNum) {
  const div = document.createElement('div');
  div.className = 'page-thumb';
  div.dataset.pageId = page.id;
  div.setAttribute('tabindex', '0');
  div.setAttribute('role', 'listitem');
  div.setAttribute('aria-label', page.annotations.length > 0
    ? `${page.label} (annotated)` : page.label);

  // Sequence number
  const seq = document.createElement('span');
  seq.className = 'page-thumb-seq';
  seq.textContent = seqNum;
  div.appendChild(seq);

  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.className = 'page-thumb-remove';
  removeBtn.innerHTML = '&times;';
  removeBtn.title = 'Remove page';
  removeBtn.setAttribute('aria-label', `Remove ${page.label}`);
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removePage(page.id);
  });
  div.appendChild(removeBtn);

  // Thumbnail canvas
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'page-thumb-canvas-wrap';
  const img = new Image();
  img.src = page.thumbnailDataUrl;
  img.alt = page.annotations.length > 0
    ? `Page ${page.pageIndex + 1} of ${getFileName(page.sourceFileId)} (annotated)`
    : `Page ${page.pageIndex + 1} of ${getFileName(page.sourceFileId)}`;
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'contain';
  canvasWrap.appendChild(img);
  div.appendChild(canvasWrap);

  // Annotation indicator
  if (page.annotations.length > 0) {
    const dot = document.createElement('div');
    dot.className = 'page-thumb-annotated';
    div.appendChild(dot);
  }

  // Label
  const label = document.createElement('div');
  label.className = 'page-thumb-label';
  label.textContent = page.label;
  div.appendChild(label);

  // Click to open markup
  div.addEventListener('click', (e) => {
    if (e.target.closest('.page-thumb-remove')) return;
    window.dispatchEvent(new CustomEvent('open-markup', { detail: { pageId: page.id } }));
  });

  return div;
}

function getFileName(fileId) {
  const file = _helpers.getFileById(fileId);
  return file ? file.name : 'Unknown';
}

function updateSequenceNumbers() {
  const grid = document.getElementById('page-grid');
  grid.querySelectorAll('.page-thumb-seq').forEach((el, i) => {
    el.textContent = i + 1;
  });
}

function removePage(pageId) {
  _state.arrangement = _state.arrangement.filter(id => id !== pageId);
  _state.removedPages.push(pageId);
  renderPageGrid();
  updateRemovedTray();
}

function restorePage(pageId) {
  _state.removedPages = _state.removedPages.filter(id => id !== pageId);
  _state.arrangement.push(pageId);
  renderPageGrid();
  updateRemovedTray();
}

function deletePagePermanently(pageId) {
  // Remove from removedPages list
  _state.removedPages = _state.removedPages.filter(id => id !== pageId);
  // Remove from the source file's pages array
  for (const file of _state.files) {
    const idx = file.pages.findIndex(p => p.id === pageId);
    if (idx >= 0) {
      file.pages.splice(idx, 1);
      file.pageCount = file.pages.length;
      break;
    }
  }
  updateRemovedTray();
  updateExportButton();
}

function updateRemovedTray() {
  const tray = document.getElementById('removed-tray');
  const grid = document.getElementById('removed-grid');

  if (_state.mode !== 'page' || _state.removedPages.length === 0) {
    tray.classList.add('hidden');
    return;
  }

  tray.classList.remove('hidden');
  grid.innerHTML = '';

  const pageMap = new Map();
  _state.files.forEach(f => f.pages.forEach(p => pageMap.set(p.id, p)));

  _state.removedPages.forEach(pageId => {
    const page = pageMap.get(pageId);
    if (!page) return;

    const thumb = document.createElement('div');
    thumb.className = 'removed-thumb';

    const addBtn = document.createElement('button');
    addBtn.className = 'removed-thumb-add';
    addBtn.textContent = '+';
    addBtn.title = 'Restore page';
    addBtn.setAttribute('aria-label', `Restore ${page.label}`);
    addBtn.addEventListener('click', () => restorePage(pageId));
    thumb.appendChild(addBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'removed-thumb-delete';
    deleteBtn.textContent = '−';
    deleteBtn.title = 'Delete permanently';
    deleteBtn.setAttribute('aria-label', `Permanently delete ${page.label}`);
    deleteBtn.addEventListener('click', () => deletePagePermanently(pageId));
    thumb.appendChild(deleteBtn);

    const img = new Image();
    img.src = page.thumbnailDataUrl;
    img.alt = `Page ${page.pageIndex + 1} of ${getFileName(page.sourceFileId)}`;
    img.style.width = '100%';
    img.style.aspectRatio = '0.707';
    img.style.objectFit = 'contain';
    thumb.appendChild(img);

    const label = document.createElement('div');
    label.className = 'removed-thumb-label';
    label.textContent = page.label;
    thumb.appendChild(label);

    grid.appendChild(thumb);
  });
}

// === PDF Block Mode ===

function renderBlockList() {
  const list = document.getElementById('block-list');
  list.innerHTML = '';

  _state.arrangement.forEach(fileId => {
    const file = _helpers.getFileById(fileId);
    if (!file || file.status !== 'ready') return;
    list.appendChild(createBlockItem(file));
  });

  if (blockSortable) blockSortable.destroy();
  blockSortable = new Sortable(list, {
    animation: 150,
    handle: '.block-drag-handle',
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    onEnd: () => {
      const items = list.querySelectorAll('.block-item');
      _state.arrangement = Array.from(items).map(el => el.dataset.fileId);
    },
  });
}

function createBlockItem(file) {
  const div = document.createElement('div');
  div.className = 'block-item';
  div.dataset.fileId = file.id;

  // Header row
  const header = document.createElement('div');
  header.className = 'block-header';

  const handle = document.createElement('span');
  handle.className = 'block-drag-handle';
  handle.textContent = '☰';
  handle.setAttribute('aria-label', 'Drag handle');
  header.appendChild(handle);

  // Preview thumbnail (first page)
  const preview = document.createElement('div');
  preview.className = 'block-preview';
  if (file.pages.length > 0) {
    const img = new Image();
    img.src = file.pages[0].thumbnailDataUrl;
    img.alt = `First page of ${file.name}`;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    preview.appendChild(img);
  }
  header.appendChild(preview);

  const info = document.createElement('div');
  info.className = 'block-info';
  const name = document.createElement('div');
  name.className = 'block-name';
  name.textContent = file.name;
  info.appendChild(name);
  const pages = document.createElement('div');
  pages.className = 'block-pages';
  pages.textContent = `${file.pageCount} page${file.pageCount !== 1 ? 's' : ''}`;
  info.appendChild(pages);
  header.appendChild(info);

  // Expand button
  const expandBtn = document.createElement('button');
  expandBtn.className = 'block-expand-btn';
  expandBtn.textContent = '›';
  expandBtn.title = 'Show pages';
  expandBtn.setAttribute('aria-label', `Expand ${file.name}`);
  header.appendChild(expandBtn);

  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.className = 'block-remove-btn';
  removeBtn.innerHTML = '&times;';
  removeBtn.title = 'Remove PDF';
  removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
  header.appendChild(removeBtn);

  div.appendChild(header);

  // Pages preview (collapsed by default)
  const pagesPreview = document.createElement('div');
  pagesPreview.className = 'block-pages-preview hidden';
  file.pages.forEach(page => {
    const mini = document.createElement('div');
    mini.className = 'block-page-mini';
    const img = new Image();
    img.src = page.thumbnailDataUrl;
    img.alt = page.label;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    mini.appendChild(img);
    mini.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('open-markup', { detail: { pageId: page.id } }));
    });
    pagesPreview.appendChild(mini);
  });
  div.appendChild(pagesPreview);

  // Expand toggle
  expandBtn.addEventListener('click', () => {
    pagesPreview.classList.toggle('hidden');
    expandBtn.classList.toggle('expanded');
  });

  // Remove block
  removeBtn.addEventListener('click', () => {
    _state.arrangement = _state.arrangement.filter(id => id !== file.id);
    renderBlockList();
    _helpers.showToast(`Removed ${file.name}.`, () => {
      _state.arrangement.push(file.id);
      renderBlockList();
    });
  });

  return div;
}

// Export renderWorkspace for external use
export { renderWorkspace };
