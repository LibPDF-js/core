import type { Operator } from "#src/content/operators";
import {
  drawCircleOps,
  drawEllipseOps,
  drawLineOps,
  drawRectangleOps,
} from "#src/drawing/operations";
import { grayscale, rgb } from "#src/helpers/colors";
import { describe, expect, it } from "vitest";

// Helper to check if operator matches
function findOp(ops: Operator[], opName: string): Operator | undefined {
  return ops.find(op => op.op === opName);
}

function countOps(ops: Operator[], opName: string): number {
  return ops.filter(op => op.op === opName).length;
}

describe("drawRectangleOps", () => {
  it("creates operators for simple filled rectangle", () => {
    const ops = drawRectangleOps({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      fillColor: rgb(1, 0, 0),
    });

    // Should have operators - check array is not empty
    expect(ops.length).toBeGreaterThan(0);

    // Should include graphics state push/pop
    expect(ops[0].op).toBe("q");
    expect(ops[ops.length - 1].op).toBe("Q");
  });

  it("creates operators for stroked rectangle", () => {
    const ops = drawRectangleOps({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      strokeColor: rgb(0, 0, 1),
      strokeWidth: 2,
    });

    // Should have line width operator
    const lwOp = findOp(ops, "w");
    expect(lwOp).toBeDefined();
    expect(lwOp!.operands).toEqual([2]);
  });

  it("creates operators for filled and stroked rectangle", () => {
    const ops = drawRectangleOps({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      fillColor: rgb(1, 0, 0),
      strokeColor: rgb(0, 0, 1),
    });

    // Should have fill-stroke operator 'B'
    const bOp = findOp(ops, "B");
    expect(bOp).toBeDefined();
  });

  it("handles grayscale colors", () => {
    const ops = drawRectangleOps({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      fillColor: grayscale(0.5),
    });

    // Should use 'g' operator for grayscale fill
    const gOp = findOp(ops, "g");
    expect(gOp).toBeDefined();
    expect(gOp!.operands).toEqual([0.5]);
  });

  it("handles rounded corners", () => {
    const ops = drawRectangleOps({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      fillColor: rgb(1, 0, 0),
      cornerRadius: 10,
    });

    // Rounded rectangles use curve-to operators
    expect(countOps(ops, "c")).toBe(4); // 4 corners
  });
});

describe("drawLineOps", () => {
  it("creates operators for line", () => {
    const ops = drawLineOps({
      startX: 0,
      startY: 0,
      endX: 100,
      endY: 100,
      color: rgb(0, 0, 0),
    });

    // Should have move-to operator
    const mOp = findOp(ops, "m");
    expect(mOp).toBeDefined();
    expect(mOp!.operands).toEqual([0, 0]);

    // Should have line-to operator
    const lOp = findOp(ops, "l");
    expect(lOp).toBeDefined();
    expect(lOp!.operands).toEqual([100, 100]);

    // Should have stroke operator
    const sOp = findOp(ops, "S");
    expect(sOp).toBeDefined();
  });

  it("respects line strokeWidth", () => {
    const ops = drawLineOps({
      startX: 0,
      startY: 0,
      endX: 100,
      endY: 100,
      strokeWidth: 3,
    });

    const wOp = findOp(ops, "w");
    expect(wOp).toBeDefined();
    expect(wOp!.operands).toEqual([3]);
  });

  it("handles dash arrays", () => {
    const ops = drawLineOps({
      startX: 0,
      startY: 0,
      endX: 100,
      endY: 100,
      dashArray: [5, 3],
      dashPhase: 2,
    });

    const dOp = findOp(ops, "d");
    expect(dOp).toBeDefined();
  });

  it("handles line cap styles", () => {
    const ops = drawLineOps({
      startX: 0,
      startY: 0,
      endX: 100,
      endY: 100,
      lineCap: "round",
    });

    // Line cap 'J' with value 1 for round
    const jOp = findOp(ops, "J");
    expect(jOp).toBeDefined();
    expect(jOp!.operands).toEqual([1]);
  });
});

describe("drawCircleOps", () => {
  it("creates operators for filled circle", () => {
    const ops = drawCircleOps({
      cx: 50,
      cy: 50,
      radius: 25,
      fillColor: rgb(0, 1, 0),
    });

    // Circle is drawn with Bezier curves
    // Should have move-to and curve-to operators
    const mOp = findOp(ops, "m");
    expect(mOp).toBeDefined();

    expect(countOps(ops, "c")).toBe(4); // 4 Bezier curves for circle

    // Should have fill operator
    const fOp = findOp(ops, "f");
    expect(fOp).toBeDefined();
  });

  it("creates operators for stroked circle", () => {
    const ops = drawCircleOps({
      cx: 50,
      cy: 50,
      radius: 25,
      strokeColor: rgb(0, 0, 1),
    });

    // Should have stroke operator
    const sOp = findOp(ops, "S");
    expect(sOp).toBeDefined();
  });
});

describe("drawEllipseOps", () => {
  it("creates operators for filled ellipse", () => {
    const ops = drawEllipseOps({
      cx: 50,
      cy: 50,
      rx: 40,
      ry: 20,
      fillColor: rgb(1, 1, 0),
    });

    // Ellipse is drawn with Bezier curves
    expect(countOps(ops, "c")).toBe(4); // 4 Bezier curves for ellipse

    // Should have fill operator
    const fOp = findOp(ops, "f");
    expect(fOp).toBeDefined();
  });

  it("handles different x and y radii", () => {
    const ops = drawEllipseOps({
      cx: 100,
      cy: 100,
      rx: 50,
      ry: 30,
      strokeColor: grayscale(0),
    });

    // The curve control points should reflect the different radii
    expect(countOps(ops, "c")).toBe(4); // 4 Bezier curves for ellipse
  });
});
