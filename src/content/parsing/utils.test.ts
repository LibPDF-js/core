import { describe, expect, it } from "vitest";
import type { AnyOperation, ParsedOperation } from "./types";
import {
  extractTextOperations,
  filterMarkedContent,
  findOperations,
  isInsideMarkedContent,
  stripMarkedContent,
} from "./utils";

// Helper to create a simple ParsedOperation
function op(operator: string, ...operandValues: (string | number)[]): ParsedOperation {
  return {
    operator,
    operands: operandValues.map(v => {
      if (typeof v === "string") {
        return { type: "name" as const, value: v };
      }

      return { type: "number" as const, value: v };
    }),
  };
}

describe("filterMarkedContent", () => {
  it("removes single BMC/EMC block", () => {
    const operations: AnyOperation[] = [op("q"), op("BMC", "OC"), op("g", 0.5), op("EMC"), op("Q")];

    const filtered = filterMarkedContent(operations, tag => tag === "OC");

    expect(filtered).toHaveLength(2);
    expect(filtered[0].operator).toBe("q");
    expect(filtered[1].operator).toBe("Q");
  });

  it("removes BDC/EMC block", () => {
    const operations: AnyOperation[] = [
      op("q"),
      op("BDC", "OC", "MC0"),
      op("g", 0.5),
      op("EMC"),
      op("Q"),
    ];

    const filtered = filterMarkedContent(operations, tag => tag === "OC");

    expect(filtered).toHaveLength(2);
    expect(filtered[0].operator).toBe("q");
    expect(filtered[1].operator).toBe("Q");
  });

  it("keeps non-matching marked content", () => {
    const operations: AnyOperation[] = [
      op("q"),
      op("BMC", "Span"),
      op("g", 0.5),
      op("EMC"),
      op("Q"),
    ];

    const filtered = filterMarkedContent(operations, tag => tag === "OC");

    expect(filtered).toHaveLength(5);
  });

  it("handles nested marked content", () => {
    const operations: AnyOperation[] = [
      op("q"),
      op("BMC", "OC"),
      op("BMC", "Span"),
      op("g", 0.5),
      op("EMC"),
      op("EMC"),
      op("Q"),
    ];

    const filtered = filterMarkedContent(operations, tag => tag === "OC");

    expect(filtered).toHaveLength(2);
    expect(filtered[0].operator).toBe("q");
    expect(filtered[1].operator).toBe("Q");
  });

  it("handles multiple separate blocks", () => {
    const operations: AnyOperation[] = [
      op("q"),
      op("BMC", "OC"),
      op("g", 0.5),
      op("EMC"),
      op("g", 0.8), // Outside OC blocks
      op("BMC", "OC"),
      op("g", 0.3),
      op("EMC"),
      op("Q"),
    ];

    const filtered = filterMarkedContent(operations, tag => tag === "OC");

    // Should keep: q, g(0.8), Q
    expect(filtered).toHaveLength(3);
    expect(filtered[0].operator).toBe("q");
    expect(filtered[1].operator).toBe("g");
    expect(filtered[2].operator).toBe("Q");
  });

  it("removes only matching tags", () => {
    const operations: AnyOperation[] = [
      op("BMC", "Layer1"),
      op("g", 0.5),
      op("EMC"),
      op("BMC", "Layer2"),
      op("g", 0.8),
      op("EMC"),
    ];

    const filtered = filterMarkedContent(operations, tag => tag === "Layer1");

    expect(filtered).toHaveLength(3);
    expect(filtered[0].operator).toBe("BMC");
    expect(filtered[1].operator).toBe("g");
    expect(filtered[2].operator).toBe("EMC");
  });
});

describe("extractTextOperations", () => {
  it("extracts Tj operations", () => {
    const operations: AnyOperation[] = [op("BT"), op("Tf", "F1", 12), op("Tj"), op("ET")];

    const textOps = extractTextOperations(operations);

    expect(textOps).toHaveLength(1);
    expect(textOps[0].operator).toBe("Tj");
  });

  it("extracts TJ operations", () => {
    const operations: AnyOperation[] = [op("BT"), op("TJ"), op("ET")];

    const textOps = extractTextOperations(operations);

    expect(textOps).toHaveLength(1);
    expect(textOps[0].operator).toBe("TJ");
  });

  it("extracts quote operators", () => {
    const operations: AnyOperation[] = [op("BT"), op("'"), op('"'), op("ET")];

    const textOps = extractTextOperations(operations);

    expect(textOps).toHaveLength(2);
    expect(textOps[0].operator).toBe("'");
    expect(textOps[1].operator).toBe('"');
  });

  it("returns empty for no text operations", () => {
    const operations: AnyOperation[] = [op("q"), op("cm", 1, 0, 0, 1, 0, 0), op("Q")];

    const textOps = extractTextOperations(operations);

    expect(textOps).toHaveLength(0);
  });
});

describe("findOperations", () => {
  it("finds operations by name", () => {
    const operations: AnyOperation[] = [
      op("q"),
      op("cm", 1, 0, 0, 1, 0, 0),
      op("g", 0.5),
      op("cm", 2, 0, 0, 2, 0, 0),
      op("Q"),
    ];

    const cmOps = findOperations(operations, "cm");

    expect(cmOps).toHaveLength(2);
    expect(cmOps[0].operator).toBe("cm");
    expect(cmOps[1].operator).toBe("cm");
  });

  it("returns empty if not found", () => {
    const operations: AnyOperation[] = [op("q"), op("Q")];

    const textOps = findOperations(operations, "Tj");

    expect(textOps).toHaveLength(0);
  });
});

describe("isInsideMarkedContent", () => {
  it("returns true if inside matching marked content", () => {
    const operations: AnyOperation[] = [op("q"), op("BMC", "OC"), op("g", 0.5), op("EMC"), op("Q")];

    expect(isInsideMarkedContent(operations, 2, "OC")).toBe(true);
  });

  it("returns false if outside marked content", () => {
    const operations: AnyOperation[] = [op("q"), op("BMC", "OC"), op("g", 0.5), op("EMC"), op("Q")];

    expect(isInsideMarkedContent(operations, 0, "OC")).toBe(false);
    expect(isInsideMarkedContent(operations, 4, "OC")).toBe(false);
  });

  it("returns false if inside different tag", () => {
    const operations: AnyOperation[] = [op("BMC", "Span"), op("g", 0.5), op("EMC")];

    expect(isInsideMarkedContent(operations, 1, "OC")).toBe(false);
  });

  it("handles nested marked content", () => {
    const operations: AnyOperation[] = [
      op("BMC", "OC"),
      op("BMC", "Span"),
      op("g", 0.5),
      op("EMC"),
      op("EMC"),
    ];

    // Inside both OC and Span
    expect(isInsideMarkedContent(operations, 2, "OC")).toBe(true);
    expect(isInsideMarkedContent(operations, 2, "Span")).toBe(true);

    // After Span EMC but still inside OC
    expect(isInsideMarkedContent(operations, 4, "OC")).toBe(true);
    expect(isInsideMarkedContent(operations, 4, "Span")).toBe(false);
  });
});

describe("stripMarkedContent", () => {
  it("strips BMC/EMC wrapper but keeps content", () => {
    const operations: AnyOperation[] = [op("q"), op("BMC", "OC"), op("g", 0.5), op("EMC"), op("Q")];

    const stripped = stripMarkedContent(operations, tag => tag === "OC");

    // Should keep: q, g(0.5), Q - the content is preserved
    expect(stripped).toHaveLength(3);
    expect(stripped[0].operator).toBe("q");
    expect(stripped[1].operator).toBe("g");
    expect(stripped[2].operator).toBe("Q");
  });

  it("strips BDC/EMC wrapper but keeps content", () => {
    const operations: AnyOperation[] = [
      op("q"),
      op("BDC", "OC", "MC0"),
      op("g", 0.5),
      op("EMC"),
      op("Q"),
    ];

    const stripped = stripMarkedContent(operations, tag => tag === "OC");

    expect(stripped).toHaveLength(3);
    expect(stripped[0].operator).toBe("q");
    expect(stripped[1].operator).toBe("g");
    expect(stripped[2].operator).toBe("Q");
  });

  it("keeps non-matching marked content wrappers", () => {
    const operations: AnyOperation[] = [
      op("q"),
      op("BMC", "Span"),
      op("g", 0.5),
      op("EMC"),
      op("Q"),
    ];

    const stripped = stripMarkedContent(operations, tag => tag === "OC");

    // Should keep everything including BMC/EMC for Span
    expect(stripped).toHaveLength(5);
  });

  it("handles nested marked content - strips outer, keeps inner", () => {
    const operations: AnyOperation[] = [
      op("q"),
      op("BMC", "OC"),
      op("BMC", "Span"),
      op("g", 0.5),
      op("EMC"),
      op("EMC"),
      op("Q"),
    ];

    const stripped = stripMarkedContent(operations, tag => tag === "OC");

    // Should keep: q, BMC(Span), g, EMC, Q - inner marked content preserved
    expect(stripped).toHaveLength(5);
    expect(stripped[0].operator).toBe("q");
    expect(stripped[1].operator).toBe("BMC");
    expect(stripped[2].operator).toBe("g");
    expect(stripped[3].operator).toBe("EMC");
    expect(stripped[4].operator).toBe("Q");
  });

  it("handles multiple separate blocks", () => {
    const operations: AnyOperation[] = [
      op("q"),
      op("BMC", "OC"),
      op("g", 0.5),
      op("EMC"),
      op("g", 0.8), // Outside OC blocks
      op("BMC", "OC"),
      op("g", 0.3),
      op("EMC"),
      op("Q"),
    ];

    const stripped = stripMarkedContent(operations, tag => tag === "OC");

    // Should keep: q, g(0.5), g(0.8), g(0.3), Q - all content preserved
    expect(stripped).toHaveLength(5);
    expect(stripped[0].operator).toBe("q");
    expect(stripped[1].operator).toBe("g");
    expect(stripped[2].operator).toBe("g");
    expect(stripped[3].operator).toBe("g");
    expect(stripped[4].operator).toBe("Q");
  });

  it("strips only matching tags", () => {
    const operations: AnyOperation[] = [
      op("BMC", "Layer1"),
      op("g", 0.5),
      op("EMC"),
      op("BMC", "Layer2"),
      op("g", 0.8),
      op("EMC"),
    ];

    const stripped = stripMarkedContent(operations, tag => tag === "Layer1");

    // Should strip Layer1 wrapper, keep Layer2 wrapper
    expect(stripped).toHaveLength(4);
    expect(stripped[0].operator).toBe("g"); // Content from Layer1
    expect(stripped[1].operator).toBe("BMC"); // Layer2 wrapper
    expect(stripped[2].operator).toBe("g"); // Content from Layer2
    expect(stripped[3].operator).toBe("EMC"); // Layer2 wrapper
  });

  it("compares with filterMarkedContent - strip keeps content, filter removes it", () => {
    const operations: AnyOperation[] = [op("q"), op("BMC", "OC"), op("g", 0.5), op("EMC"), op("Q")];

    const stripped = stripMarkedContent(operations, tag => tag === "OC");
    const filtered = filterMarkedContent(operations, tag => tag === "OC");

    // Strip keeps content
    expect(stripped).toHaveLength(3);
    expect(stripped.map(o => o.operator)).toEqual(["q", "g", "Q"]);

    // Filter removes content
    expect(filtered).toHaveLength(2);
    expect(filtered.map(o => o.operator)).toEqual(["q", "Q"]);
  });
});
