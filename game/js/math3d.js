/**
 * math3d.js — 3D Vector Math, Matrix Operations, Camera, and Projection Helpers
 * ES Module for Stratos Courier Flight Game
 */

/**
 * Adds two 3D vectors.
 * @param {number[]} a - [x, y, z]
 * @param {number[]} b - [x, y, z]
 * @returns {number[]} [x, y, z]
 */
export function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/**
 * Subtracts vector b from vector a.
 * @param {number[]} a - [x, y, z]
 * @param {number[]} b - [x, y, z]
 * @returns {number[]} [x, y, z]
 */
export function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/**
 * Scales a 3D vector by a scalar.
 * @param {number[]} v - [x, y, z]
 * @param {number} s - scalar
 * @returns {number[]} [x, y, z]
 */
export function scale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

/**
 * Computes the dot product of two 3D vectors.
 * @param {number[]} a - [x, y, z]
 * @param {number[]} b - [x, y, z]
 * @returns {number} dot product
 */
export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Computes the cross product of two 3D vectors.
 * @param {number[]} a - [x, y, z]
 * @param {number[]} b - [x, y, z]
 * @returns {number[]} [x, y, z]
 */
export function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

/**
 * Computes the Euclidean length (magnitude) of a 3D vector.
 * @param {number[]} v - [x, y, z]
 * @returns {number} length
 */
export function len(v) {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

/**
 * Returns the normalized (unit) vector of v.
 * @param {number[]} v - [x, y, z]
 * @returns {number[]} [x, y, z]
 */
export function norm(v) {
  const l = len(v);
  if (l === 0) return [0, 0, 0];
  return [v[0] / l, v[1] / l, v[2] / l];
}

/**
 * 4x4 Matrix operations & Camera / Projection
 */

/**
 * Creates an identity 4x4 matrix (column-major or row-major standard representation).
 * Represented as a flat Float32Array or Array of 16 numbers.
 * @returns {number[]} 16-element array
 */
export function mat4Identity() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}

/**
 * Multiplies two 4x4 matrices: out = a * b.
 * @param {number[]} a 
 * @param {number[]} b 
 * @returns {number[]} 16-element array
 */
export function mat4Multiply(a, b) {
  const out = new Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[i * 4 + j] =
        a[i * 4 + 0] * b[0 * 4 + j] +
        a[i * 4 + 1] * b[1 * 4 + j] +
        a[i * 4 + 2] * b[2 * 4 + j] +
        a[i * 4 + 3] * b[3 * 4 + j];
    }
  }
  return out;
}

/**
 * Transforms a 3D point (or vector with w=1) by a 4x4 matrix.
 * @param {number[]} m - 16-element 4x4 matrix
 * @param {number[]} p - [x, y, z]
 * @returns {number[]} [x', y', z']
 */
export function transformPoint(m, p) {
  const x = p[0], y = p[1], z = p[2];
  const rw = (m[3] * x + m[7] * y + m[11] * z + m[15]) || 1;
  const rx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / rw;
  const ry = (m[1] * x + m[5] * y + m[9] * z + m[13]) / rw;
  const rz = (m[2] * x + m[6] * y + m[10] * z + m[14]) / rw;
  return [rx, ry, rz];
}

/**
 * Builds a 4x4 camera view matrix (LookAt).
 * @param {number[]} eye - camera position [x, y, z]
 * @param {number[]} lookAt - target position [x, y, z]
 * @param {number[]} up - up vector [x, y, z]
 * @returns {number[]} 16-element 4x4 view matrix
 */
export function makeCamera(eye, lookAt, up) {
  const zaxis = norm(sub(eye, lookAt)); // Forward (camera looking down -Z)
  const xaxis = norm(cross(up, zaxis)); // Right
  const yaxis = cross(zaxis, xaxis);     // Up

  return [
    xaxis[0], yaxis[0], zaxis[0], 0,
    xaxis[1], yaxis[1], zaxis[1], 0,
    xaxis[2], yaxis[2], zaxis[2], 0,
    -dot(xaxis, eye), -dot(yaxis, eye), -dot(zaxis, eye), 1
  ];
}

/**
 * Projects a 3D point through the camera and perspective projection onto 2D screen space.
 * @param {number[]} p - 3D world point [x, y, z]
 * @param {number[]} cam - 4x4 camera view matrix (or transform)
 * @param {number} w - viewport width
 * @param {number} h - viewport height
 * @param {number} fov - field of view in radians
 * @returns {{x: number, y: number, depth: number, visible: boolean}}
 */
export function projectPoint(p, cam, w, h, fov) {
  // Transform world point to camera space
  const cp = transformPoint(cam, p);
  const depth = -cp[2]; // Distance in front of camera (+Z forward in camera space or -Z)

  // If behind or too close to camera near plane
  const visible = depth > 0.1;

  const fovFactor = 1 / Math.tan(fov * 0.5);
  const aspect = w / h;

  let sx = 0, sy = 0;
  if (visible) {
    const fovScaleY = (h * 0.5) * fovFactor;
    const fovScaleX = fovScaleY / aspect;
    sx = (w * 0.5) + (cp[0] / depth) * fovScaleX;
    sy = (h * 0.5) - (cp[1] / depth) * fovScaleY;
  }

  return {
    x: sx,
    y: sy,
    depth: depth,
    visible: visible && sx >= -w && sx <= w * 2 && sy >= -h && sy <= h * 2
  };
}

/**
 * Model matrix rotation helpers (4x4 rotation matrices).
 */

/**
 * Creates a 4x4 rotation matrix around the X axis.
 * @param {number} angle - radians
 * @returns {number[]} 16-element 4x4 matrix
 */
export function rotateX(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1
  ];
}

/**
 * Creates a 4x4 rotation matrix around the Y axis.
 * @param {number} angle - radians
 * @returns {number[]} 16-element 4x4 matrix
 */
export function rotateY(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1
  ];
}

/**
 * Creates a 4x4 rotation matrix around the Z axis.
 * @param {number} angle - radians
 * @returns {number[]} 16-element 4x4 matrix
 */
export function rotateZ(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    c, s, 0, 0,
    -s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}
