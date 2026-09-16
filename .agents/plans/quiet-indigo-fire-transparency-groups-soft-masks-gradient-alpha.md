---
date: 2026-02-25
title: Transparency Groups Soft Masks Gradient Alpha
---

## Problem Statement

`@libpdf/core` supports parts of PDF transparency today:

- constant opacity through ExtGState (`ca`/`CA`)
- blend mode through ExtGState (`BM`)
- image alpha through image XObject `SMask`

But it does not expose the two reusable primitives that power PDF transparency as a whole:

- **transparency groups** (`/Group` on form XObjects)
- **soft masks** (`/SMask` on ExtGState)

This forces common tasks like gradient fade-out to rely on narrow behavior rather than the native PDF model.

## Goals

1. Add transparency-group authoring on form XObjects (`/Group` with isolation/knockout/color-space controls).
2. Add soft-mask authoring on ExtGState for both `Luminosity` and `Alpha` subtypes.
3. Add `opacity` to gradient color stops and map non-uniform stop opacity to soft-mask composition automatically.
4. Keep all transparency controls composable: soft mask + constant opacity + blend mode in one graphics state.
5. Preserve the two-layer API design: low-level COS control + high-level ergonomic defaults.

## Non-Goals

- `AIS` (alpha-is-shape)
- soft-mask transfer functions
- matte/premultiplied-alpha image-mask authoring
- parsing existing soft masks from loaded PDFs
- Canvas API integration (separate consumer)

## Why This Matters

- It aligns implementation with PDF 1.4+ transparency semantics instead of adding effect-specific branches.
- It unblocks multiple effects from one foundation: gradient alpha, vignette masks, text-as-mask, grouped compositing.
- It reduces future feature cost by making transparency behavior explicit in low-level objects.
- It preserves library consistency with existing composable drawing architecture.

## Current Gap Analysis

### Supported Today

- ExtGState constant opacity (`ca`, `CA`)
- ExtGState blend modes (`BM`)
- image XObject `SMask`

### Missing for Full Model

- Form XObject `/Group` authoring for transparent compositing islands
- ExtGState `/SMask` dictionaries for arbitrary mask content
- Gradient-stop alpha channel semantics
- integrated draw-time orchestration when alpha varies spatially

## Scope

### In Scope

- `FormXObjectOptions.group` for transparency-group dictionary emission
- `FormXObjectOptions.resources` to support self-contained group content
- `ExtGStateOptions.softMask` with `Luminosity`, `Alpha`, and explicit `None`
- `ColorStop.opacity` on gradient APIs (defaulting to opaque)
- automatic decomposition for varying-opacity gradients:
  - color shading for chroma
  - grayscale shading for opacity
  - soft-mask wiring at draw time
- compatibility rules so `ca`/`CA` + `BM` + `SMask` can coexist

### Out of Scope

- parser exposure of soft masks in loaded PDFs
- new high-level helper methods that duplicate existing primitives without new capability
- renderer/canvas behavior modeling beyond PDF output generation

## Success Scenarios

### Scenario 1: Gradient Fade-Out (Common Case)

```ts
const gradient = pdf.createLinearGradient({
  angle: 90,
  length: 220,
  stops: [
    { offset: 0, color: rgb(0.9, 0.2, 0.2), opacity: 1 },
    { offset: 1, color: rgb(0.9, 0.2, 0.2), opacity: 0 },
  ],
});

const pattern = pdf.createShadingPattern({ shading: gradient });

page.drawRectangle({ x: 72, y: 450, width: 240, height: 90, pattern });
```

Expectation: users do not manually construct mask groups for this path.

### Scenario 2: Reusable Soft Mask Built from Arbitrary Content

```ts
const maskGroup = pdf.createFormXObject({
  bbox: { x: 0, y: 0, width: 300, height: 100 },
  group: { colorSpace: "DeviceGray", isolated: true },
  operators: [
    /* text, paths, gradients, images */
  ],
  resources: maskResources,
});

const maskedGs = pdf.createExtGState({
  softMask: { subtype: "Luminosity", group: maskGroup },
  fillOpacity: 0.85,
  blendMode: "Multiply",
});
```

Expectation: soft mask composes cleanly with existing opacity and blending.

### Scenario 3: Transparency Group as Compositing Unit

```ts
const groupForm = pdf.createFormXObject({
  bbox: { x: 0, y: 0, width: 200, height: 200 },
  group: { colorSpace: "DeviceRGB", isolated: true, knockout: false },
  operators: [
    /* overlapping transparent marks */
  ],
  resources: groupResources,
});
```

Expectation: viewers composite inner content as a group and then composite group output onto backdrop.

## API Direction

### Low-Level Additions

- Form XObject options include a transparency-group object and optional resources dictionary.
- ExtGState options include soft-mask definition (`Luminosity` | `Alpha` | `None`).
- Soft-mask source content is always a form XObject (the native PDF model).

### High-Level Additions

- `ColorStop.opacity?: number` on gradient APIs.
- Existing draw methods transparently choose the right path:
  - opaque stops only: current path
  - uniform non-1 opacity: constant opacity path
  - varying opacity: soft-mask path

### Explicit Non-Addition

- No separate `createTransparencyGroup()` API if it would only wrap form XObject creation.
- No separate `createSoftMask()` API if it would only wrap ExtGState creation.

Rationale: keep surface area minimal while exposing full capability.

## Architectural Fit (Two-Layer Model)

### Object/Document Layers

- Own dictionary modeling/serialization for `/Group` and `/SMask` structures.
- Enforce structural validity at object construction boundaries.

### Drawing Layer

- Owns gradient-opacity analysis and decision routing (opaque/uniform/varying).
- Owns draw-time resource assembly where geometry/bounds are known.

### High-Level API

- Exposes intent (`opacity` on stops) with sensible defaults.
- Delegates to low-level primitives to preserve predictable PDF output.

This follows existing architecture rather than introducing a parallel transparency subsystem.

## Behavioral Model

### Composition Semantics

- `BM`, `ca`/`CA`, and `SMask` are independent ExtGState terms and must be allowed together.
- Effective source opacity uses multiplicative composition (constant opacity and mask opacity both matter).

### Group-Execution Semantics

- Group behavior follows PDF transparency-group semantics.
- Documentation should call out that entering a transparency group changes compositing context.

### Fast Paths

- All stops opaque => no new transparency objects.
- All stops share same non-1 opacity => constant opacity only.
- Stops vary => soft-mask path.

## Validation and Guardrails

- `ColorStop.opacity` normalized/clamped to `[0, 1]`.
- Luminosity masks require compatible color-space expectations on source group.
- Backdrop color (if present) must match group color-space component count.
- Alpha-mask guidance favors isolated groups for predictable behavior.
- Explicit `softMask: "None"` supported as state-reset mechanism.

## Compatibility and Versioning

- Transparency output requires PDF 1.4+ semantics.
- Plan decision: define whether writer should auto-bump minimum output version when transparency primitives are used.
- No behavior change for existing opaque gradients or non-transparency drawing calls.

## Delivery Plan

### Phase 1: Low-Level Transparency Primitives

- Add form XObject transparency-group support and resources attachment.
- Add ExtGState soft-mask model (`Alpha`, `Luminosity`, `None`).
- Ensure serialization emits spec-correct dictionaries.

### Phase 2: Gradient Opacity Model

- Add `ColorStop.opacity` and default behavior.
- Add stop-opacity classification (opaque/uniform/varying).
- Preserve current gradient behavior for opaque-only input.

### Phase 3: Draw-Time Composition

- Wire varying-opacity gradients through soft-mask resources.
- Ensure one coherent graphics-state path that can include blend mode and constant opacity.
- Keep registration/resource behavior stable across repeated draw calls.

### Phase 4: Validation and Docs

- Add constructor-level validation and developer-facing errors.
- Add docs/examples for:
  - gradient fade
  - text/shape luminosity masks
  - alpha masks
  - compositional behavior with blend + opacity

## Test Plan

### Unit Tests

- `/Group` dictionary emission for form XObjects with optional fields.
- `/SMask` dictionary emission for `Luminosity`, `Alpha`, and `None`.
- Validation failures for incompatible subtype/group/backdrop inputs.
- Stop-opacity normalization and path classification behavior.

### Integration Tests

- Draw calls with varying-opacity gradients produce expected transparency resources.
- Combined behavior: one graphics state can carry blend mode + constant opacity + soft mask.
- Fill/stroke pathways both validated when pattern-based alpha is involved.

### Regression Tests

- Opaque gradient output remains byte-structure compatible with current behavior where applicable.
- Existing opacity/blend-mode tests remain stable.

### Visual Checks

- Linear and radial fade-to-transparent fixtures.
- Text-as-luminosity-mask fixture.
- Alpha-subtype fixture driven by transparent source content.
- Backdrop color fixture.

## Documentation Plan

- Update transparency sections in API docs with a conceptual model:
  - group compositing
  - soft-mask subtypes
  - gradient opacity decomposition
- Add cookbook examples for common effects (fade, vignette, masked image).
- Add explicit note about `softMask: "None"` for low-level state management.

## Risks and Mitigations

- **Resource growth**: varying-opacity gradients may add extra objects.
  - Mitigation: preserve fast paths and add future caching hooks.
- **BBox sensitivity**: mask-group bounds control visible edges.
  - Mitigation: clear bounding-box rules and integration tests around geometry.
- **Semantic confusion**: users may conflate group opacity with mask opacity.
  - Mitigation: docs/examples showing composition model explicitly.
- **Version mismatch**: transparency in pre-1.4 outputs is invalid.
  - Mitigation: enforce/auto-bump policy and test writer metadata.

## Open Questions

1. Should writer always auto-bump to at least 1.4 when transparency features are present?
2. Should we cache mask resources for repeated equivalent geometry in a first pass, or defer until profiling indicates need?
3. Should high-level API expose a convenience reset for soft masks, or keep reset solely low-level?

## Acceptance Criteria

- Users can author transparency groups through form XObject options.
- Users can author `Luminosity` and `Alpha` soft masks through ExtGState options.
- `ColorStop.opacity` enables gradient alpha behavior without manual mask plumbing.
- Soft mask, blend mode, and constant opacity compose on the same graphics state.
- Opaque-gradient and existing drawing behavior remain backward compatible.
- Generated files render correctly in major PDF viewers for covered fixtures.
