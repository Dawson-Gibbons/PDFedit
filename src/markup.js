// markup.js — Markup modal, annotation canvas, tool handling

let _state, _helpers;
let currentPageId = null;
let activeTool = null;
let isDrawing = false;
let drawStart = null;
let pdfCanvas, annotCanvas, pdfCtx, annotCtx;
let currentPdfPage = null;
let currentViewport = null;

export function initMarkup(state, helpers) {
  _state = state;
  _helpers = helpers;

  pdfCanvas = document.getElementById('markup-pdf-canvas');
  annotCanvas = document.getElementById('markup-annotation-canvas');
  pdfCtx = pdfCanvas.getContext('2d');
  annotCtx = annotCanvas.getContext('2d');

  // Listen for open-markup event
  window.addEventListener('open-markup', (e) => openMarkup(e.detail.pageId));

  // Close button
  document.getElementById('markup-close').addEventListener('click', closeMarkup);

  // Navigation
  document.getElementById('markup-prev').addEventListener('click', () => navigate(-1));
  document.getElementById('markup-next').addEventListener('click', () => navigate(1));

  // Keyboard nav
  document.addEventListener('keydown', (e) => {
    if (!isModalOpen()) return;
    if (e.key === 'Escape') closeMarkup();
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });

  // Tool buttons
  document.querySelectorAll('.markup-toolbar .tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (tool === 'undo') { undo(); return; }
      if (tool === 'redo') { redo(); return; }
      setActiveTool(tool === activeTool ? null : tool);
    });
  });

  // Color swatches
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      _state.markupColor = swatch.dataset.color;
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
    });
  });

  // Canvas drawing events
  annotCanvas.addEventListener('mousedown', onDrawStart);
  annotCanvas.addEventListener('mousemove', onDrawMove);
  annotCanvas.addEventListener('mouseup', onDrawEnd);
  annotCanvas.addEventListener('mouseleave', onDrawEnd);

  // Touch support
  annotCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    onDrawStart(touch);
  });
  annotCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    onDrawMove(touch);
  });
  annotCanvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    onDrawEnd(e);
  });

  // Click on modal backdrop to close
  document.getElementById('markup-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('markup-modal')) closeMarkup();
  });
}

function isModalOpen() {
  return !document.getElementById('markup-modal').classList.contains('hidden');
}

function openMarkup(pageId) {
  currentPageId = pageId;
  document.getElementById('markup-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setActiveTool(null);
  renderPage();
  updateNavIndicator();
}

function closeMarkup() {
  document.getElementById('markup-modal').classList.add('hidden');
  document.body.style.overflow = '';
  currentPageId = null;
  activeTool = null;

  // Re-render workspace thumbnails to show annotation indicators
  window.dispatchEvent(new CustomEvent('organize-ready'));
}

function navigate(dir) {
  const pages = _helpers.getArrangedPages();
  const idx = pages.findIndex(p => p.id === currentPageId);
  const newIdx = idx + dir;
  if (newIdx >= 0 && newIdx < pages.length) {
    currentPageId = pages[newIdx].id;
    setActiveTool(null);
    renderPage();
    updateNavIndicator();
  }
}

function updateNavIndicator() {
  const pages = _helpers.getArrangedPages();
  const idx = pages.findIndex(p => p.id === currentPageId);
  document.getElementById('markup-page-indicator').textContent = `Page ${idx + 1} of ${pages.length}`;
  document.getElementById('markup-prev').disabled = idx === 0;
  document.getElementById('markup-next').disabled = idx === pages.length - 1;
}

function setActiveTool(tool) {
  activeTool = tool;
  _state.activeMarkupTool = tool;

  document.querySelectorAll('.markup-toolbar .tool-btn[data-tool]').forEach(btn => {
    const t = btn.dataset.tool;
    if (t === 'undo' || t === 'redo') return;
    const isActive = t === tool;
    btn.setAttribute('aria-pressed', isActive);
    btn.classList.toggle('active', isActive);
  });

  // Update cursor
  annotCanvas.classList.remove('tool-active', 'tool-eraser');
  if (tool && tool !== 'eraser') {
    annotCanvas.classList.add('tool-active');
  } else if (tool === 'eraser') {
    annotCanvas.classList.add('tool-eraser');
  }
}

async function renderPage() {
  const page = _helpers.getPageById(currentPageId);
  if (!page) return;

  const file = _helpers.getFileById(page.sourceFileId);
  if (!file) return;

  // Load PDF page
  const pdfDoc = await pdfjsLib.getDocument({ data: file.pdfBytes.slice(0) }).promise;
  currentPdfPage = await pdfDoc.getPage(page.pageIndex + 1);

  // Calculate viewport to fit container
  const container = document.querySelector('.markup-canvas-container');
  const maxWidth = Math.min(container.clientWidth - 32, 800);
  const baseViewport = currentPdfPage.getViewport({ scale: 1 });
  const scale = maxWidth / baseViewport.width;
  currentViewport = currentPdfPage.getViewport({ scale });

  // Set canvas sizes
  pdfCanvas.width = currentViewport.width;
  pdfCanvas.height = currentViewport.height;
  annotCanvas.width = currentViewport.width;
  annotCanvas.height = currentViewport.height;

  // Position annotation canvas over PDF canvas
  annotCanvas.style.left = pdfCanvas.offsetLeft + 'px';
  annotCanvas.style.top = pdfCanvas.offsetTop + 'px';
  annotCanvas.style.width = pdfCanvas.clientWidth + 'px';
  annotCanvas.style.height = pdfCanvas.clientHeight + 'px';

  // Render PDF
  await currentPdfPage.render({
    canvasContext: pdfCtx,
    viewport: currentViewport,
  }).promise;

  // Position annotation canvas properly after render
  requestAnimationFrame(() => {
    const rect = pdfCanvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    annotCanvas.style.left = (rect.left - containerRect.left + container.scrollLeft) + 'px';
    annotCanvas.style.top = (rect.top - containerRect.top + container.scrollTop) + 'px';
    annotCanvas.style.width = rect.width + 'px';
    annotCanvas.style.height = rect.height + 'px';
  });

  // Draw existing annotations
  drawAnnotations(page);
}

function drawAnnotations(page) {
  annotCtx.clearRect(0, 0, annotCanvas.width, annotCanvas.height);

  page.annotations.forEach(ann => {
    const x1 = ann.startX * annotCanvas.width;
    const y1 = ann.startY * annotCanvas.height;
    const x2 = ann.endX * annotCanvas.width;
    const y2 = ann.endY * annotCanvas.height;

    if (ann.type === 'highlight') {
      annotCtx.fillStyle = ann.color + hexOpacity(ann.opacity);
      annotCtx.fillRect(
        Math.min(x1, x2), Math.min(y1, y2),
        Math.abs(x2 - x1), Math.abs(y2 - y1)
      );
    } else if (ann.type === 'underline' || ann.type === 'strikethrough') {
      annotCtx.strokeStyle = ann.color;
      annotCtx.lineWidth = ann.strokeWidth * annotCanvas.width;
      annotCtx.beginPath();
      annotCtx.moveTo(x1, y1);
      annotCtx.lineTo(x2, y2);
      annotCtx.stroke();
    }
  });
}

function hexOpacity(opacity) {
  const hex = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return hex;
}

function getCanvasCoords(e) {
  const rect = annotCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
}

function onDrawStart(e) {
  if (!activeTool || !currentPageId) return;
  const page = _helpers.getPageById(currentPageId);
  if (!page) return;

  const coords = getCanvasCoords(e);

  if (activeTool === 'eraser') {
    // Find and remove annotation at click point
    const hitIdx = findAnnotationAt(page, coords.x, coords.y);
    if (hitIdx >= 0) {
      saveUndoState(page);
      page.annotations.splice(hitIdx, 1);
      drawAnnotations(page);
    }
    return;
  }

  isDrawing = true;
  drawStart = coords;
}

function onDrawMove(e) {
  if (!isDrawing || !activeTool || !currentPageId) return;
  const page = _helpers.getPageById(currentPageId);
  if (!page) return;

  const coords = getCanvasCoords(e);

  // Preview the annotation being drawn
  drawAnnotations(page);
  drawPreview(coords);
}

function drawPreview(coords) {
  const x1 = drawStart.x * annotCanvas.width;
  const y1 = drawStart.y * annotCanvas.height;
  const x2 = coords.x * annotCanvas.width;
  const y2 = coords.y * annotCanvas.height;

  if (activeTool === 'highlight') {
    annotCtx.fillStyle = _state.markupColor + hexOpacity(0.4);
    annotCtx.fillRect(
      Math.min(x1, x2), Math.min(y1, y2),
      Math.abs(x2 - x1), Math.abs(y2 - y1)
    );
  } else if (activeTool === 'underline' || activeTool === 'strikethrough') {
    let finalY1 = y1, finalY2 = y2;

    // Snap to horizontal if within 15 degrees
    const angle = Math.abs(Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI);
    if (angle < 15 || angle > 165) {
      const midY = activeTool === 'strikethrough' ? (y1 + y2) / 2 : Math.max(y1, y2);
      finalY1 = midY;
      finalY2 = midY;
    } else if (activeTool === 'strikethrough') {
      finalY1 = (y1 + y2) / 2;
      finalY2 = (y1 + y2) / 2;
    }

    annotCtx.strokeStyle = _state.markupColor;
    annotCtx.lineWidth = 2;
    annotCtx.beginPath();
    annotCtx.moveTo(x1, finalY1);
    annotCtx.lineTo(x2, finalY2);
    annotCtx.stroke();
  }
}

function onDrawEnd(e) {
  if (!isDrawing || !activeTool || !currentPageId) return;
  isDrawing = false;

  const page = _helpers.getPageById(currentPageId);
  if (!page) return;

  let coords;
  if (e.clientX !== undefined) {
    coords = getCanvasCoords(e);
  } else {
    // Touch end doesn't have coords, use last known position
    coords = drawStart;
  }

  // Minimum drag distance check
  const dx = Math.abs(coords.x - drawStart.x);
  const dy = Math.abs(coords.y - drawStart.y);
  if (dx < 0.005 && dy < 0.005) {
    drawAnnotations(page);
    return;
  }

  saveUndoState(page);

  if (activeTool === 'highlight') {
    page.annotations.push({
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      type: 'highlight',
      color: _state.markupColor,
      opacity: 0.4,
      startX: Math.min(drawStart.x, coords.x),
      startY: Math.min(drawStart.y, coords.y),
      endX: Math.max(drawStart.x, coords.x),
      endY: Math.max(drawStart.y, coords.y),
      strokeWidth: 0,
    });
  } else if (activeTool === 'underline' || activeTool === 'strikethrough') {
    let sy = drawStart.y, ey = coords.y;
    const angle = Math.abs(Math.atan2(ey - sy, coords.x - drawStart.x) * 180 / Math.PI);
    if (angle < 15 || angle > 165) {
      const midY = activeTool === 'strikethrough' ? (sy + ey) / 2 : Math.max(sy, ey);
      sy = midY;
      ey = midY;
    } else if (activeTool === 'strikethrough') {
      const midY = (sy + ey) / 2;
      sy = midY;
      ey = midY;
    }

    page.annotations.push({
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      type: activeTool,
      color: _state.markupColor,
      opacity: 1,
      startX: drawStart.x,
      startY: sy,
      endX: coords.x,
      endY: ey,
      strokeWidth: 0.002,
    });
  }

  drawAnnotations(page);
  drawStart = null;
}

function findAnnotationAt(page, x, y) {
  // Check in reverse order (top annotations first)
  for (let i = page.annotations.length - 1; i >= 0; i--) {
    const ann = page.annotations[i];
    if (ann.type === 'highlight') {
      if (x >= ann.startX && x <= ann.endX && y >= ann.startY && y <= ann.endY) {
        return i;
      }
    } else {
      // Line: check proximity
      const dist = pointToLineDistance(x, y, ann.startX, ann.startY, ann.endX, ann.endY);
      if (dist < 0.02) return i;
    }
  }
  return -1;
}

function pointToLineDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
}

function saveUndoState(page) {
  page.annotationHistory.undoStack.push(JSON.parse(JSON.stringify(page.annotations)));
  page.annotationHistory.redoStack = [];
}

function undo() {
  const page = _helpers.getPageById(currentPageId);
  if (!page || page.annotationHistory.undoStack.length === 0) return;
  page.annotationHistory.redoStack.push(JSON.parse(JSON.stringify(page.annotations)));
  page.annotations = page.annotationHistory.undoStack.pop();
  drawAnnotations(page);
}

function redo() {
  const page = _helpers.getPageById(currentPageId);
  if (!page || page.annotationHistory.redoStack.length === 0) return;
  page.annotationHistory.undoStack.push(JSON.parse(JSON.stringify(page.annotations)));
  page.annotations = page.annotationHistory.redoStack.pop();
  drawAnnotations(page);
}
