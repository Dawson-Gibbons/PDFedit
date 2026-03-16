// exporter.js — PDF merging, annotation burn-in, and download via pdf-lib

let _state, _helpers;

export function initExporter(state, helpers) {
  _state = state;
  _helpers = helpers;

  const exportBtn = document.getElementById('export-btn');
  exportBtn.addEventListener('click', handleExport);
}

async function handleExport() {
  const exportBtn = document.getElementById('export-btn');
  const exportError = document.getElementById('export-error');
  exportError.classList.add('hidden');

  // Sanitize filename
  let filename = _state.exportFilename.replace(/[/\\:*?"<>|]/g, '').trim();
  if (!filename) {
    exportBtn.disabled = true;
    return;
  }

  exportBtn.disabled = true;
  exportBtn.textContent = 'Building PDF...';

  try {
    const { PDFDocument, rgb } = PDFLib;
    const mergedPdf = await PDFDocument.create();

    const pages = _helpers.getArrangedPages();

    // Group pages by source file for efficiency
    const fileCache = new Map();

    for (const page of pages) {
      let srcDoc = fileCache.get(page.sourceFileId);
      if (!srcDoc) {
        const file = _helpers.getFileById(page.sourceFileId);
        if (!file || !file.pdfBytes) continue;
        srcDoc = await PDFDocument.load(file.pdfBytes);
        fileCache.set(page.sourceFileId, srcDoc);
      }

      const [copiedPage] = await mergedPdf.copyPages(srcDoc, [page.pageIndex]);
      mergedPdf.addPage(copiedPage);

      // Burn in annotations
      if (page.annotations.length > 0) {
        const addedPage = mergedPdf.getPages()[mergedPdf.getPageCount() - 1];
        const { width, height } = addedPage.getSize();

        for (const ann of page.annotations) {
          const color = hexToRgb(ann.color);

          if (ann.type === 'highlight') {
            const x = ann.startX * width;
            // PDF coordinates are bottom-left origin, so invert Y
            const y = height - ann.endY * height;
            const w = (ann.endX - ann.startX) * width;
            const h = (ann.endY - ann.startY) * height;

            addedPage.drawRectangle({
              x,
              y,
              width: w,
              height: h,
              color: rgb(color.r, color.g, color.b),
              opacity: ann.opacity || 0.4,
            });
          } else if (ann.type === 'underline' || ann.type === 'strikethrough') {
            const x1 = ann.startX * width;
            const y1 = height - ann.startY * height;
            const x2 = ann.endX * width;
            const y2 = height - ann.endY * height;
            const strokeWidth = (ann.strokeWidth || 0.002) * width;

            addedPage.drawLine({
              start: { x: x1, y: y1 },
              end: { x: x2, y: y2 },
              thickness: strokeWidth,
              color: rgb(color.r, color.g, color.b),
              opacity: ann.opacity || 1,
            });
          }
        }
      }
    }

    const pdfBytes = await mergedPdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    exportBtn.textContent = '✓ Downloaded';
    setTimeout(() => {
      exportBtn.textContent = 'Export PDF';
      exportBtn.disabled = false;
    }, 2000);

  } catch (err) {
    console.error('Export failed:', err);
    exportError.textContent = 'Export failed. Please try again.';
    exportError.classList.remove('hidden');
    exportBtn.textContent = 'Export PDF';
    exportBtn.disabled = false;
  }
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  return { r, g, b };
}
