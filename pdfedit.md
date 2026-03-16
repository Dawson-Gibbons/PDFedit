# spec.md — PDF Page Organizer & Merger

## 1. Overview

**Product Name:** PDF Page Organizer

**Purpose:** A web application that allows users to upload multiple PDF files, reorder their pages using two distinct organizational modes (page-by-page or full-PDF blocks), annotate pages with markup tools (highlighter, underline, strikethrough), and export the result as a single merged PDF with a user-defined filename.

**Target baseline:** 10 PDFs, ~100 total pages, handled comfortably in-browser on a modern machine.

**Design Philosophy:** Minimal, clean, and unambiguous. Every interaction should be obvious at a glance. No unnecessary decoration, no hidden functionality. The user should never wonder "what do I do next?"

---

## 2. User Flow Summary

```
Upload PDFs → Wait for processing → Choose organization mode → Arrange pages/blocks → Markup pages (optional) → Name file → Download
```

**Step-by-step:**

1. User lands on a single-page app with a prominent upload area.
2. User selects one or more PDF files (recommended up to 10 files / ~100 pages).
3. A progress bar shows upload and parsing status for all files.
4. Once processing completes, the user chooses between two modes:
   - **Page-by-Page Mode** — Individual pages from all PDFs are shown as draggable thumbnails that can be freely reordered into any sequence.
   - **PDF Block Mode** — Each uploaded PDF is represented as a single draggable block. Users reorder entire PDFs, not individual pages.
5. User arranges pages or blocks as desired.
6. User optionally clicks any page thumbnail to open it in the **Markup View**, where they can highlight, underline, or strikethrough content using a toolbar on the side.
7. User enters a custom filename for the output.
8. User clicks "Export" and receives a browser download of the merged PDF with all annotations baked in.

---

## 3. Detailed Feature Specifications

### 3.1 PDF Upload

**Interface:**
- A large, centered drop zone with a dashed border occupying the majority of the screen on first load.
- Text inside: "Drag & drop PDF files here, or click to browse"
- A subtle file-type icon (PDF icon) inside the drop zone for visual clarity.
- Supports both drag-and-drop and a native file picker dialog.

**Behavior:**
- Accepts only `.pdf` files. If a non-PDF file is selected, display an inline error: "Only PDF files are accepted." Do not use alert dialogs.
- No hard limit on the number of files, but optimized for up to 10 PDFs / ~100 total pages. Users can upload more, but display a soft warning above 10 files or 100 pages: "Performance may vary with this many files. Consider working in batches."
- Multiple files can be selected at once in the file picker or dragged in as a batch.
- After the initial upload, a smaller "+ Add more PDFs" button remains visible so users can add additional files without restarting.

**Validation:**
- Reject files that are not valid PDFs (check MIME type and/or magic bytes).
- Reject password-protected/encrypted PDFs with a clear per-file error message: "This PDF is password-protected and cannot be processed."
- Reject zero-byte or corrupted files: "This file appears to be corrupted."

### 3.2 Upload Progress

**Interface:**
- Once files are selected, the drop zone collapses and is replaced by a file list with individual progress indicators.
- Each file shows: filename, file size, and a horizontal progress bar.
- Below the individual files, a single **overall progress bar** shows cumulative progress across all files.
- A label above the overall bar reads: "Processing X of Y files..."

**Behavior:**
- Progress reflects two phases per file:
  1. **Upload/Read phase** (~0–50% of that file's bar): Reading the file into the browser.
  2. **Parse phase** (~50–100% of that file's bar): Extracting page count and generating thumbnail previews for each page.
- If a single file fails (corrupt, encrypted, etc.), mark it with a red "✕ Failed" indicator and a reason. Do not block the rest of the uploads. Allow the user to continue with the files that succeeded.
- When all files are processed, automatically transition to the organization view. No extra "Continue" button unless one or more files failed, in which case show a "Continue with X successful files" button.

**Edge Cases:**
- If the user uploads only one PDF with one page, skip the organization step entirely and go straight to the naming/export step.
- If all files fail, show an error summary and return to the upload view.

### 3.3 Organization Modes

After upload completes, present a **mode selector** — two clearly labeled, mutually exclusive buttons at the top of the workspace:

| Mode | Label | Description shown to user |
|------|-------|---------------------------|
| Page-by-Page | "Arrange Individual Pages" | "Drag and drop individual pages from all your PDFs into any order." |
| PDF Block | "Arrange Whole PDFs" | "Drag and drop entire PDFs to set their order. Pages within each PDF stay in their original sequence." |

Default selection: **Page-by-Page Mode** (pre-selected but not locked — user can switch at any time).

**Switching between modes:**
- Switching from Page-by-Page to PDF Block discards any custom page ordering and reverts to the original page order within each PDF. Warn the user with a confirmation: "Switching to block mode will reset your page arrangement. Continue?"
- Switching from PDF Block to Page-by-Page preserves the block order and lays out pages sequentially in that block order (i.e., if the user moved PDF-B before PDF-A, page-by-page mode will show all of PDF-B's pages followed by all of PDF-A's pages).

#### 3.3.1 Page-by-Page Mode

**Interface:**
- A scrollable grid of page thumbnails. Each thumbnail shows:
  - A small rendered preview of the page content (grayscale is fine to keep rendering fast; color if performance allows).
  - A label below: `[Source PDF name] — Page [N]` (e.g., "invoice.pdf — Page 3").
  - A page sequence number in the top-left corner of the thumbnail, updating in real time as pages are reordered (1, 2, 3, ...).
- Thumbnails are draggable. The user can click-and-drag any thumbnail to any position in the grid.
- Drag feedback: The dragged thumbnail follows the cursor with slight opacity reduction. A visible insertion marker (vertical line or highlighted gap) shows where the page will land.

**Additional controls per thumbnail:**
- A small "✕" button in the top-right corner to remove a page from the output. Removed pages go to a "Removed Pages" tray at the bottom of the screen, from which they can be re-added by clicking a "+" button. This is non-destructive.

**Batch selection:**
- Shift+click to select a contiguous range of thumbnails.
- Ctrl/Cmd+click to select non-contiguous thumbnails.
- Drag the entire selection as a group.

#### 3.3.2 PDF Block Mode

**Interface:**
- A vertical list of blocks. Each block represents one uploaded PDF and shows:
  - The PDF filename (bold).
  - Page count (e.g., "6 pages").
  - A small collapsed preview: the first page's thumbnail, small.
  - A drag handle (☰ icon or similar) on the left side.
- Blocks are draggable to reorder.
- Drag feedback: The dragged block lifts visually (slight shadow), and a horizontal line shows the insertion point.

**Additional controls per block:**
- An expand/collapse toggle (chevron) that, when expanded, shows all page thumbnails within that block in a horizontal row. This is read-only — pages within a block cannot be individually reordered in this mode. It exists solely so the user can preview what's inside each block.
- A "✕" button to remove an entire PDF from the output (with undo available via a toast notification: "Removed [filename]. Undo?").

### 3.4 Page Markup (Annotation)

Users can annotate any page before export. Markup is optional — pages without annotations export normally.

**Entering Markup View:**
- In either organization mode, clicking (single click, not drag) on a page thumbnail opens that page in a **Markup View** — a focused, larger rendering of the page that fills the center of the screen as a modal/overlay.
- The page renders at a comfortable working size (fit-to-width of the modal, up to ~800px wide).
- A "✕ Close" button in the top-right corner of the modal returns to the organization view.
- A small dot indicator on the thumbnail in the grid view marks pages that have annotations (e.g., a colored dot in the corner), so the user can tell at a glance which pages have been marked up.

**Toolbar — positioned on the left side of the markup modal:**

The toolbar is a narrow vertical strip on the left edge of the page view. It contains the following tools, laid out top-to-bottom:

| Tool | Icon | Behavior |
|------|------|----------|
| **Highlighter** | Marker pen icon | Click and drag across an area of the page. Draws a semi-transparent colored rectangle (default: yellow, 40% opacity) over the dragged region. Freeform rectangular selection — the user drags a box, and that box becomes the highlight. |
| **Underline** | U with underline icon | Click a start point, drag to an end point. Draws a straight horizontal line (2px, default color: blue) beneath the dragged path. Snaps to horizontal if the angle is within 15° of horizontal, otherwise draws at the exact angle. |
| **Strikethrough** | S with line-through icon | Same interaction as underline, but draws the line through the vertical center of the dragged region rather than below it. Default color: red, 2px. |
| **Eraser** | Eraser icon | Click on any existing annotation to remove it. Only removes annotations, never affects the underlying PDF content. The cursor changes to an eraser icon when hovering over a removable annotation. |
| **Color picker** | Colored circle | A small color selector that sets the color for the next annotation drawn. Offers 6 preset colors: yellow (default for highlighter), blue (default for underline), red (default for strikethrough), green, orange, black. No custom hex input — keep it simple. |
| **Undo** | ↩ icon | Undoes the last annotation action on this page. Supports multiple undos back to the original (no annotations) state. |
| **Redo** | ↪ icon | Redoes the last undone action. Cleared when a new annotation is made. |

**Toolbar UX rules:**
- Only one tool is active at a time. The active tool is highlighted (blue background).
- Default active tool when entering markup view: **none** (pointer/select mode). The user must explicitly choose a tool. This prevents accidental annotations.
- While a tool is active, the cursor changes to a crosshair over the page canvas.
- Clicking the already-active tool deselects it, returning to pointer mode.

**Annotation rendering:**
- Annotations are drawn on a transparent `<canvas>` layer positioned exactly over the PDF page render. The PDF canvas itself is never modified.
- Each annotation is stored as a data object (see Data Model update below), not as raw pixel data. This allows undo/redo and re-rendering at any zoom level.
- Annotations are visible in the markup view and also reflected on the thumbnails in the grid view (re-render the thumbnail with annotations composited on top when the user closes the markup modal).

**Annotation behavior during export:**
- On export, annotations are burned into the PDF as vector overlays using `pdf-lib`. Highlights become semi-transparent filled rectangles. Underlines and strikethroughs become line drawings. They are positioned proportionally based on the page dimensions so they land in the correct location regardless of the page's native size.
- Annotations are **not** added as PDF annotation objects (sticky notes, markup annotations in the PDF spec). They are rendered as drawn content on the page so they appear identically in every PDF viewer.

**Navigation within markup view:**
- Left/right arrow buttons (or keyboard arrow keys) navigate to the previous/next page in the current arrangement order without closing the modal. This lets the user annotate multiple pages in sequence.
- A small page indicator shows "Page X of Y" at the bottom of the modal.

### 3.5 Naming & Export

**Interface:**
- Below the organization workspace, a persistent bottom bar (sticky footer) contains:
  - A text input field with placeholder text: "Enter filename..." and a `.pdf` suffix shown outside/after the input (so the user types `my-report` and sees `my-report.pdf`).
  - An "Export PDF" button to the right of the input. Disabled until the user has entered at least one character in the filename field.

**Behavior:**
- The filename input strips or replaces invalid filesystem characters (/ \ : * ? " < > |) automatically and silently. If the resulting name is empty after stripping, keep the export button disabled.
- Default suggested filename: If only one PDF was uploaded, pre-fill with that PDF's original name. If multiple PDFs were uploaded, leave blank.
- On clicking "Export":
  1. Show a brief processing spinner on the button itself (button text changes to "Building PDF...").
  2. Merge pages in the arranged order into a single PDF.
  3. Trigger a browser download of the resulting file.
  4. On success, replace the button text briefly with "✓ Downloaded" for 2 seconds, then revert.
  5. If merging fails for any reason, show an inline error: "Export failed. Please try again." Do not use alert dialogs.

---

## 4. UI / Layout Specification

### 4.1 Global Layout

- **Single-page application.** No routing, no navigation bar, no sidebar.
- **Max content width:** 1200px, centered.
- **Background:** White or very light gray (#F9FAFB).
- **Font:** System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`). Single font family throughout.
- **Primary accent color:** A single blue (#2563EB) used for buttons, active states, and the progress bar fill. No gradients.
- **Text colors:** #111827 for primary text, #6B7280 for secondary/muted text.

### 4.2 Component Hierarchy

```
┌─────────────────────────────────────────────┐
│  App Header: "PDF Page Organizer" (h1)      │
│  Subtext: brief one-liner description       │
├─────────────────────────────────────────────┤
│                                             │
│  [Phase 1: Upload Zone]                     │
│       or                                    │
│  [Phase 2: Progress List]                   │
│       or                                    │
│  [Phase 3: Mode Selector + Workspace]       │
│                                             │
├─────────────────────────────────────────────┤
│  Sticky Footer: [Filename input] [Export]   │
│  (visible only in Phase 3)                  │
└─────────────────────────────────────────────┘

Markup Modal (overlay, triggered by clicking a thumbnail):
┌─────────────────────────────────────────────┐
│  [✕ Close]                        Page X/Y  │
│  ┌──────┬──────────────────────────────────┐ │
│  │ Tool │                                  │ │
│  │ bar  │   Full-size page render          │ │
│  │      │   + transparent annotation layer │ │
│  │ High │                                  │ │
│  │ Under│                                  │ │
│  │ Strik│                                  │ │
│  │ Erase│                                  │ │
│  │ Color│                                  │ │
│  │ Undo │                                  │ │
│  │ Redo │                                  │ │
│  └──────┴──────────────────────────────────┘ │
│           [◀ Prev]  [Next ▶]                │
└─────────────────────────────────────────────┘
```

### 4.3 Responsiveness

- On viewports narrower than 768px, the thumbnail grid should collapse to 2 columns (from 4–6 on desktop).
- The sticky export footer should stack vertically on mobile: filename input full-width on top, export button full-width below.
- Drag-and-drop should function on touch devices (use a library that supports touch events, e.g., `dnd-kit`, `react-beautiful-dnd`, or `SortableJS`).

---

## 5. Technical Architecture

### 5.1 Recommended Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | React (with hooks) or plain vanilla JS | Component model suits the multi-phase UI. Vanilla JS is also acceptable for simplicity. |
| PDF parsing | `pdf.js` (Mozilla) | Client-side PDF rendering and page extraction. Mature, well-documented. |
| PDF merging/export | `pdf-lib` | Client-side PDF creation and page merging. No server required. |
| Drag and drop | `dnd-kit` (React) or `SortableJS` (vanilla) | Accessible, performant, touch-friendly. |
| Thumbnails | `pdf.js` canvas rendering | Render each page to a small canvas element for preview. |
| Styling | Tailwind CSS or plain CSS | Keep it simple. No component library needed. |

### 5.2 Processing Pipeline

All processing happens **client-side in the browser.** There is no backend server. This means:

- Files never leave the user's machine (good for privacy and simplicity).
- File size is limited by browser memory. Display a warning if total uploaded file size exceeds 200MB: "Large files may cause slow performance."
- Use Web Workers for PDF parsing and thumbnail generation to avoid blocking the main thread.

**Pipeline steps:**

1. **File read:** Use `FileReader` API to read each file as an `ArrayBuffer`.
2. **PDF parse:** Pass each `ArrayBuffer` to `pdf.js` (`pdfjsLib.getDocument()`). Extract page count.
3. **Thumbnail generation:** For each page, render to an off-screen canvas at a reduced resolution (e.g., 150px wide) using `page.render()`. Convert to an image data URL or blob for display.
4. **Page extraction (on export):** Use `pdf-lib` to load each source PDF (`PDFDocument.load()`), then use `copyPages()` to pull individual pages in the user-defined order into a new `PDFDocument`.
5. **Annotation burn-in (on export):** For each page that has annotations, use `pdf-lib`'s drawing API to render overlays onto the page. Highlights become filled rectangles with transparency (`page.drawRectangle()` with a low-opacity color). Underlines and strikethroughs become lines (`page.drawLine()`). Coordinates are mapped from the annotation canvas coordinate space to the PDF page's native coordinate space (note: PDF coordinates are bottom-left origin, canvas is top-left origin — invert Y axis).
6. **Save:** Serialize the merged `PDFDocument` with `pdfDoc.save()`, create a Blob, and trigger download via a temporary `<a>` element with `URL.createObjectURL()`.

### 5.3 Data Model

```
State {
  phase: "upload" | "progress" | "organize" | "exporting"

  files: [
    {
      id: string (UUID)
      name: string
      size: number (bytes)
      status: "reading" | "parsing" | "ready" | "failed"
      progress: number (0–100)
      error: string | null
      pdfBytes: ArrayBuffer
      pageCount: number
      pages: [
        {
          id: string (UUID)
          sourceFileId: string
          pageIndex: number (0-based, within the source PDF)
          thumbnailDataUrl: string
          label: string (e.g., "invoice.pdf — Page 3")
          annotations: [
            {
              id: string (UUID)
              type: "highlight" | "underline" | "strikethrough"
              color: string (hex, e.g., "#FFEB3B")
              opacity: number (0–1, e.g., 0.4 for highlights)
              // All coordinates are normalized to 0–1 range relative to page dimensions.
              // This ensures annotations map correctly regardless of render size vs native PDF size.
              startX: number (0–1)
              startY: number (0–1)
              endX: number (0–1)
              endY: number (0–1)
              // For highlights: startX/Y is top-left, endX/Y is bottom-right of the rectangle.
              // For underline/strikethrough: startX/Y is line start, endX/Y is line end.
              strokeWidth: number (normalized, e.g., 0.002 = 2px at 1000px render width)
            }
          ]
          annotationHistory: {
            undoStack: Annotation[][]   // snapshots of annotations array
            redoStack: Annotation[][]
          }
        }
      ]
    }
  ]

  mode: "page" | "block"

  // The user's arranged order. Contains page IDs (page mode) or file IDs (block mode).
  arrangement: string[]

  // Pages the user has removed (page mode only)
  removedPages: string[]

  // Currently active markup tool (null = pointer/select mode)
  activeMarkupTool: "highlight" | "underline" | "strikethrough" | "eraser" | null
  markupColor: string (hex)

  exportFilename: string
}
```

### 5.4 Performance Considerations

- **Lazy thumbnail rendering:** Only render thumbnails for pages currently visible in the viewport (virtualized list). For a PDF with 200 pages, rendering all thumbnails upfront would be too slow.
- **Thumbnail caching:** Once rendered, cache thumbnail data URLs in state. Do not re-render on mode switch or reorder.
- **Web Workers:** Offload `pdf.js` parsing and canvas rendering to a Web Worker to keep the UI responsive.
- **Memory management:** After export, release `ArrayBuffer` references if the user doesn't need to re-export. Offer a "Start over" button that clears all state.

---

## 6. Error Handling

| Scenario | Behavior |
|----------|----------|
| Non-PDF file selected | Reject with inline message per file. Don't block other files. |
| Encrypted/password-protected PDF | Reject with "Password-protected" message per file. |
| Corrupted PDF (pdf.js fails to parse) | Mark as failed with "Could not read this file." |
| All files fail | Show summary, return to upload view. |
| Browser runs out of memory | Catch the error, show: "Your browser ran out of memory. Try fewer or smaller files." |
| Export fails | Show inline error on the export button area. Allow retry. |
| User tries to leave page with unsaved arrangement | `beforeunload` warning: "You have an unsaved arrangement. Are you sure you want to leave?" |

---

## 7. Accessibility

- All interactive elements must be keyboard-navigable (Tab, Enter, Space, Arrow keys).
- Drag-and-drop must have a keyboard alternative: select a thumbnail with Enter, then use arrow keys to move it, then confirm with Enter.
- All images (thumbnails) must have `alt` text: "Page [N] of [filename]".
- Thumbnails with annotations must include updated alt text: "Page [N] of [filename] (annotated)".
- Progress bars must use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.
- Mode selector buttons must use `role="radiogroup"` / `role="radio"` with `aria-checked`.
- Markup toolbar buttons must use `role="toolbar"` with `aria-label` on each tool button and `aria-pressed` to indicate the active tool.
- Markup tool switching must be keyboard-accessible: Tab into toolbar, arrow keys to move between tools, Enter/Space to activate.
- Color contrast must meet WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text).
- Focus indicators must be visible on all interactive elements.
- The markup modal must trap focus while open (standard modal focus management).

---

## 8. Edge Cases & Constraints

- **Single-page, single-file upload:** Skip organization, go straight to naming/export.
- **Very large PDFs (1000+ pages):** Use virtualized scrolling for the thumbnail grid. Show a warning about performance.
- **Mixed page sizes:** The export preserves each page's original dimensions. No resizing or normalization.
- **Duplicate filenames in upload:** Append a suffix: `report.pdf`, `report (2).pdf`.
- **Empty filename on export:** Export button remains disabled. No error message needed — the disabled state is self-explanatory.
- **Browser compatibility:** Target modern evergreen browsers (Chrome, Firefox, Safari, Edge — latest 2 versions). No IE11 support.

---

## 9. Out of Scope (Explicitly Not Included)

The following features are **not** part of this spec and should not be built:

- User accounts, login, or any server-side storage.
- Cloud storage integration (Google Drive, Dropbox, etc.).
- Advanced PDF editing (text changes, redaction, form filling).
- Page rotation or cropping.
- OCR or text extraction.
- Freehand drawing or text-box annotations (v1 is limited to highlight, underline, strikethrough).
- Batch export (multiple output PDFs).
- Watermarking or headers/footers.
- Print functionality.
- Dark mode (can be added later but is not in v1).

---

## 10. File & Folder Structure (Suggested)

```
pdf-page-organizer/
├── index.html
├── style.css
├── src/
│   ├── app.js              # Main application logic, state management
│   ├── upload.js            # File upload handling, validation
│   ├── progress.js          # Progress tracking and display
│   ├── organizer.js         # Mode selection, drag-and-drop, arrangement
│   ├── markup.js            # Markup modal, annotation canvas, tool handling
│   ├── annotations.js       # Annotation data model, undo/redo, coordinate mapping
│   ├── exporter.js          # PDF merging, annotation burn-in, and download via pdf-lib
│   ├── thumbnails.js        # pdf.js thumbnail rendering (Web Worker bridge)
│   └── thumbnails.worker.js # Web Worker for off-thread rendering
├── lib/
│   ├── pdf.js               # Mozilla pdf.js (or loaded via CDN)
│   └── pdf-lib.js           # pdf-lib (or loaded via CDN)
└── README.md
```

If using React, replace the `src/` contents with a standard component-based structure (`components/`, `hooks/`, etc.).

---

## 11. Success Criteria

The application is considered complete when:

1. A user can upload 10 PDFs of varying page counts (totaling ~100 pages), see clear progress, arrange them in both modes, name the output, export, and open the resulting PDF with all pages in the correct user-defined order.
2. The entire flow — from landing on the page to downloading the result — takes under 90 seconds for a typical use case (5 PDFs, ~50 pages total, on a modern machine). For the baseline target (10 PDFs, ~100 pages), the flow should complete in under 3 minutes.
3. No page content is lost, corrupted, or resized during the merge.
4. A user can open the markup view, apply at least one of each annotation type (highlight, underline, strikethrough) to a page, undo and redo those annotations, close the modal, and see annotation indicators on the thumbnails. Exported PDFs display all annotations correctly in Adobe Acrobat, Chrome's built-in viewer, and macOS Preview.
5. The UI is usable without any documentation or tooltip explanations.
