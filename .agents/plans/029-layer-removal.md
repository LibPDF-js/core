# 029: Layer Removal (Optional Content Groups)

## Problem Statement

PDF documents can contain Optional Content Groups (OCG), commonly called "layers". These allow content to be conditionally visible based on viewer settings, print vs. screen mode, or user interaction.

**Security concern**: Hidden layers can contain malicious content that becomes visible after a document is signed. An attacker could hide text like "I owe you $1,000,000" in an OFF layer, get a signature, then turn the layer ON.

Layer removal eliminates this attack vector by removing the OCG structure from the document, making all content unconditionally visible and removing the ability for viewers to toggle layer visibility.

## Goals

- Remove OCG/layer structure from PDF documents
- Provide fast default mode (structure removal only)
- Provide thorough mode (also clean content streams) - deferred until 029a complete
- Simple API that matches real-world usage (pre-signing security)

## Non-Goals (This Plan)

- Selective layer removal (keep some, remove others)
- Visibility-based flattening (keep visible, remove hidden)
- Layer creation or modification
- Complex visibility expression evaluation

## Dependencies

- **029a: Content Stream Parser** - Required for deep mode (deferred)

---

## Research Findings

### Industry Approaches

No major PDF library implements true OCG "flattening" (content stream modification based on visibility). Instead:

- **PDFBox**: Skips OCG content during rendering, no removal capability
- **pdf.js**: Skips OCG content during rendering, no removal capability  
- **PyMuPDF**: Workaround - replace OCG dictionaries with empty `<<>>`
- **Documenso**: Delete `/OCProperties` from catalog (~5 lines of code)

### The Simple Approach Works

Deleting `/OCProperties` from the catalog is sufficient because:
- Without OCProperties, viewers treat all content as unconditionally visible
- Layer toggle UI disappears from PDF viewers
- Hidden content becomes visible (which is the security goal)
- Content stream markers (`/OC /name BDC...EMC`) are ignored without OCProperties

### Deep Cleaning (Future Enhancement)

For thorough cleanup, we can also (requires 029a):
- Remove BDC/EMC marked content blocks with `/OC` tag from content streams
- Remove `/OC` entries from XObjects and annotations
- Remove orphaned OCG/OCMD dictionaries
- Remove `/Properties` entries from page resources

---

## Background: OCG Structure in PDF

### Document Catalog

```
<< /Type /Catalog
   /OCProperties <<
     /OCGs [10 0 R 11 0 R 12 0 R]    % All OCG dictionaries
     /D <<                            % Default viewing configuration
       /BaseState /ON                 % Default: ON, OFF, or Unchanged
       /ON [10 0 R]                   % OCGs explicitly ON
       /OFF [11 0 R 12 0 R]           % OCGs explicitly OFF
       /Order [...]                   % UI display order
       /Locked [...]                  % OCGs that can't be toggled
       /RBGroups [[...]]              % Radio button groups
     >>
   >>
>>
```

### OCG Dictionary

```
<< /Type /OCG
   /Name (Background)    % Display name
   /Intent /View         % Optional: View, Design, or array
>>
```

### Content Stream Usage

Content is wrapped with marked content operators:

```
/OC /MC0 BDC          % Begin - MC0 references OCG via Properties
  BT
  /F1 12 Tf
  100 600 Td
  (This text is on a layer) Tj
  ET
EMC                   % End marked content
```

---

## High-Level API

```typescript
// Check if document has layers (thorough check)
const hasLayers = await pdf.hasLayers();

// Get layer info (for UI/debugging)
const layers = await pdf.getLayers();

// Remove layers - fast mode (default)
const result = await pdf.removeLayers();

// Remove layers - thorough mode (future, requires 029a)
const result = await pdf.removeLayers({ deep: true });
```

### Type Definitions

```typescript
interface LayerInfo {
  /** Layer display name from OCG dictionary */
  name: string;
  
  /** Reference to OCG dictionary */
  ref: PdfRef;
  
  /** Current visibility based on default configuration */
  visible: boolean;
  
  /** Intent (View, Design, or custom) */
  intent?: string;
  
  /** Whether layer is locked (cannot be toggled by user) */
  locked?: boolean;
}

interface RemoveLayersOptions {
  /** 
   * If true, also clean content streams by removing BDC/EMC blocks.
   * Requires content stream parser (029a).
   * @default false
   */
  deep?: boolean;
}

interface RemoveLayersResult {
  /** Whether any layers were removed */
  removed: boolean;
  
  /** Number of OCG layers that existed */
  layerCount: number;
}
```

### Usage Examples

```typescript
// Basic usage - check and remove
const pdf = await PDF.load(bytes);

if (await pdf.hasLayers()) {
  const result = await pdf.removeLayers();
  console.log(`Removed ${result.layerCount} layers`);
}

// Pre-signing security workflow
const pdf = await PDF.load(bytes);
await pdf.removeLayers(); // Safe even if no layers exist
const signed = await pdf.sign({ signer, ... });

// Inspect layers before removal
const layers = await pdf.getLayers();
for (const layer of layers) {
  console.log(`Layer: ${layer.name}, visible: ${layer.visible}, locked: ${layer.locked}`);
}
await pdf.removeLayers();

// Future: deep cleaning
await pdf.removeLayers({ deep: true });
```

---

## Architecture

### New Module

```
src/
  layers/
    index.ts        # Public exports
    remover.ts      # Main removal logic  
    parser.ts       # OCProperties/OCG parsing
    types.ts        # LayerInfo, RemoveLayersResult types
```

### Integration Points

- **PDF class** - `removeLayers()`, `hasLayers()`, `getLayers()` methods
- **Catalog** - OCProperties parsing and deletion
- **Content streams** - Cleaning (deep mode, future)

---

## Implementation

### Phase 1: Fast Mode (This Plan)

#### `hasLayers()`

Thorough check that verifies OCGs array actually has entries:

```typescript
async hasLayers(): Promise<boolean> {
  const catalog = await this.getCatalog();
  const ocProperties = catalog.get("OCProperties");
  
  if (!ocProperties) {
    return false;
  }
  
  const ocPropsDict = await this.resolve(ocProperties);
  if (!(ocPropsDict instanceof PdfDict)) {
    return false;
  }
  
  const ocgs = await this.resolve(ocPropsDict.get("OCGs"));
  if (!(ocgs instanceof PdfArray) || ocgs.length === 0) {
    return false;
  }
  
  return true;
}
```

#### `getLayers()`

Parse OCG dictionaries and default configuration:

```typescript
async getLayers(): Promise<LayerInfo[]> {
  const catalog = await this.getCatalog();
  const ocProperties = await this.resolve(catalog.get("OCProperties"));
  
  if (!(ocProperties instanceof PdfDict)) {
    return [];
  }
  
  const ocgs = await this.resolve(ocProperties.get("OCGs"));
  if (!(ocgs instanceof PdfArray)) {
    return [];
  }
  
  // Parse default config for visibility and locked state
  const defaultConfig = await this.resolve(ocProperties.get("D"));
  const { baseState, onList, offList, lockedList } = parseDefaultConfig(defaultConfig);
  
  const layers: LayerInfo[] = [];
  
  for (const ref of ocgs.items()) {
    if (!(ref instanceof PdfRef)) continue;
    
    const ocg = await this.resolve(ref);
    if (!(ocg instanceof PdfDict)) continue;
    
    const name = ocg.get("Name")?.toString() ?? "Unnamed";
    const intent = ocg.get("Intent")?.toString();
    
    // Determine visibility from config
    let visible = baseState !== "OFF";
    if (onList.has(ref)) visible = true;
    if (offList.has(ref)) visible = false;
    
    const locked = lockedList.has(ref);
    
    layers.push({ name, ref, visible, intent, locked });
  }
  
  return layers;
}
```

#### `removeLayers()`

Delete OCProperties from catalog:

```typescript
async removeLayers(options?: RemoveLayersOptions): Promise<RemoveLayersResult> {
  if (options?.deep) {
    throw new Error("Deep mode requires content stream parser (not yet implemented)");
  }
  
  const catalog = await this.getCatalog();
  const ocProperties = catalog.get("OCProperties");
  
  if (!ocProperties) {
    return { removed: false, layerCount: 0 };
  }
  
  // Count layers before removal
  const layers = await this.getLayers();
  const layerCount = layers.length;
  
  if (layerCount === 0) {
    // OCProperties exists but no valid OCGs - still remove it
    catalog.delete("OCProperties");
    return { removed: true, layerCount: 0 };
  }
  
  // Validate structure before removal (fail fast on malformed)
  await this.validateOCGStructure(ocProperties);
  
  // Remove OCProperties
  catalog.delete("OCProperties");
  
  return { removed: true, layerCount };
}
```

#### Error Handling

Fail fast on malformed OCG structures:

```typescript
private async validateOCGStructure(ocProperties: PdfObject): Promise<void> {
  const ocPropsDict = await this.resolve(ocProperties);
  
  if (!(ocPropsDict instanceof PdfDict)) {
    throw new Error("Malformed PDF: OCProperties is not a dictionary");
  }
  
  const ocgs = ocPropsDict.get("OCGs");
  if (ocgs !== undefined) {
    const resolved = await this.resolve(ocgs);
    if (!(resolved instanceof PdfArray)) {
      throw new Error("Malformed PDF: OCProperties.OCGs is not an array");
    }
  }
  
  const defaultConfig = ocPropsDict.get("D");
  if (defaultConfig !== undefined) {
    const resolved = await this.resolve(defaultConfig);
    if (!(resolved instanceof PdfDict)) {
      throw new Error("Malformed PDF: OCProperties.D is not a dictionary");
    }
  }
}
```

### Phase 2: Deep Mode (Future, After 029a)

When content stream parser is available:

1. **Parse each page's content stream(s)**
2. **Find `/OC /name BDC ... EMC` blocks**
3. **Remove the BDC, EMC, and all content between them**
4. **Reserialize content stream**
5. **Clean XObjects and annotations with `/OC` entries**
6. **Remove `/Properties` entries from resources**

This will be implemented after 029a (Content Stream Parser) is complete.

---

## Test Strategy

### Unit Tests

- `hasLayers()` returns false for PDF without OCProperties
- `hasLayers()` returns false for empty OCGs array
- `hasLayers()` returns true for valid OCG structure
- `getLayers()` returns empty array for no layers
- `getLayers()` correctly parses layer names, visibility, intent, locked
- `getLayers()` handles BaseState ON/OFF/Unchanged correctly
- `removeLayers()` returns `{ removed: false, layerCount: 0 }` for no layers
- `removeLayers()` deletes OCProperties from catalog
- `removeLayers()` returns correct layer count
- `removeLayers()` throws on malformed OCProperties
- `removeLayers({ deep: true })` throws until 029a implemented

### Integration Tests

- Remove layers from PDF with single layer
- Remove layers from PDF with multiple layers (mixed visibility)
- Remove layers from PDF with locked layers
- Verify flattened PDF opens correctly in viewers
- Verify layer UI is gone from PDF viewers after removal

### Test Fixtures

Create/obtain test PDFs with:
- Single layer (ON)
- Single layer (OFF)
- Multiple layers with mixed visibility
- Layers with different intents (View, Design)
- Locked layers
- Malformed OCProperties (for error handling tests)

Fixture location: `fixtures/layers/`

---

## API Details

### `pdf.hasLayers()`

```typescript
/**
 * Check if the document contains Optional Content Groups (layers).
 * 
 * Performs a thorough check that verifies OCProperties exists and
 * contains at least one valid OCG entry.
 * 
 * @returns Promise<boolean> - true if document has layers
 */
async hasLayers(): Promise<boolean>
```

### `pdf.getLayers()`

```typescript
/**
 * Get information about all layers in the document.
 * 
 * Returns layer metadata including name, visibility state,
 * intent, and locked status based on the default configuration.
 * 
 * @returns Promise<LayerInfo[]> - array of layer information
 */
async getLayers(): Promise<LayerInfo[]>
```

### `pdf.removeLayers()`

```typescript
/**
 * Remove all Optional Content Groups (layers) from the document.
 * 
 * By default, removes the OCProperties structure from the catalog,
 * which makes all content unconditionally visible and removes the
 * layer toggle UI from PDF viewers.
 * 
 * This is recommended before signing to prevent hidden content attacks.
 * 
 * @param options.deep - If true, also clean content streams (future)
 * @returns Promise<RemoveLayersResult> - removal statistics
 * @throws Error if OCG structure is malformed
 */
async removeLayers(options?: RemoveLayersOptions): Promise<RemoveLayersResult>
```

---

## Decisions Log

| Question | Decision | Rationale |
|----------|----------|-----------|
| Content stream parser | Separate spec (029a) | Reusable for other features |
| Initial shipping | Fast mode only | Provides security value, matches Documenso |
| Deep mode | Deferred until 029a | Requires content stream parser |
| `hasLayers()` check | Thorough (verify OCGs array) | Avoid false positives on malformed PDFs |
| `getLayers()` return | Full metadata | Better UX for debugging/UI |
| No layers behavior | Return stats object | Useful feedback without exceptions |
| Error handling | Fail fast | Predictable behavior, no silent failures |
| Deep mode stats | Same shape as fast mode | Simplicity and consistency |

---

## References

- PDF 1.7 Specification, Section 8.11 (Optional Content)
- [Documenso PR #1528](https://github.com/documenso/documenso/pull/1528) - OCG removal implementation
- [PyMuPDF Discussion #3567](https://github.com/pymupdf/PyMuPDF/discussions/3567) - OCG deletion workaround
- [CVE-2024-52271](https://github.com/advisories/GHSA-37x7-5c6x-7g37) - Documenso PDF spoofing vulnerability
