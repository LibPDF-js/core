/**
 * 2D transformation matrix for PDF coordinate transformations.
 *
 * PDF uses a 3x3 transformation matrix represented as [a b c d e f]
 * which corresponds to the matrix:
 *
 * | a  b  0 |
 * | c  d  0 |
 * | e  f  1 |
 *
 * This is used for both the CTM (Current Transformation Matrix) and
 * text matrices (Tm/Tlm).
 */

/** biome-ignore-all lint/suspicious/useAdjacentOverloadSignatures: biome is whiffing */

export class Matrix {
  constructor(
    public readonly a: number,
    public readonly b: number,
    public readonly c: number,
    public readonly d: number,
    public readonly e: number,
    public readonly f: number,
  ) {}

  /**
   * Create an identity matrix.
   */
  static identity(): Matrix {
    return new Matrix(1, 0, 0, 1, 0, 0);
  }

  /**
   * Create a matrix from an array of 6 numbers.
   */
  static fromArray(arr: number[]): Matrix {
    if (arr.length !== 6) {
      throw new Error(`Matrix requires 6 elements, got ${arr.length}`);
    }

    return new Matrix(arr[0], arr[1], arr[2], arr[3], arr[4], arr[5]);
  }

  /**
   * Create a translation matrix.
   */
  static translate(tx: number, ty: number): Matrix {
    return new Matrix(1, 0, 0, 1, tx, ty);
  }

  /**
   * Create a scaling matrix.
   */
  static scale(sx: number, sy: number): Matrix {
    return new Matrix(sx, 0, 0, sy, 0, 0);
  }

  /**
   * Create a rotation matrix (angle in radians).
   */
  static rotate(angle: number): Matrix {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return new Matrix(cos, sin, -sin, cos, 0, 0);
  }

  /**
   * Multiply this matrix by another: this × other.
   *
   * Matrix multiplication is done as:
   * | a1 b1 0 |   | a2 b2 0 |
   * | c1 d1 0 | × | c2 d2 0 |
   * | e1 f1 1 |   | e2 f2 1 |
   */
  multiply(other: Matrix): Matrix {
    return new Matrix(
      this.a * other.a + this.b * other.c,
      this.a * other.b + this.b * other.d,
      this.c * other.a + this.d * other.c,
      this.c * other.b + this.d * other.d,
      this.e * other.a + this.f * other.c + other.e,
      this.e * other.b + this.f * other.d + other.f,
    );
  }

  /**
   * Apply a translation to this matrix.
   */
  translate(tx: number, ty: number): Matrix {
    return new Matrix(
      this.a,
      this.b,
      this.c,
      this.d,
      this.a * tx + this.c * ty + this.e,
      this.b * tx + this.d * ty + this.f,
    );
  }

  /**
   * Apply scaling to this matrix.
   */
  scale(sx: number, sy: number): Matrix {
    return new Matrix(this.a * sx, this.b * sx, this.c * sy, this.d * sy, this.e, this.f);
  }

  /**
   * Apply rotation to this matrix (angle in radians).
   */
  rotate(angle: number): Matrix {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return new Matrix(
      this.a * cos + this.b * -sin,
      this.a * sin + this.b * cos,
      this.c * cos + this.d * -sin,
      this.c * sin + this.d * cos,
      this.e,
      this.f,
    );
  }

  /**
   * Transform a point using this matrix.
   *
   * x' = a*x + c*y + e
   * y' = b*x + d*y + f
   */
  transformPoint(x: number, y: number): { x: number; y: number } {
    return {
      x: this.a * x + this.c * y + this.e,
      y: this.b * x + this.d * y + this.f,
    };
  }

  /**
   * Transform a distance (vector) using this matrix.
   * Unlike transformPoint, this doesn't include the translation component.
   *
   * dx' = a*dx + c*dy
   * dy' = b*dx + d*dy
   */
  transformDistance(dx: number, dy: number): { dx: number; dy: number } {
    return {
      dx: this.a * dx + this.c * dy,
      dy: this.b * dx + this.d * dy,
    };
  }

  /**
   * Get the horizontal scaling factor.
   * This is sqrt(a² + b²).
   */
  getScaleX(): number {
    return Math.sqrt(this.a * this.a + this.b * this.b);
  }

  /**
   * Get the vertical scaling factor.
   * This is sqrt(c² + d²).
   */
  getScaleY(): number {
    return Math.sqrt(this.c * this.c + this.d * this.d);
  }

  /**
   * Get the rotation angle in radians.
   */
  getRotation(): number {
    return Math.atan2(this.b, this.a);
  }

  /**
   * Clone this matrix.
   */
  clone(): Matrix {
    return new Matrix(this.a, this.b, this.c, this.d, this.e, this.f);
  }

  /**
   * Check if this is approximately an identity matrix.
   */
  isIdentity(tolerance = 1e-6): boolean {
    return (
      Math.abs(this.a - 1) < tolerance &&
      Math.abs(this.b) < tolerance &&
      Math.abs(this.c) < tolerance &&
      Math.abs(this.d - 1) < tolerance &&
      Math.abs(this.e) < tolerance &&
      Math.abs(this.f) < tolerance
    );
  }

  /**
   * Convert to array format [a, b, c, d, e, f].
   */
  toArray(): [number, number, number, number, number, number] {
    return [this.a, this.b, this.c, this.d, this.e, this.f];
  }

  toString(): string {
    return `Matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
  }
}
