import { describe, expect, it } from "vitest";

import { Matrix } from "./matrix";

describe("Matrix", () => {
  describe("identity", () => {
    it("creates identity matrix", () => {
      const m = Matrix.identity();

      expect(m.a).toBe(1);
      expect(m.b).toBe(0);
      expect(m.c).toBe(0);
      expect(m.d).toBe(1);
      expect(m.e).toBe(0);
      expect(m.f).toBe(0);
    });

    it("identity is detected", () => {
      const m = Matrix.identity();

      expect(m.isIdentity()).toBe(true);
    });
  });

  describe("fromArray", () => {
    it("creates matrix from array", () => {
      const m = Matrix.fromArray([2, 0, 0, 3, 10, 20]);

      expect(m.a).toBe(2);
      expect(m.b).toBe(0);
      expect(m.c).toBe(0);
      expect(m.d).toBe(3);
      expect(m.e).toBe(10);
      expect(m.f).toBe(20);
    });

    it("throws on wrong array length", () => {
      expect(() => Matrix.fromArray([1, 2, 3])).toThrow();
    });
  });

  describe("translate", () => {
    it("creates translation matrix", () => {
      const m = Matrix.translate(100, 200);

      expect(m.a).toBe(1);
      expect(m.b).toBe(0);
      expect(m.c).toBe(0);
      expect(m.d).toBe(1);
      expect(m.e).toBe(100);
      expect(m.f).toBe(200);
    });
  });

  describe("scale", () => {
    it("creates scale matrix", () => {
      const m = Matrix.scale(2, 3);

      expect(m.a).toBe(2);
      expect(m.b).toBe(0);
      expect(m.c).toBe(0);
      expect(m.d).toBe(3);
      expect(m.e).toBe(0);
      expect(m.f).toBe(0);
    });
  });

  describe("rotate", () => {
    it("creates rotation matrix for 90 degrees", () => {
      const m = Matrix.rotate(Math.PI / 2);

      expect(m.a).toBeCloseTo(0);
      expect(m.b).toBeCloseTo(1);
      expect(m.c).toBeCloseTo(-1);
      expect(m.d).toBeCloseTo(0);
    });
  });

  describe("multiply", () => {
    it("multiplies two matrices", () => {
      const m1 = Matrix.scale(2, 2);
      const m2 = Matrix.translate(10, 10);
      const result = m1.multiply(m2);

      // Scale then translate: point (0,0) -> (0,0) -> (10,10)
      // But in matrix multiplication order, m1.multiply(m2) means m1 * m2
      // which applies m2 first, then m1
      const point = result.transformPoint(0, 0);

      expect(point.x).toBe(10);
      expect(point.y).toBe(10);
    });
  });

  describe("transformPoint", () => {
    it("transforms point with translation", () => {
      const m = Matrix.translate(100, 200);
      const point = m.transformPoint(10, 20);

      expect(point.x).toBe(110);
      expect(point.y).toBe(220);
    });

    it("transforms point with scale", () => {
      const m = Matrix.scale(2, 3);
      const point = m.transformPoint(10, 20);

      expect(point.x).toBe(20);
      expect(point.y).toBe(60);
    });

    it("transforms point with combined transform", () => {
      // Scale by 2, then translate by (100, 200)
      const m = new Matrix(2, 0, 0, 2, 100, 200);
      const point = m.transformPoint(10, 20);

      expect(point.x).toBe(120); // 2*10 + 100
      expect(point.y).toBe(240); // 2*20 + 200
    });
  });

  describe("transformDistance", () => {
    it("transforms distance without translation", () => {
      const m = new Matrix(2, 0, 0, 3, 100, 200);
      const dist = m.transformDistance(10, 20);

      expect(dist.dx).toBe(20); // 2*10
      expect(dist.dy).toBe(60); // 3*20
    });
  });

  describe("getScaleX/Y", () => {
    it("returns scale factors", () => {
      const m = Matrix.scale(2, 3);

      expect(m.getScaleX()).toBe(2);
      expect(m.getScaleY()).toBe(3);
    });

    it("handles rotated matrix", () => {
      const m = Matrix.rotate(Math.PI / 4).scale(2, 2);

      // After rotation, the scale should still be extractable
      expect(m.getScaleX()).toBeCloseTo(2);
      expect(m.getScaleY()).toBeCloseTo(2);
    });
  });

  describe("clone", () => {
    it("creates an identical copy", () => {
      const m = new Matrix(1, 2, 3, 4, 5, 6);
      const copy = m.clone();

      expect(copy.a).toBe(1);
      expect(copy.b).toBe(2);
      expect(copy.c).toBe(3);
      expect(copy.d).toBe(4);
      expect(copy.e).toBe(5);
      expect(copy.f).toBe(6);
    });
  });

  describe("toArray", () => {
    it("returns array representation", () => {
      const m = new Matrix(1, 2, 3, 4, 5, 6);
      const arr = m.toArray();

      expect(arr).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });
});
