# Fix Font Embedding: Deferred Subsetting

## Problem

The current font embedding implementation has a fundamental flaw: subsetting happens during `prepare()`, which is called when fonts are first used (in `drawText()` or form fields). This causes issues:

1. **Async API pollution**: `drawText()` must be async because `prepare()` is async
2. **Race conditions**: If `prepare()` is called before all text is encoded, the subset is incomplete
3. **The test failure case**: Tests weren't awaiting `drawText()`, so fonts were subsetted with empty glyph sets

### Current Flow (Broken)

```
embedFont(data) → EmbeddedFont created (sync)
     ↓
drawText(text, { font }) → addFontResource() → getFontRef() → prepare() [ASYNC!]
     ↓                                              ↓
     ↓                                    subsetting happens HERE
     ↓                                    (based on glyphs encoded so far)
     ↓
encodeText(text) → tracks glyphs (but too late for subset!)
     ↓
save() → fonts already subsetted
```

## Solution

Move subsetting to `save()` time with an explicit option. Make the entire font API synchronous.

### Desired Flow

```
embedFont(data) → EmbeddedFont created (sync)
     ↓
drawText(text, { font }) → encodeText(text) → tracks glyphs [SYNC]
     ↓                           ↓
     ↓                   font added to page resources (ref TBD)
     ↓
save({ subsetFonts: true }) → subsetting happens HERE
                                    ↓
                              all glyphs known
                              subset is complete
```

## Design Decisions

### 1. Subsetting is Optional

```typescript
await pdf.save({ subsetFonts: true }); // Subset embedded fonts
await pdf.save(); // Embed full fonts (default)
```

**Rationale**:

- Subsetting reduces file size but takes time
- Some use cases need full fonts (e.g., editable forms where users might type any character)
- Default to full embedding for safety/simplicity

### 2. Track Form Usage

Fonts used in form fields should NOT be subsetted because:

- Users can type any character at runtime
- The subset wouldn't include all possible glyphs

```typescript
class EmbeddedFont {
  private usedInForm: boolean = false;

  markUsedInForm(): void {
    this.usedInForm = true;
  }

  canSubset(): boolean {
    return !this.usedInForm;
  }
}
```

### 3. Placeholder References Until Save

During document construction, fonts need references for page resources. Options:

**Option A: Pre-allocate refs** (Recommended)

- Allocate a `PdfRef` immediately in `embedFont()`
- The ref points to nothing until `save()` creates the actual objects
- Simple, no async needed

**Option B: Lazy ref resolution**

- Use a placeholder name in resources
- Resolve to actual refs during serialization
- More complex, requires special handling in writer

### 4. Sync vs Async Subsetting

The `TTFSubsetter.write()` is marked async but contains no await calls - it's purely synchronous. We can:

- Make it sync (remove async/Promise)
- Or keep async for future-proofing (Web Workers, etc.)

**Decision**: Keep subsetting async, but only call it during `save()` which is already async.

## API Changes

### PDFPage.drawText() - Now Sync

```typescript
// Before (async)
async drawText(text: string, options?: DrawTextOptions): Promise<void>

// After (sync)
drawText(text: string, options?: DrawTextOptions): void
```

### PDF.save() - New Option

```typescript
interface SaveOptions {
  // ... existing options

  /**
   * Subset embedded fonts to include only used glyphs.
   * Reduces file size but takes additional processing time.
   *
   * Fonts used in form fields are never subsetted (users may type any character).
   *
   * @default false
   */
  subsetFonts?: boolean;
}

await pdf.save({ subsetFonts: true });
```

### EmbeddedFont - New Methods

```typescript
class EmbeddedFont {
  /** Mark this font as used in a form field (prevents subsetting) */
  markUsedInForm(): void;

  /** Whether this font can be subsetted */
  canSubset(): boolean;

  /** Reset glyph usage tracking (for testing) */
  resetUsage(): void;
}
```

## Implementation Plan

### Phase 1: Make Font Refs Synchronous

1. **Modify `pdf.embedFont()`** to allocate a `PdfRef` immediately
   - Store in `PDFFonts.embeddedFonts` map as `Map<EmbeddedFont, PdfRef>`
   - No more `null` refs that get filled in later

2. **Modify `PDFFonts.getRef()`** to return sync
   - Remove call to `prepare()`
   - Just return the pre-allocated ref

3. **Remove `fontRefResolver` async requirement**
   - `PDFContext.getFontRef()` becomes sync
   - `page.addFontResource()` becomes sync

### Phase 2: Make drawText Synchronous

1. **Modify `PDFPage.drawText()`**
   - Change signature from `async ... Promise<void>` to `... void`
   - Remove await on `addFontResource()`

2. **Update all tests**
   - Remove `await` from `drawText()` calls
   - Tests should pass without waiting

### Phase 3: Move Subsetting to Save

1. **Add `subsetFonts` option to `SaveOptions`**

2. **Create `PDFFonts.finalize(subsetFonts: boolean)`**
   - Called from `pdf.save()` before serialization
   - If `subsetFonts`:
     - For each font where `canSubset()`:
       - Get used glyph IDs from `font.getUsedGlyphIds()`
       - Call subsetter to create subset font data
       - Create font objects with subset data
     - For fonts where `!canSubset()`:
       - Embed full font program
   - If not `subsetFonts`:
     - Embed full font programs for all fonts

3. **Modify font object creation**
   - Currently in `createFontObjects()` in `font-embedder.ts`
   - Split into:
     - `createFontObjectsFull(font)` - embeds entire font program
     - `createFontObjectsSubset(font, usedGlyphIds)` - subsets and embeds

4. **Update `pdf.save()`**
   - Call `fonts.finalize(options.subsetFonts ?? false)` before write

### Phase 4: Track Form Usage

1. **Modify `AppearanceGenerator`**
   - When using an `EmbeddedFont`, call `font.markUsedInForm()`
   - This happens when generating appearances for text fields, etc.

2. **Add `usedInForm` flag to `EmbeddedFont`**
   - Set by `markUsedInForm()`
   - Checked by `canSubset()`

### Phase 5: Cleanup

1. **Remove `PDFFonts.prepare()`** - no longer needed
2. **Remove async from subsetter** (optional, for consistency)
3. **Update documentation** for new `save()` option

## File Changes

| File                                          | Changes                                                     |
| --------------------------------------------- | ----------------------------------------------------------- |
| `src/api/pdf.ts`                              | Add `subsetFonts` to `SaveOptions`, call `fonts.finalize()` |
| `src/api/pdf-fonts.ts`                        | Pre-allocate refs, add `finalize()`, remove `prepare()`     |
| `src/api/pdf-context.ts`                      | Make `getFontRef()` sync                                    |
| `src/api/pdf-page.ts`                         | Make `drawText()` sync, make `addFontResource()` sync       |
| `src/fonts/embedded-font.ts`                  | Add `usedInForm`, `markUsedInForm()`, `canSubset()`         |
| `src/fonts/font-embedder.ts`                  | Split into full/subset embedding functions                  |
| `src/document/forms/appearance-generator.ts`  | Call `markUsedInForm()` for embedded fonts                  |
| `src/api/drawing/drawing.integration.test.ts` | Remove `await` from `drawText()` calls                      |
| Various other tests                           | Update to sync `drawText()`                                 |

## Testing Strategy

1. **Unit tests for EmbeddedFont**
   - Glyph tracking works correctly
   - `markUsedInForm()` prevents subsetting
   - `canSubset()` returns correct value

2. **Integration tests for subsetting**
   - PDF with `subsetFonts: true` has smaller font streams
   - PDF with `subsetFonts: false` has full font data
   - Subset PDFs render text correctly
   - Full PDFs render text correctly

3. **Form field tests**
   - Fonts used in forms are marked `usedInForm`
   - Those fonts are not subsetted even with `subsetFonts: true`

4. **Sync API tests**
   - `drawText()` works without await
   - Multiple `drawText()` calls in sequence work correctly

## Migration Notes

This is a **breaking API change** for anyone using `await page.drawText()`. However:

- TypeScript will catch the issue (return type changes from `Promise<void>` to `void`)
- The `await` on a non-Promise is harmless (just returns the value)
- So existing code with `await` will still work, just with a type warning

## Decisions

1. **Default for `subsetFonts`**: `false` for safety - users opt-in to subsetting

2. **Subset tag generation**: Keep generating random prefix (e.g., "ABCDEF+FontName") - it's standard practice and helps identify subsets

3. **CFF font subsetting**: Add CFF subsetting in a follow-up if not already present
