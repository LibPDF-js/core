/**
 * Load test for PdfName interning under sustained PDF processing.
 *
 * Verifies that PdfDict lookups remain correct after processing many
 * PDFs with diverse name sets. This is the scenario from issue #54
 * (point 3): in a long-running server processing hundreds of PDFs per
 * second, the old LRU cache would evict PdfName instances that were
 * still in use as PdfDict keys, causing silent lookup failures.
 *
 * The WeakRef-based cache fixes this by never evicting names that are
 * still referenced. This test validates that guarantee under load.
 *
 * Run with:
 *   bun run test:run -- -t "issue-54.*load"
 */

import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfString } from "#src/objects/pdf-string";
import { loadFixture } from "#src/test-utils";
import { describe, expect, it } from "vitest";

import { PDF } from "../../api/pdf";

describe("issue-54: PdfName interning under load", () => {
  describe("PdfDict correctness under name cache pressure", () => {
    it("dict lookups work after flooding the cache with unique names", () => {
      // Create dicts with custom keys, then flood the cache, then verify lookups.
      // With the old LRU (max 10k), this would fail once the custom keys
      // were evicted. With WeakRef, the dicts hold strong references so
      // the names stay alive.
      const dicts: PdfDict[] = [];
      const expectedValues = new Map<number, string>();

      // Create 100 dicts, each with a unique key
      for (let i = 0; i < 100; i++) {
        const uniqueKey = `CustomField_Batch0_${i}`;
        const dict = new PdfDict();

        dict.set(uniqueKey, PdfString.fromString(`value_${i}`));
        dicts.push(dict);
        expectedValues.set(i, uniqueKey);
      }

      // Flood the name cache with 15,000 unique names (exceeds old LRU max of 10k).
      // Don't hold references — these should be collectible.
      for (let i = 0; i < 15_000; i++) {
        PdfName.of(`FloodName_${i}_${Math.random().toString(36).slice(2)}`);
      }

      // Verify all original dicts still work
      for (let i = 0; i < dicts.length; i++) {
        const key = expectedValues.get(i)!;
        const value = dicts[i].get(key);

        expect(value, `dict[${i}].get("${key}") should not be undefined`).toBeDefined();
        expect((value as PdfString).asString()).toBe(`value_${i}`);
      }
    });

    it("dict lookups work across interleaved create-flood-verify cycles", () => {
      // Simulates a server that processes batches of PDFs: each batch
      // creates dicts with unique names, and between batches we flood
      // the cache with unrelated names.
      const allDicts: { dict: PdfDict; key: string; expected: string }[] = [];

      for (let batch = 0; batch < 20; batch++) {
        // Create dicts with unique keys for this batch
        for (let i = 0; i < 50; i++) {
          const key = `Batch${batch}_Field${i}`;
          const expected = `batch${batch}_value${i}`;
          const dict = new PdfDict();

          dict.set(key, PdfString.fromString(expected));
          allDicts.push({ dict, key, expected });
        }

        // Flood between batches — different names each time
        for (let i = 0; i < 2000; i++) {
          PdfName.of(`Flood_B${batch}_${i}`);
        }

        // Verify ALL dicts from ALL previous batches still work
        for (const { dict, key, expected } of allDicts) {
          const value = dict.get(key);

          expect(value, `"${key}" lookup failed after batch ${batch}`).toBeDefined();
          expect((value as PdfString).asString()).toBe(expected);
        }
      }

      // 20 batches × 50 dicts = 1000 dicts, all still correct
      expect(allDicts.length).toBe(1000);
    });

    it("permanent cache names always resolve to the same instance", () => {
      // Flood heavily, then verify static names
      for (let i = 0; i < 20_000; i++) {
        PdfName.of(`StaticFlood_${i}`);
      }

      expect(PdfName.of("Type")).toBe(PdfName.Type);
      expect(PdfName.of("Root")).toBe(PdfName.Root);
      expect(PdfName.of("Subtype")).toBe(PdfName.Subtype);
      expect(PdfName.of("Font")).toBe(PdfName.Font);
      expect(PdfName.of("Catalog")).toBe(PdfName.Catalog);
    });
  });

  describe("sustained PDF load/modify/save cycles", () => {
    it("processes 200 PDFs with unique metadata without corruption", async () => {
      const baseBytes = await loadFixture("basic", "rot0.pdf");

      for (let i = 0; i < 200; i++) {
        const title = `Document_${i}_${Date.now()}`;

        // Load a fresh copy
        const pdf = await PDF.load(new Uint8Array(baseBytes));

        // Set metadata with unique values
        pdf.setTitle(title);
        pdf.setAuthor(`Author_${i}`);

        // Save and verify round-trip
        const saved = await pdf.save();

        expect(saved.length).toBeGreaterThan(0);

        // Reload and verify metadata survived
        const reloaded = await PDF.load(saved);

        expect(reloaded.getTitle()).toBe(title);
        expect(reloaded.getPageCount()).toBe(1);
      }
    });

    it("processes 100 PDFs with unique form fields and verifies values", async () => {
      // Each iteration creates a PDF with uniquely-named form fields,
      // saves it, reloads it, and verifies the field values.
      // This creates thousands of unique PdfName instances for field
      // names, appearances, fonts, etc.
      for (let i = 0; i < 100; i++) {
        const pdf = PDF.create();
        const form = pdf.getOrCreateForm();

        // Create fields with unique names — each becomes a PdfName
        const fieldName = `user_input_${i}_${Math.random().toString(36).slice(2, 8)}`;
        const field = form.createTextField(fieldName);

        field.setValue(`Response #${i}`);

        const saved = await pdf.save();
        const reloaded = await PDF.load(saved);

        const reloadedForm = reloaded.getForm();

        expect(reloadedForm, `form missing on iteration ${i}`).not.toBeNull();

        const reloadedField = reloadedForm!.getField(fieldName);

        expect(reloadedField, `field "${fieldName}" missing on iteration ${i}`).toBeDefined();
        expect(reloadedField!.getValue()).toBe(`Response #${i}`);
      }
    });

    it("holds multiple PDFs concurrently while processing more", async () => {
      // Simulates a server that keeps recent PDFs in memory while
      // processing new ones. The held PDFs must remain functional
      // even as the name cache churns.
      const baseBytes = await loadFixture("forms", "sample_form.pdf");
      const heldPdfs: { pdf: PDF; expectedPageCount: number }[] = [];

      for (let i = 0; i < 150; i++) {
        const pdf = await PDF.load(new Uint8Array(baseBytes));

        // Hold onto every 10th PDF
        if (i % 10 === 0) {
          heldPdfs.push({ pdf, expectedPageCount: pdf.getPageCount() });
        }

        // Create name pressure via metadata
        pdf.setTitle(`Concurrent_${i}`);

        const saved = await pdf.save();

        expect(saved.length).toBeGreaterThan(0);

        // Periodically verify all held PDFs still work
        if (i % 25 === 0) {
          for (const { pdf: held, expectedPageCount } of heldPdfs) {
            expect(held.getPageCount()).toBe(expectedPageCount);
            expect(held.getTitle()).toBeDefined();
          }
        }
      }

      // Final verification of all held PDFs
      expect(heldPdfs.length).toBe(15);

      for (const { pdf, expectedPageCount } of heldPdfs) {
        expect(pdf.getPageCount()).toBe(expectedPageCount);
      }
    });
  });
});
