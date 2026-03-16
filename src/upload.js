// upload.js — File upload handling and validation

let _state, _helpers;

export function initUpload(state, helpers) {
  _state = state;
  _helpers = helpers;

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const addMoreInput = document.getElementById('add-more-input');
  const addMoreBtn = document.getElementById('add-more-btn');
  const addMoreProgressBtn = document.getElementById('add-more-progress-btn');

  // Drop zone click
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });

  // Drag events
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });

  // File input change
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  });

  // Add more PDFs
  addMoreBtn.addEventListener('click', () => addMoreInput.click());
  addMoreInput.addEventListener('change', (e) => {
    handleFiles(e.target.files, true);
    e.target.value = '';
  });

  addMoreProgressBtn.addEventListener('click', () => {
    fileInput.click();
  });
}

async function handleFiles(fileList, isAdding = false) {
  const files = Array.from(fileList);
  if (files.length === 0) return;

  // Validate file types
  const validFiles = [];
  const errors = [];

  for (const file of files) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      errors.push({ name: file.name, error: 'Only PDF files are accepted.' });
      continue;
    }
    if (file.size === 0) {
      errors.push({ name: file.name, error: 'This file appears to be corrupted.' });
      continue;
    }
    validFiles.push(file);
  }

  if (validFiles.length === 0 && errors.length > 0) {
    errors.forEach(e => _helpers.showToast(`${e.name}: ${e.error}`));
    return;
  }

  // Handle duplicate filenames
  const existingNames = _state.files.map(f => f.name);
  validFiles.forEach(f => {
    let name = f.name;
    let count = 1;
    while (existingNames.includes(name)) {
      count++;
      const base = f.name.replace(/\.pdf$/i, '');
      name = `${base} (${count}).pdf`;
    }
    f._displayName = name;
    existingNames.push(name);
  });

  // Check total size warning
  const totalSize = [..._state.files, ...validFiles].reduce((s, f) => s + (f.size || 0), 0);
  if (totalSize > 200 * 1024 * 1024) {
    _helpers.showToast('Large files may cause slow performance.');
  }

  // Check file count warning
  const totalFiles = _state.files.length + validFiles.length;
  if (totalFiles > 10) {
    _helpers.showToast('Performance may vary with this many files. Consider working in batches.');
  }

  _helpers.setPhase('progress');

  // Show errors for rejected files
  errors.forEach(e => {
    showFileError(e.name, e.error);
  });

  // Process each valid file
  const results = await processFiles(validFiles);

  // Check if all failed
  const successCount = results.filter(r => r.status === 'ready').length +
    (isAdding ? _state.files.filter(f => f.status === 'ready').length : 0);
  const failCount = results.filter(r => r.status === 'failed').length + errors.length;

  if (successCount === 0) {
    _helpers.showToast('All files failed to process.');
    _helpers.setPhase('upload');
    return;
  }

  // Add to state
  results.forEach(r => _helpers.addProcessedFile(r));

  // Check total pages
  const totalPages = _state.files.reduce((sum, f) => sum + (f.status === 'ready' ? f.pageCount : 0), 0);
  if (totalPages > 100) {
    _helpers.showToast('Performance may vary with this many pages. Consider working in batches.');
  }

  // Single file single page — skip to organize
  if (successCount === 1 && totalPages === 1 && failCount === 0) {
    _helpers.buildArrangement();
    _helpers.setPhase('organize');
    // Pre-fill filename
    const readyFile = _state.files.find(f => f.status === 'ready');
    if (readyFile) {
      document.getElementById('filename-input').value = readyFile.name.replace(/\.pdf$/i, '');
      _state.exportFilename = readyFile.name.replace(/\.pdf$/i, '');
      document.getElementById('export-btn').disabled = false;
    }
    window.dispatchEvent(new CustomEvent('organize-ready'));
    return;
  }

  if (failCount > 0) {
    // Show continue button
    document.getElementById('continue-btn').classList.remove('hidden');
    document.getElementById('continue-btn').textContent = `Continue with ${successCount} successful file${successCount !== 1 ? 's' : ''}`;
    document.getElementById('continue-btn').onclick = () => {
      _helpers.buildArrangement();
      _helpers.setPhase('organize');
      prefillFilename();
      window.dispatchEvent(new CustomEvent('organize-ready'));
    };
  } else {
    // Auto-transition
    _helpers.buildArrangement();
    _helpers.setPhase('organize');
    prefillFilename();
    window.dispatchEvent(new CustomEvent('organize-ready'));
  }
}

function prefillFilename() {
  const readyFiles = _state.files.filter(f => f.status === 'ready');
  if (readyFiles.length === 1) {
    const name = readyFiles[0].name.replace(/\.pdf$/i, '');
    document.getElementById('filename-input').value = name;
    _state.exportFilename = name;
    document.getElementById('export-btn').disabled = false;
  }
}

function showFileError(name, error) {
  const list = document.getElementById('file-progress-list');
  const item = document.createElement('div');
  item.className = 'file-progress-item';
  item.innerHTML = `
    <div class="file-progress-header">
      <span class="file-progress-name">${escapeHtml(name)}</span>
      <span style="color:var(--red);font-weight:600;">✕ Failed</span>
    </div>
    <div class="file-progress-error">${escapeHtml(error)}</div>
  `;
  list.appendChild(item);
}

async function processFiles(files) {
  const list = document.getElementById('file-progress-list');
  const overallLabel = document.getElementById('overall-progress-label');
  const overallFill = document.getElementById('overall-progress-fill');
  const overallBar = document.getElementById('overall-progress-bar');

  const results = [];
  let completedCount = 0;

  // Create progress items for each file
  const progressItems = files.map((file, i) => {
    const item = document.createElement('div');
    item.className = 'file-progress-item';
    item.innerHTML = `
      <div class="file-progress-header">
        <span class="file-progress-name">${escapeHtml(file._displayName || file.name)}</span>
        <span class="file-progress-size">${formatSize(file.size)}</span>
      </div>
      <div class="progress-bar-track" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-bar-fill" id="file-progress-${i}"></div>
      </div>
      <div class="file-progress-status" id="file-status-${i}">Reading...</div>
    `;
    list.appendChild(item);
    return { item, fillId: `file-progress-${i}`, statusId: `file-status-${i}` };
  });

  function updateOverall() {
    const pct = Math.round((completedCount / files.length) * 100);
    overallFill.style.width = pct + '%';
    overallBar.setAttribute('aria-valuenow', pct);
    overallLabel.textContent = `Processing ${completedCount} of ${files.length} files...`;
  }
  updateOverall();

  // Process each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fill = document.getElementById(progressItems[i].fillId);
    const statusEl = document.getElementById(progressItems[i].statusId);

    try {
      // Phase 1: Read file
      statusEl.textContent = 'Reading file...';
      fill.style.width = '10%';
      const arrayBuffer = await readFileAsArrayBuffer(file);
      fill.style.width = '40%';

      // Validate PDF magic bytes
      const header = new Uint8Array(arrayBuffer.slice(0, 5));
      const headerStr = String.fromCharCode(...header);
      if (!headerStr.startsWith('%PDF')) {
        throw new Error('This file is not a valid PDF.');
      }

      // Phase 2: Parse with pdf.js
      statusEl.textContent = 'Parsing PDF...';
      fill.style.width = '50%';

      let pdfDoc;
      try {
        pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
      } catch (err) {
        if (err.name === 'PasswordException') {
          throw new Error('This PDF is password-protected and cannot be processed.');
        }
        throw new Error('Could not read this file.');
      }

      const pageCount = pdfDoc.numPages;
      statusEl.textContent = `Generating thumbnails (${pageCount} pages)...`;
      fill.style.width = '60%';

      // Generate thumbnails
      const pages = [];
      for (let p = 1; p <= pageCount; p++) {
        const page = await pdfDoc.getPage(p);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const displayName = file._displayName || file.name;

        pages.push({
          id: _helpers.uuid(),
          sourceFileId: null, // set below
          pageIndex: p - 1,
          thumbnailDataUrl,
          label: `${displayName} — Page ${p}`,
          annotations: [],
          annotationHistory: { undoStack: [], redoStack: [] },
        });

        const progressPct = 60 + Math.round((p / pageCount) * 35);
        fill.style.width = progressPct + '%';
      }

      fill.style.width = '100%';
      statusEl.textContent = `Done — ${pageCount} page${pageCount !== 1 ? 's' : ''}`;
      statusEl.style.color = 'var(--green)';

      const fileId = _helpers.uuid();
      pages.forEach(p => p.sourceFileId = fileId);

      results.push({
        id: fileId,
        name: file._displayName || file.name,
        size: file.size,
        status: 'ready',
        progress: 100,
        error: null,
        pdfBytes: arrayBuffer,
        pageCount,
        pages,
      });

    } catch (err) {
      fill.style.width = '100%';
      fill.classList.add('error');
      statusEl.textContent = `✕ ${err.message}`;
      statusEl.style.color = 'var(--red)';

      results.push({
        id: _helpers.uuid(),
        name: file._displayName || file.name,
        size: file.size,
        status: 'failed',
        progress: 100,
        error: err.message,
        pdfBytes: null,
        pageCount: 0,
        pages: [],
      });
    }

    completedCount++;
    updateOverall();
  }

  overallLabel.textContent = `Processed ${files.length} of ${files.length} files.`;
  return results;
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
