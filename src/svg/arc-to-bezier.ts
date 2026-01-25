/**
 * Arc to Bezier Conversion
 *
 * Converts SVG elliptical arc commands to cubic bezier curves.
 * SVG arcs use endpoint parameterization, which must be converted
 * to center parameterization before approximating with beziers.
 */

/**
 * Parameters for an elliptical arc in endpoint form.
 */
export interface ArcEndpoint {
  /** Starting X coordinate */
  x1: number;
  /** Starting Y coordinate */
  y1: number;
  /** X radius */
  rx: number;
  /** Y radius */
  ry: number;
  /** Rotation of the ellipse in degrees */
  xAxisRotation: number;
  /** If true, choose the larger arc (> 180 degrees) */
  largeArcFlag: boolean;
  /** If true, arc is drawn in positive angle direction */
  sweepFlag: boolean;
  /** Ending X coordinate */
  x2: number;
  /** Ending Y coordinate */
  y2: number;
}

/**
 * A cubic bezier curve segment.
 */
export interface BezierCurve {
  /** First control point X */
  cp1x: number;
  /** First control point Y */
  cp1y: number;
  /** Second control point X */
  cp2x: number;
  /** Second control point Y */
  cp2y: number;
  /** End point X */
  x: number;
  /** End point Y */
  y: number;
}

/**
 * Convert an SVG arc to one or more cubic bezier curves.
 *
 * Handles edge cases according to SVG spec:
 * - If rx=0 or ry=0, returns a line to the endpoint
 * - If start and end points are the same, returns empty array
 * - If radii are too small, they're scaled up automatically
 *
 * @param arc - Arc parameters in endpoint form
 * @returns Array of bezier curves that approximate the arc
 */
export function arcToBezier(arc: ArcEndpoint): BezierCurve[] {
  const { x1, y1, x2, y2, xAxisRotation, largeArcFlag, sweepFlag } = arc;

  let { rx, ry } = arc;

  // Handle edge case: same start and end point
  if (x1 === x2 && y1 === y2) {
    return [];
  }

  // Handle edge case: zero radius means line
  if (rx === 0 || ry === 0) {
    return [
      {
        cp1x: x1,
        cp1y: y1,
        cp2x: x2,
        cp2y: y2,
        x: x2,
        y: y2,
      },
    ];
  }

  // Ensure radii are positive
  rx = Math.abs(rx);
  ry = Math.abs(ry);

  // Convert rotation to radians
  const phi = (xAxisRotation * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: Compute (x1', y1') - transform to unit circle space
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // Step 2: Correct radii if they're too small
  // Per SVG spec, if the radii are too small to reach from start to end,
  // they should be scaled up uniformly
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);

  if (lambda > 1) {
    const sqrtLambda = Math.sqrt(lambda);

    rx = sqrtLambda * rx;
    ry = sqrtLambda * ry;
  }

  // Step 3: Compute center point (cx', cy') in transformed space
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const x1p2 = x1p * x1p;
  const y1p2 = y1p * y1p;

  let sq = (rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2) / (rx2 * y1p2 + ry2 * x1p2);

  if (sq < 0) {
    sq = 0;
  }

  const coef = (largeArcFlag === sweepFlag ? -1 : 1) * Math.sqrt(sq);
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;

  // Step 4: Compute center point (cx, cy) in original space
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const cx = cosPhi * cxp - sinPhi * cyp + midX;
  const cy = sinPhi * cxp + cosPhi * cyp + midY;

  // Step 5: Compute angles
  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;

  // Start angle
  const theta1 = angleBetween(1, 0, ux, uy);

  // Delta angle (arc extent)
  let dTheta = angleBetween(ux, uy, vx, vy);

  // Adjust delta angle based on sweep flag
  if (!sweepFlag && dTheta > 0) {
    dTheta -= 2 * Math.PI;
  }

  if (sweepFlag && dTheta < 0) {
    dTheta += 2 * Math.PI;
  }

  // Step 6: Split arc into segments and convert each to bezier
  // Use segments no larger than 90 degrees for good approximation
  const numSegments = Math.ceil(Math.abs(dTheta) / (Math.PI / 2));
  const segmentAngle = dTheta / numSegments;

  const curves: BezierCurve[] = [];
  let currentAngle = theta1;

  for (let i = 0; i < numSegments; i++) {
    const nextAngle = currentAngle + segmentAngle;
    const curve = arcSegmentToBezier(cx, cy, rx, ry, phi, currentAngle, nextAngle);

    curves.push(curve);

    currentAngle = nextAngle;
  }

  return curves;
}

/**
 * Compute the angle between two vectors.
 */
function angleBetween(ux: number, uy: number, vx: number, vy: number): number {
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  const dot = ux * vx + uy * vy;
  const magU = Math.sqrt(ux * ux + uy * uy);
  const magV = Math.sqrt(vx * vx + vy * vy);

  let cos = dot / (magU * magV);

  // Clamp to handle floating point errors
  if (cos < -1) {
    cos = -1;
  }

  if (cos > 1) {
    cos = 1;
  }

  return sign * Math.acos(cos);
}

/**
 * Convert a single arc segment (up to 90 degrees) to a cubic bezier.
 *
 * Uses the standard arc approximation formula:
 * For an arc of angle theta centered at origin:
 * CP1 = P0 + alpha * tangent at P0
 * CP2 = P1 - alpha * tangent at P1
 *
 * Where alpha = (4/3) * tan(theta/4)
 */
function arcSegmentToBezier(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  phi: number,
  theta1: number,
  theta2: number,
): BezierCurve {
  const dTheta = theta2 - theta1;

  // Compute alpha for bezier approximation
  const t = Math.tan(dTheta / 4);
  const alpha = (Math.sin(dTheta) * (Math.sqrt(4 + 3 * t * t) - 1)) / 3;

  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Start point on unit circle
  const cos1 = Math.cos(theta1);
  const sin1 = Math.sin(theta1);

  // End point on unit circle
  const cos2 = Math.cos(theta2);
  const sin2 = Math.sin(theta2);

  // Transform start point to original space
  const p0x = cx + cosPhi * rx * cos1 - sinPhi * ry * sin1;
  const p0y = cy + sinPhi * rx * cos1 + cosPhi * ry * sin1;

  // Transform end point to original space
  const p1x = cx + cosPhi * rx * cos2 - sinPhi * ry * sin2;
  const p1y = cy + sinPhi * rx * cos2 + cosPhi * ry * sin2;

  // Tangent at start (derivative of ellipse at theta1, rotated)
  const t0x = -cosPhi * rx * sin1 - sinPhi * ry * cos1;
  const t0y = -sinPhi * rx * sin1 + cosPhi * ry * cos1;

  // Tangent at end
  const t1x = -cosPhi * rx * sin2 - sinPhi * ry * cos2;
  const t1y = -sinPhi * rx * sin2 + cosPhi * ry * cos2;

  // Control points
  const cp1x = p0x + alpha * t0x;
  const cp1y = p0y + alpha * t0y;
  const cp2x = p1x - alpha * t1x;
  const cp2y = p1y - alpha * t1y;

  return {
    cp1x,
    cp1y,
    cp2x,
    cp2y,
    x: p1x,
    y: p1y,
  };
}
