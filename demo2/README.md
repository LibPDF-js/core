# LibPDF Native Viewer Demo

This demo showcases PDF viewing using LibPDF's native rendering pipeline, without any dependency on PDF.js.

## Running the Demo

```bash
# From the core directory
bun run demo2

# Or with the serve command (for production build)
bun run demo2:serve
```

## Features

This demo implements a complete PDF viewer using LibPDF's native components:

- **Native CanvasRenderer** - Direct PDF content stream rendering to HTML Canvas
- **VirtualScroller** - Efficient scrolling with constant memory usage
- **ViewportManager** - Page lifecycle and render queue management
- **Coordinate Transformation** - Accurate PDF-to-screen coordinate mapping
- **DOM Text Layer** - Native browser text selection over rendered pages
- **Text Search** - Full-text search with highlighting using SearchEngine
- **Zoom Controls** - Scale presets, fit-to-width, fit-to-page
- **Page Navigation** - Go to specific pages, keyboard shortcuts
- **Rotation** - 90-degree clockwise/counter-clockwise rotation
- **Drag & Drop** - Drop PDF files directly onto the viewer

## Architecture

Unlike the main demo which uses PDF.js for rendering, this demo uses:

```
demo2/demo2.ts
    │
    ├── PDF (LibPDF parser)
    ├── CanvasRenderer (LibPDF native renderer)
    ├── VirtualScroller (scroll and layout management)
    ├── ViewportManager (page render coordination)
    ├── TextLayerBuilder (DOM text overlay)
    ├── SearchEngine (text search)
    └── CoordinateTransformer (coordinate mapping)
```

## Keyboard Shortcuts

| Key              | Action                 |
| ---------------- | ---------------------- |
| `←` / `PageUp`   | Previous page          |
| `→` / `PageDown` | Next page              |
| `Home`           | First page             |
| `End`            | Last page              |
| `Ctrl/Cmd + +`   | Zoom in                |
| `Ctrl/Cmd + -`   | Zoom out               |
| `Ctrl/Cmd + F`   | Focus search           |
| `Enter`          | Next search result     |
| `Shift + Enter`  | Previous search result |

## Feature Panel

Click the "Features" button on the right side to open the feature showcase panel, which includes:

- Event log showing viewer events in real-time
- Test buttons for zoom and navigation
- Feature status checklist

## Development

The demo is built with Bun and uses hot reloading:

```bash
bun run demo2  # Starts with hot reload
```

Files:

- `demo2/index.html` - Main HTML structure
- `demo2/styles.css` - Styling
- `demo2/demo2.ts` - Main application logic

## Comparison with Main Demo

| Feature      | Main Demo (`demo/`) | Native Demo (`demo2/`)  |
| ------------ | ------------------- | ----------------------- |
| Rendering    | PDF.js              | LibPDF CanvasRenderer   |
| Text Layer   | PDF.js TextLayer    | LibPDF TextLayerBuilder |
| Search       | PDF.js Search       | LibPDF SearchEngine     |
| Parser       | PDF.js              | LibPDF PDF class        |
| Dependencies | pdf.js required     | Pure LibPDF             |
