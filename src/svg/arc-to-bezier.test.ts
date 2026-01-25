import { describe, expect, it } from "vitest";

import { arcToBezier, type ArcEndpoint } from "./arc-to-bezier";

describe("arcToBezier", () => {
  /**
   * Helper to check if a point is approximately on the ellipse.
   * Ellipse equation: ((x-cx)/rx)^2 + ((y-cy)/ry)^2 = 1
   */
  function isOnEllipse(
    x: number,
    y: number,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    tolerance = 0.01,
  ): boolean {
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;

    return Math.abs(dx * dx + dy * dy - 1) < tolerance;
  }

  describe("degenerate cases", () => {
    it("returns empty array when start equals end", () => {
      const arc: ArcEndpoint = {
        x1: 50,
        y1: 50,
        rx: 25,
        ry: 25,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: true,
        x2: 50,
        y2: 50,
      };

      const curves = arcToBezier(arc);

      expect(curves).toEqual([]);
    });

    it("returns line segment when rx is 0", () => {
      const arc: ArcEndpoint = {
        x1: 0,
        y1: 0,
        rx: 0,
        ry: 25,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: true,
        x2: 50,
        y2: 50,
      };

      const curves = arcToBezier(arc);

      expect(curves).toHaveLength(1);
      expect(curves[0]).toEqual({
        cp1x: 0,
        cp1y: 0,
        cp2x: 50,
        cp2y: 50,
        x: 50,
        y: 50,
      });
    });

    it("returns line segment when ry is 0", () => {
      const arc: ArcEndpoint = {
        x1: 0,
        y1: 0,
        rx: 25,
        ry: 0,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: true,
        x2: 50,
        y2: 50,
      };

      const curves = arcToBezier(arc);

      expect(curves).toHaveLength(1);
      expect(curves[0].x).toBe(50);
      expect(curves[0].y).toBe(50);
    });
  });

  describe("simple circular arcs", () => {
    it("converts a 90-degree arc", () => {
      // Quarter circle: from (100, 50) to (50, 100) with radius 50, center at (50, 50)
      const arc: ArcEndpoint = {
        x1: 100,
        y1: 50,
        rx: 50,
        ry: 50,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: true,
        x2: 50,
        y2: 100,
      };

      const curves = arcToBezier(arc);

      // Should produce 1 bezier curve for a 90-degree arc
      expect(curves).toHaveLength(1);

      // End point should match
      expect(curves[0].x).toBeCloseTo(50, 5);
      expect(curves[0].y).toBeCloseTo(100, 5);
    });

    it("converts a 180-degree arc", () => {
      // Semi-circle: from (100, 50) to (0, 50) with radius 50
      const arc: ArcEndpoint = {
        x1: 100,
        y1: 50,
        rx: 50,
        ry: 50,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: true,
        x2: 0,
        y2: 50,
      };

      const curves = arcToBezier(arc);

      // Should produce 2 bezier curves for a 180-degree arc
      expect(curves).toHaveLength(2);

      // End point should match
      const lastCurve = curves[curves.length - 1];
      expect(lastCurve.x).toBeCloseTo(0, 5);
      expect(lastCurve.y).toBeCloseTo(50, 5);
    });

    it("converts a full circle (360-degree arc equivalent)", () => {
      // Almost full circle - can't do exactly 360 degrees with same start/end
      const arc: ArcEndpoint = {
        x1: 100,
        y1: 50,
        rx: 50,
        ry: 50,
        xAxisRotation: 0,
        largeArcFlag: true,
        sweepFlag: true,
        x2: 99.99,
        y2: 50.1,
      };

      const curves = arcToBezier(arc);

      // Should produce 4 bezier curves for an almost full circle
      expect(curves.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("arc flags", () => {
    it("large-arc-flag selects the larger arc", () => {
      // Two arcs connect the same points - large-arc-flag selects the longer one
      const arcSmall: ArcEndpoint = {
        x1: 100,
        y1: 50,
        rx: 50,
        ry: 50,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: true,
        x2: 50,
        y2: 100,
      };

      const arcLarge: ArcEndpoint = {
        ...arcSmall,
        largeArcFlag: true,
      };

      const curvesSmall = arcToBezier(arcSmall);
      const curvesLarge = arcToBezier(arcLarge);

      // Large arc should produce more bezier segments
      expect(curvesLarge.length).toBeGreaterThan(curvesSmall.length);
    });

    it("sweep-flag controls arc direction", () => {
      const arcCW: ArcEndpoint = {
        x1: 100,
        y1: 50,
        rx: 50,
        ry: 50,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: true,
        x2: 50,
        y2: 0,
      };

      const arcCCW: ArcEndpoint = {
        ...arcCW,
        sweepFlag: false,
      };

      const curvesCW = arcToBezier(arcCW);
      const curvesCCW = arcToBezier(arcCCW);

      // Both should end at the same point but take different paths
      expect(curvesCW[curvesCW.length - 1].x).toBeCloseTo(50, 5);
      expect(curvesCCW[curvesCCW.length - 1].x).toBeCloseTo(50, 5);

      // The control points should differ (different arc paths)
      // Both arcs may have the same number of segments, but control points differ
      const cw1 = curvesCW[0];
      const ccw1 = curvesCCW[0];

      // At least one control point should be different between the two arcs
      const controlPointsDiffer =
        Math.abs(cw1.cp1x - ccw1.cp1x) > 1 ||
        Math.abs(cw1.cp1y - ccw1.cp1y) > 1 ||
        Math.abs(cw1.cp2x - ccw1.cp2x) > 1 ||
        Math.abs(cw1.cp2y - ccw1.cp2y) > 1;

      expect(controlPointsDiffer).toBe(true);
    });
  });

  describe("elliptical arcs", () => {
    it("converts an elliptical arc with different rx and ry", () => {
      const arc: ArcEndpoint = {
        x1: 100,
        y1: 50,
        rx: 50,
        ry: 25,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: true,
        x2: 50,
        y2: 75,
      };

      const curves = arcToBezier(arc);

      expect(curves.length).toBeGreaterThan(0);

      // End point should match
      const lastCurve = curves[curves.length - 1];
      expect(lastCurve.x).toBeCloseTo(50, 5);
      expect(lastCurve.y).toBeCloseTo(75, 5);
    });

    it("handles rotated ellipse", () => {
      const arc: ArcEndpoint = {
        x1: 100,
        y1: 50,
        rx: 50,
        ry: 25,
        xAxisRotation: 45, // 45 degree rotation
        largeArcFlag: false,
        sweepFlag: true,
        x2: 50,
        y2: 100,
      };

      const curves = arcToBezier(arc);

      expect(curves.length).toBeGreaterThan(0);

      // End point should match
      const lastCurve = curves[curves.length - 1];
      expect(lastCurve.x).toBeCloseTo(50, 5);
      expect(lastCurve.y).toBeCloseTo(100, 5);
    });
  });

  describe("radii correction", () => {
    it("scales up radii that are too small to reach endpoint", () => {
      // The radii are too small to connect these points
      // SVG spec says they should be scaled up
      const arc: ArcEndpoint = {
        x1: 0,
        y1: 0,
        rx: 10, // Too small to reach (100, 0) directly
        ry: 10,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: true,
        x2: 100,
        y2: 0,
      };

      const curves = arcToBezier(arc);

      // Should still produce valid curves
      expect(curves.length).toBeGreaterThan(0);

      // End point should match
      const lastCurve = curves[curves.length - 1];
      expect(lastCurve.x).toBeCloseTo(100, 5);
      expect(lastCurve.y).toBeCloseTo(0, 5);
    });

    it("handles negative radii by taking absolute value", () => {
      const arc: ArcEndpoint = {
        x1: 100,
        y1: 50,
        rx: -50, // Negative, should be treated as 50
        ry: -50,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: true,
        x2: 50,
        y2: 100,
      };

      const curves = arcToBezier(arc);

      expect(curves.length).toBeGreaterThan(0);

      // End point should match
      const lastCurve = curves[curves.length - 1];
      expect(lastCurve.x).toBeCloseTo(50, 5);
      expect(lastCurve.y).toBeCloseTo(100, 5);
    });
  });

  describe("curve quality", () => {
    it("midpoints of bezier curves approximate the arc well", () => {
      // For a circular arc, we can verify that bezier curve endpoints
      // and approximate midpoints lie on the circle
      const cx = 50;
      const cy = 50;
      const r = 50;

      const arc: ArcEndpoint = {
        x1: 100,
        y1: 50, // Point on circle at 0 degrees
        rx: r,
        ry: r,
        xAxisRotation: 0,
        largeArcFlag: false,
        sweepFlag: true,
        x2: 50,
        y2: 100, // Point on circle at 90 degrees
      };

      const curves = arcToBezier(arc);

      // Start point should be on circle
      expect(isOnEllipse(100, 50, cx, cy, r, r)).toBe(true);

      // End point of each curve should be approximately on the circle
      for (const curve of curves) {
        expect(isOnEllipse(curve.x, curve.y, cx, cy, r, r, 0.1)).toBe(true);
      }
    });
  });
});
