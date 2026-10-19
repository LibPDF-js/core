/**
 * Tests for SignatureField status classification.
 */

import { ObjectRegistry } from "#src/document/object-registry";
import { PdfArray } from "#src/objects/pdf-array";
import { PdfDict } from "#src/objects/pdf-dict";
import { PdfName } from "#src/objects/pdf-name";
import { PdfNull } from "#src/objects/pdf-null";
import { PdfNumber } from "#src/objects/pdf-number";
import { PdfString } from "#src/objects/pdf-string";
import { describe, expect, it } from "vitest";

import { SignatureField } from "./other-fields";
import type { AcroFormLike } from "./types";

const acroForm: AcroFormLike = { defaultQuadding: 0 };

function makeField(dict: PdfDict): { field: SignatureField; registry: ObjectRegistry } {
  const registry = new ObjectRegistry();
  const ref = registry.register(dict);
  const field = new SignatureField(dict, ref, registry, acroForm, "Signature1");

  return { field, registry };
}

function byteRange(): PdfArray {
  return new PdfArray([PdfNumber.of(0), PdfNumber.of(100), PdfNumber.of(200), PdfNumber.of(50)]);
}

function sigContents(): PdfString {
  // Non-empty hex string, mimicking patched /Contents bytes.
  return PdfString.fromHex("30820100");
}

describe("SignatureField", () => {
  describe("getSignatureStatus", () => {
    it("returns 'unsigned' when /V is absent", () => {
      const { field } = makeField(
        PdfDict.of({ FT: PdfName.of("Sig"), T: PdfString.fromString("Signature1") }),
      );

      expect(field.getSignatureStatus()).toBe("unsigned");
      expect(field.isSigned()).toBe(false);
      expect(field.isDocumentTimestamp()).toBe(false);
      expect(field.getSignatureDict()).toBeNull();
    });

    it("returns 'unsigned' when /V is PdfNull", () => {
      const { field } = makeField(
        PdfDict.of({
          FT: PdfName.of("Sig"),
          T: PdfString.fromString("Signature1"),
          V: PdfNull.instance,
        }),
      );

      expect(field.getSignatureStatus()).toBe("unsigned");
      expect(field.isSigned()).toBe(false);
      expect(field.getSignatureDict()).toBeNull();
    });

    it("returns 'signed' for a /Type /Sig dict with Contents + ByteRange", () => {
      const sigDict = PdfDict.of({
        Type: PdfName.of("Sig"),
        Filter: PdfName.of("Adobe.PPKLite"),
        SubFilter: PdfName.of("ETSI.CAdES.detached"),
        Contents: sigContents(),
        ByteRange: byteRange(),
      });
      const { field, registry } = makeField(
        PdfDict.of({ FT: PdfName.of("Sig"), T: PdfString.fromString("Signature1") }),
      );
      const sigRef = registry.register(sigDict);
      field.getDict().set("V", sigRef);

      expect(field.getSignatureStatus()).toBe("signed");
      expect(field.isSigned()).toBe(true);
      expect(field.isDocumentTimestamp()).toBe(false);
      expect(field.getSignatureDict()).toBe(sigDict);
    });

    it("returns 'signed' when /V dict has no /Type (defaults to Sig)", () => {
      const sigDict = PdfDict.of({
        Filter: PdfName.of("Adobe.PPKLite"),
        Contents: sigContents(),
        ByteRange: byteRange(),
      });
      const { field, registry } = makeField(
        PdfDict.of({ FT: PdfName.of("Sig"), T: PdfString.fromString("Signature1") }),
      );
      const sigRef = registry.register(sigDict);
      field.getDict().set("V", sigRef);

      expect(field.getSignatureStatus()).toBe("signed");
      expect(field.isSigned()).toBe(true);
    });

    it("returns 'timestamp' for a /Type /DocTimeStamp dict", () => {
      const tsDict = PdfDict.of({
        Type: PdfName.of("DocTimeStamp"),
        Filter: PdfName.of("Adobe.PPKLite"),
        SubFilter: PdfName.of("ETSI.RFC3161"),
        Contents: sigContents(),
        ByteRange: byteRange(),
      });
      const { field, registry } = makeField(
        PdfDict.of({ FT: PdfName.of("Sig"), T: PdfString.fromString("Timestamp1") }),
      );
      const tsRef = registry.register(tsDict);
      field.getDict().set("V", tsRef);

      expect(field.getSignatureStatus()).toBe("timestamp");
      expect(field.isSigned()).toBe(true);
      expect(field.isDocumentTimestamp()).toBe(true);
      expect(field.getSignatureDict()).toBe(tsDict);
    });

    it("walks the parent chain to find inherited /V", () => {
      const registry = new ObjectRegistry();
      const sigDict = PdfDict.of({
        Type: PdfName.of("Sig"),
        Contents: sigContents(),
        ByteRange: byteRange(),
      });
      const sigRef = registry.register(sigDict);

      const parentDict = PdfDict.of({
        FT: PdfName.of("Sig"),
        T: PdfString.fromString("parent"),
        V: sigRef,
      });
      const parentRef = registry.register(parentDict);

      const childDict = PdfDict.of({
        T: PdfString.fromString("child"),
        Parent: parentRef,
      });
      const childRef = registry.register(childDict);

      const field = new SignatureField(childDict, childRef, registry, acroForm, "parent.child");

      expect(field.getSignatureStatus()).toBe("signed");
      expect(field.isSigned()).toBe(true);
      expect(field.getSignatureDict()).toBe(sigDict);
    });

    it("returns 'invalid' when /V dict has no /Contents", () => {
      const sigDict = PdfDict.of({
        Type: PdfName.of("Sig"),
        ByteRange: byteRange(),
      });
      const { field, registry } = makeField(
        PdfDict.of({ FT: PdfName.of("Sig"), T: PdfString.fromString("Signature1") }),
      );
      const sigRef = registry.register(sigDict);
      field.getDict().set("V", sigRef);

      expect(field.getSignatureStatus()).toBe("invalid");
      expect(field.isSigned()).toBe(false);
      // Dict still surfaced for forensic inspection.
      expect(field.getSignatureDict()).toBe(sigDict);
    });

    it("returns 'invalid' when /Contents is empty", () => {
      const sigDict = PdfDict.of({
        Type: PdfName.of("Sig"),
        Contents: new PdfString(new Uint8Array(0), "hex"),
        ByteRange: byteRange(),
      });
      const { field, registry } = makeField(
        PdfDict.of({ FT: PdfName.of("Sig"), T: PdfString.fromString("Signature1") }),
      );
      const sigRef = registry.register(sigDict);
      field.getDict().set("V", sigRef);

      expect(field.getSignatureStatus()).toBe("invalid");
      expect(field.isSigned()).toBe(false);
    });

    it("returns 'invalid' when /V dict has no /ByteRange", () => {
      const sigDict = PdfDict.of({
        Type: PdfName.of("Sig"),
        Contents: sigContents(),
      });
      const { field, registry } = makeField(
        PdfDict.of({ FT: PdfName.of("Sig"), T: PdfString.fromString("Signature1") }),
      );
      const sigRef = registry.register(sigDict);
      field.getDict().set("V", sigRef);

      expect(field.getSignatureStatus()).toBe("invalid");
      expect(field.isSigned()).toBe(false);
      expect(field.getSignatureDict()).toBe(sigDict);
    });

    it("returns 'invalid' when /ByteRange has wrong length", () => {
      const sigDict = PdfDict.of({
        Type: PdfName.of("Sig"),
        Contents: sigContents(),
        ByteRange: new PdfArray([PdfNumber.of(0), PdfNumber.of(100)]),
      });
      const { field, registry } = makeField(
        PdfDict.of({ FT: PdfName.of("Sig"), T: PdfString.fromString("Signature1") }),
      );
      const sigRef = registry.register(sigDict);
      field.getDict().set("V", sigRef);

      expect(field.getSignatureStatus()).toBe("invalid");
      expect(field.isSigned()).toBe(false);
    });

    it("returns 'invalid' when /ByteRange contains a non-number", () => {
      const sigDict = PdfDict.of({
        Type: PdfName.of("Sig"),
        Contents: sigContents(),
        ByteRange: new PdfArray([
          PdfNumber.of(0),
          PdfNumber.of(100),
          PdfName.of("Bogus"),
          PdfNumber.of(50),
        ]),
      });
      const { field, registry } = makeField(
        PdfDict.of({ FT: PdfName.of("Sig"), T: PdfString.fromString("Signature1") }),
      );
      const sigRef = registry.register(sigDict);
      field.getDict().set("V", sigRef);

      expect(field.getSignatureStatus()).toBe("invalid");
      expect(field.isSigned()).toBe(false);
    });

    it("returns 'invalid' when /V dict has an unrecognized /Type", () => {
      const sigDict = PdfDict.of({
        Type: PdfName.of("Catalog"),
        Contents: sigContents(),
        ByteRange: byteRange(),
      });
      const { field, registry } = makeField(
        PdfDict.of({ FT: PdfName.of("Sig"), T: PdfString.fromString("Signature1") }),
      );
      const sigRef = registry.register(sigDict);
      field.getDict().set("V", sigRef);

      expect(field.getSignatureStatus()).toBe("invalid");
      expect(field.isSigned()).toBe(false);
    });

    it("returns 'invalid' when /V is a non-dict primitive", () => {
      const { field } = makeField(
        PdfDict.of({
          FT: PdfName.of("Sig"),
          T: PdfString.fromString("Signature1"),
          V: PdfNumber.of(42),
        }),
      );

      expect(field.getSignatureStatus()).toBe("invalid");
      expect(field.isSigned()).toBe(false);
      // No dict to surface for forensics.
      expect(field.getSignatureDict()).toBeNull();
    });
  });
});
