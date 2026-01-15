/**
 * Text Extraction API Design for @libpdf/core
 *
 * Goal: Extract text with bounding boxes, support searching for patterns like `{{ field }}`
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CORE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** A rectangle in PDF coordinates (origin at bottom-left) */
interface BoundingBox {
  x: number; // Left edge
  y: number; // Bottom edge
  width: number;
  height: number;
}

/** A single character with its position */
interface ExtractedChar {
  char: string; // The Unicode character
  bbox: BoundingBox; // Position on page
  fontSize: number; // Font size in points
  fontName: string; // Font name (e.g., "Helvetica", "ArialMT")
  baseline: number; // Y coordinate of text baseline
}

/** A span of text (characters with same font/size on same line) */
interface TextSpan {
  text: string; // The text content
  bbox: BoundingBox; // Bounding box around entire span
  chars: ExtractedChar[]; // Individual characters (for precise positioning)
  fontSize: number;
  fontName: string;
}

/** A line of text (multiple spans on same baseline) */
interface TextLine {
  text: string; // Combined text from all spans
  bbox: BoundingBox; // Bounding box around entire line
  spans: TextSpan[]; // Individual spans
  baseline: number; // Y coordinate of baseline
}

/** Full page text extraction result */
interface PageText {
  pageIndex: number;
  width: number;
  height: number;
  lines: TextLine[]; // All text lines
  text: string; // Plain text (all lines joined)
}

/** A search match result */
interface TextMatch {
  text: string; // The matched text
  bbox: BoundingBox; // Bounding box around the match
  pageIndex: number;
  /** Individual character boxes (useful for multi-line matches or highlighting) */
  charBoxes: BoundingBox[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HIGH-LEVEL API - Option 1: Simple & Direct
// ═══════════════════════════════════════════════════════════════════════════════

// Your use case: Find `{{ asd }}` and get bbox
async function example1() {
  const pdf = await PDF.load(bytes);
  const page = pdf.getPage(0);

  // Extract all text with positions
  const pageText = await page.extractText();
  console.log(pageText.text); // Plain text

  // Search for a pattern
  const matches = await page.findText("{{ asd }}");
  // Returns: TextMatch[] with bbox for each occurrence

  for (const match of matches) {
    console.log(`Found "${match.text}" at:`, match.bbox);
    // { x: 100, y: 500, width: 80, height: 12 }
  }

  // Regex search
  const templateFields = await page.findText(/\{\{\s*\w+\s*\}\}/g);
  for (const field of templateFields) {
    console.log(`Template field: ${field.text} at`, field.bbox);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HIGH-LEVEL API - Option 2: Document-wide search
// ═══════════════════════════════════════════════════════════════════════════════

async function example2() {
  const pdf = await PDF.load(bytes);

  // Search across all pages
  const matches = await pdf.findText("{{ asd }}");
  // Returns matches with pageIndex

  // Or extract all text from document
  const allText = await pdf.extractText();
  // Returns PageText[] for each page

  // With options
  const matches2 = await pdf.findText("{{ asd }}", {
    pages: [0, 1, 2], // Only search specific pages
    caseSensitive: false, // Case-insensitive search
    wholeWord: true, // Match whole words only
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE REPLACEMENT USE CASE
// ═══════════════════════════════════════════════════════════════════════════════

async function templateReplacement() {
  const pdf = await PDF.load(templateBytes);

  // Find all template placeholders
  const placeholders = await pdf.findText(/\{\{\s*(\w+)\s*\}\}/g);

  for (const match of placeholders) {
    const fieldName = match.text.replace(/[{}]/g, "").trim();
    const value = data[fieldName]; // e.g., "John Doe"

    // Option A: Draw text at the same position (covers original)
    const page = pdf.getPage(match.pageIndex);
    page.drawRectangle({
      ...match.bbox,
      color: rgb(1, 1, 1), // White background to cover original
    });
    page.drawText(value, {
      x: match.bbox.x,
      y: match.bbox.y,
      size: 12, // Could extract from match metadata
    });

    // Option B: Use redaction (truly removes original text)
    // page.addRedaction(match.bbox);
    // page.applyRedactions();
    // page.drawText(value, { x: match.bbox.x, y: match.bbox.y });
  }

  return pdf.save();
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETAILED EXTRACTION (when you need character-level precision)
// ═══════════════════════════════════════════════════════════════════════════════

async function detailedExtraction() {
  const pdf = await PDF.load(bytes);
  const page = pdf.getPage(0);

  const pageText = await page.extractText({
    includeChars: true, // Include individual character positions
    preserveWhitespace: true, // Keep exact spacing
  });

  // Access individual lines
  for (const line of pageText.lines) {
    console.log(`Line at y=${line.baseline}: "${line.text}"`);

    // Access spans within line (grouped by font/size)
    for (const span of line.spans) {
      console.log(`  Span: "${span.text}" (${span.fontName} ${span.fontSize}pt)`);

      // Access individual characters
      for (const char of span.chars) {
        console.log(`    '${char.char}' at (${char.bbox.x}, ${char.bbox.y})`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPLEMENTATION SKETCH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Internal: Track text state while parsing content stream
 */
class TextState {
  // Text matrix (set by Tm operator)
  tm: Matrix = Matrix.identity();
  // Text line matrix (updated by Td, TD, T*, etc.)
  tlm: Matrix = Matrix.identity();

  font: PdfFont | null = null;
  fontSize: number = 0;
  characterSpacing: number = 0; // Tc
  wordSpacing: number = 0; // Tw
  horizontalScale: number = 100; // Tz (percentage)
  leading: number = 0; // TL
  renderMode: number = 0; // Tr
  rise: number = 0; // Ts

  /** Current position in text space */
  get position(): { x: number; y: number } {
    return { x: this.tm.e, y: this.tm.f };
  }

  /** Move to next line (T* operator) */
  nextLine() {
    this.tlm = this.tlm.translate(0, -this.leading);
    this.tm = this.tlm.clone();
  }

  /** Move by offset (Td operator) */
  moveBy(tx: number, ty: number) {
    this.tlm = this.tlm.translate(tx, ty);
    this.tm = this.tlm.clone();
  }

  /** Advance after showing a character */
  advanceChar(width: number, isSpace: boolean) {
    const tx =
      (width * this.fontSize + this.characterSpacing + (isSpace ? this.wordSpacing : 0)) *
      (this.horizontalScale / 100);
    this.tm = this.tm.translate(tx, 0);
  }
}

/**
 * Internal: Simple 2D transformation matrix
 */
class Matrix {
  constructor(
    public a: number,
    public b: number,
    public c: number,
    public d: number,
    public e: number,
    public f: number,
  ) {}

  static identity() {
    return new Matrix(1, 0, 0, 1, 0, 0);
  }

  translate(tx: number, ty: number): Matrix {
    return new Matrix(
      this.a,
      this.b,
      this.c,
      this.d,
      this.a * tx + this.c * ty + this.e,
      this.b * tx + this.d * ty + this.f,
    );
  }

  transformPoint(x: number, y: number): { x: number; y: number } {
    return {
      x: this.a * x + this.c * y + this.e,
      y: this.b * x + this.d * y + this.f,
    };
  }

  clone(): Matrix {
    return new Matrix(this.a, this.b, this.c, this.d, this.e, this.f);
  }
}

/**
 * Internal: Extract text from a page's content stream
 */
async function extractTextFromPage(page: PDFPage): Promise<PageText> {
  const contentStream = await page.getContentStream();
  const operations = parseContentStream(contentStream);

  const state = new TextState();
  const graphicsStateStack: TextState[] = [];
  const chars: ExtractedChar[] = [];

  for (const op of operations) {
    switch (op.operator) {
      // Graphics state
      case "q":
        graphicsStateStack.push(state.clone());
        break;
      case "Q":
        Object.assign(state, graphicsStateStack.pop());
        break;

      // Text state operators
      case "BT":
        state.tm = Matrix.identity();
        state.tlm = Matrix.identity();
        break;
      case "ET":
        break;
      case "Tf":
        state.font = resolveFont(op.args[0]);
        state.fontSize = op.args[1];
        break;
      case "Tc":
        state.characterSpacing = op.args[0];
        break;
      case "Tw":
        state.wordSpacing = op.args[0];
        break;
      case "Tz":
        state.horizontalScale = op.args[0];
        break;
      case "TL":
        state.leading = op.args[0];
        break;
      case "Tr":
        state.renderMode = op.args[0];
        break;
      case "Ts":
        state.rise = op.args[0];
        break;

      // Text positioning
      case "Td":
        state.moveBy(op.args[0], op.args[1]);
        break;
      case "TD":
        state.leading = -op.args[1];
        state.moveBy(op.args[0], op.args[1]);
        break;
      case "Tm":
        state.tm = state.tlm = new Matrix(...op.args);
        break;
      case "T*":
        state.nextLine();
        break;

      // Text showing - THE MAIN EVENT
      case "Tj": {
        const text = op.args[0] as Uint8Array;
        for (const code of decodeString(text, state.font)) {
          const char = state.font.toUnicode(code);
          const width = state.font.getWidth(code) / 1000; // Normalize to text space
          const pos = state.position;

          chars.push({
            char,
            bbox: calculateCharBbox(pos, width, state),
            fontSize: state.fontSize,
            fontName: state.font.name,
            baseline: pos.y,
          });

          state.advanceChar(width, char === " ");
        }
        break;
      }

      case "TJ": {
        // Array of strings and position adjustments
        const array = op.args[0] as (Uint8Array | number)[];
        for (const item of array) {
          if (typeof item === "number") {
            // Negative = move right, positive = move left (in thousandths of em)
            const tx = (-item / 1000) * state.fontSize * (state.horizontalScale / 100);
            state.tm = state.tm.translate(tx, 0);
          } else {
            // Same as Tj
            for (const code of decodeString(item, state.font)) {
              const char = state.font.toUnicode(code);
              const width = state.font.getWidth(code) / 1000;
              const pos = state.position;

              chars.push({
                char,
                bbox: calculateCharBbox(pos, width, state),
                fontSize: state.fontSize,
                fontName: state.font.name,
                baseline: pos.y,
              });

              state.advanceChar(width, char === " ");
            }
          }
        }
        break;
      }

      case "'":
        state.nextLine();
        /* then Tj */ break;
      case '"':
        state.wordSpacing = op.args[0];
        state.characterSpacing = op.args[1];
        state.nextLine();
        /* then Tj */ break;
    }
  }

  // Group characters into lines and spans
  const lines = groupCharsIntoLines(chars);

  return {
    pageIndex: page.index,
    width: page.getWidth(),
    height: page.getHeight(),
    lines,
    text: lines.map(l => l.text).join("\n"),
  };
}

/**
 * Internal: Search for text in extracted content
 */
function findTextInPage(pageText: PageText, query: string | RegExp): TextMatch[] {
  const matches: TextMatch[] = [];
  const fullText = pageText.text;

  // Flatten all chars with their positions
  const allChars: ExtractedChar[] = pageText.lines.flatMap(l => l.spans.flatMap(s => s.chars));

  if (typeof query === "string") {
    let index = 0;
    while ((index = fullText.indexOf(query, index)) !== -1) {
      const endIndex = index + query.length;
      const matchChars = allChars.slice(index, endIndex);
      matches.push({
        text: query,
        bbox: mergeBboxes(matchChars.map(c => c.bbox)),
        pageIndex: pageText.pageIndex,
        charBoxes: matchChars.map(c => c.bbox),
      });
      index++;
    }
  } else {
    // Regex search
    let match;
    while ((match = query.exec(fullText)) !== null) {
      const endIndex = match.index + match[0].length;
      const matchChars = allChars.slice(match.index, endIndex);
      matches.push({
        text: match[0],
        bbox: mergeBboxes(matchChars.map(c => c.bbox)),
        pageIndex: pageText.pageIndex,
        charBoxes: matchChars.map(c => c.bbox),
      });
    }
  }

  return matches;
}

// Helper stubs
function calculateCharBbox(
  pos: { x: number; y: number },
  width: number,
  state: TextState,
): BoundingBox {
  const ascender = state.font?.ascender ?? 0.8;
  const descender = state.font?.descender ?? -0.2;
  return {
    x: pos.x,
    y: pos.y + descender * state.fontSize,
    width: width * state.fontSize * (state.horizontalScale / 100),
    height: (ascender - descender) * state.fontSize,
  };
}

function mergeBboxes(boxes: BoundingBox[]): BoundingBox {
  const minX = Math.min(...boxes.map(b => b.x));
  const minY = Math.min(...boxes.map(b => b.y));
  const maxX = Math.max(...boxes.map(b => b.x + b.width));
  const maxY = Math.max(...boxes.map(b => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function groupCharsIntoLines(chars: ExtractedChar[]): TextLine[] {
  // Group by baseline (with tolerance for slight variations)
  // Then sort left-to-right within each line
  // Implementation omitted for brevity
  return [];
}
