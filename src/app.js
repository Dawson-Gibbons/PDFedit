// app.js — Main application logic and state management
import { initUpload } from './upload.js';
import { initProgress } from './progress.js';
import { initOrganizer } from './organizer.js';
import { initMarkup } from './markup.js';
import { initExporter } from './exporter.js';

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Application state
const state = {
  phase: 'upload', // upload | progress | organize | exporting
  files: [],
  mode: 'page', // page | block
  arrangement: [],
  removedPages: [],
  activeMarkupTool: null,
  markupColor: '#FFEB3B',
  exportFilename: '',
};

// Generate UUID
function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

// Get state (read-only reference)
function getState() { return state; }

// Set phase and update UI visibility
function setPhase(phase) {
  state.phase = phase;
  document.getElementById('upload-phase').classList.toggle('hidden', phase !== 'upload');
  document.getElementById('progress-phase').classList.toggle('hidden', phase !== 'progress');
  document.getElementById('organize-phase').classList.toggle('hidden', phase !== 'organize');
  document.getElementById('export-footer').classList.toggle('hidden', phase !== 'organize');
}

// Add files to state after processing
function addProcessedFile(fileData) {
  state.files.push(fileData);
}

// Build initial arrangement from ready files
function buildArrangement() {
  if (state.mode === 'page') {
    state.arrangement = [];
    state.files.forEach(f => {
      if (f.status === 'ready') {
        f.pages.forEach(p => {
          if (!state.removedPages.includes(p.id)) {
            state.arrangement.push(p.id);
          }
        });
      }
    });
  } else {
    state.arrangement = state.files.filter(f => f.status === 'ready').map(f => f.id);
  }
}

// Get all pages in current arrangement order
function getArrangedPages() {
  if (state.mode === 'page') {
    const pageMap = new Map();
    state.files.forEach(f => f.pages.forEach(p => pageMap.set(p.id, p)));
    return state.arrangement.map(id => pageMap.get(id)).filter(Boolean);
  } else {
    const fileMap = new Map();
    state.files.forEach(f => fileMap.set(f.id, f));
    const pages = [];
    state.arrangement.forEach(fid => {
      const f = fileMap.get(fid);
      if (f) f.pages.forEach(p => pages.push(p));
    });
    return pages;
  }
}

// Get a page by ID
function getPageById(pageId) {
  for (const f of state.files) {
    for (const p of f.pages) {
      if (p.id === pageId) return p;
    }
  }
  return null;
}

// Get file by ID
function getFileById(fileId) {
  return state.files.find(f => f.id === fileId);
}

// Toast notifications
function showToast(message, undoCallback, duration = 5000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  const span = document.createElement('span');
  span.textContent = message;
  toast.appendChild(span);
  if (undoCallback) {
    const btn = document.createElement('button');
    btn.textContent = 'Undo';
    btn.onclick = () => {
      undoCallback();
      toast.remove();
    };
    toast.appendChild(btn);
  }
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// Handle beforeunload warning
window.addEventListener('beforeunload', (e) => {
  if (state.phase === 'organize' && state.files.some(f => f.status === 'ready')) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Initialize application
function init() {
  initUpload(state, { uuid, setPhase, addProcessedFile, buildArrangement, showToast });
  initProgress(state, { setPhase, buildArrangement });
  initOrganizer(state, { uuid, buildArrangement, getArrangedPages, getPageById, getFileById, showToast });
  initMarkup(state, { getArrangedPages, getPageById, getFileById });
  initExporter(state, { getArrangedPages, getFileById });
  setPhase('upload');
}

// Export for other modules
export { getState, setPhase, uuid, buildArrangement, getArrangedPages, getPageById, getFileById, showToast, addProcessedFile };

// ES modules execute after DOM is parsed, so just call init directly
init();
