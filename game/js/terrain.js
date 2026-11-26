/**
 * terrain.js — Deterministic heightmap, coastline, river, airport, town, and terrain rendering
 * ES Module for Stratos Courier Flight Game
 */

import { projectPoint, sub, cross, norm, dot, len } from './math3d.js';

/**
 * Seeded PRNG (Mulberry32) for deterministic world generation.
 */
function createSeededRandom(seed) {
  let s = seed | 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Value noise generator with smoothstep-interpolated octaves.
 */
function createValueNoise(seed) {
  const rng = createSeededRandom(seed);
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp;
  }

  function rawNoise(x, z) {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const xf = x - xi;
    const zf = z - zi;

    const smooth = t => t * t * (3 - 2 * t);
    const u = smooth(xf);
    const v = smooth(zf);

    const hash = (nx, nz) => {
      const idx = (perm[(nx & 255)] + (nz & 255)) & 255;
      const subRng = createSeededRandom(seed + idx * 73);
      return subRng();
    };

    const aa = hash(xi, zi);
    const ba = hash(xi + 1, zi);
    const ab = hash(xi, zi + 1);
    const bb = hash(xi + 1, zi + 1);

    const x1 = aa * (1 - u) + ba * u;
    const x2 = ab * (1 - u) + bb * u;
    return x1 * (1 - v) + x2 * v;
  }

  return function(x, z, octaves = 4, persistence = 0.5) {
    let total = 0;
    let frequency = 0.0008; // scale for 6000m world
    let amplitude = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      total += rawNoise(x * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    return total / maxValue;
  };
}

/**
 * Builds the 6000x6000m world terrain, features, runway, and town.
 * @param {number} seed 
 * @returns {Object} { height(x,z), colors, tiles, runway, buildings }
 */
export function buildTerrain(seed) {
  const noise = createValueNoise(seed);
  const rng = createSeededRandom(seed + 999);

  // Height function over 6000x6000m world (-3000 to +3000)
  function height(x, z) {
    // Base rolling hills and mountains
    let n = noise(x, z, 5, 0.5);
    let h = Math.pow(n, 1.3) * 220 - 25;

    // Coastline: West edge (x < -1200) slopes down into ocean (y < 0)
    const coastStart = -1000;
    if (x < coastStart) {
      const factor = Math.min(1, (coastStart - x) / 1200);
      h = h * (1 - factor) + (-30 * factor);
    }

    // River: Meandering along a curved path across the terrain
    const riverCenterZ = Math.sin(x * 0.001) * 600 - 400;
    const distToRiver = Math.abs(z - riverCenterZ);
    if (distToRiver < 120) {
      const riverDepth = Math.max(0, 1 - distToRiver / 120);
      h = h * (1 - riverDepth * 0.8) + (1.5 * riverDepth);
    }

    // Airport flat strip at world center-east: x in [300, 1300], z in [-80, 80]
    const apX1 = 300, apX2 = 1300;
    const apZ1 = -80, apZ2 = 80;
    if (x >= apX1 && x <= apX2 && z >= apZ1 && z <= apZ2) {
      // Smooth blend towards flat elevation y = 6
      const dx = Math.min(x - apX1, apX2 - x);
      const dz = Math.min(z - apZ1, apZ2 - z);
      const blendX = Math.min(1, dx / 80);
      const blendZ = Math.min(1, dz / 30);
      const blend = Math.min(blendX, blendZ);
      const flatH = 6.0;
      h = h * (1 - blend) + flatH * blend;
    }

    return h;
  }

  // Generate terrain grid quads (e.g., 60x60 grid over [-3000, 3000])
  const gridSize = 60;
  const worldMin = -3000;
  const worldMax = 3000;
  const step = (worldMax - worldMin) / gridSize;
  const tiles = [];

  for (let i = 0; i < gridSize; i++) {
    const x0 = worldMin + i * step;
    const x1 = x0 + step;
    for (let j = 0; j < gridSize; j++) {
      const z0 = worldMin + j * step;
      const z1 = z0 + step;

      const y0 = height(x0, z0);
      const y1 = height(x1, z0);
      const y2 = height(x1, z1);
      const y3 = height(x0, z1);

      const avgY = (y0 + y1 + y2 + y3) * 0.25;
      
      // Determine base color based on height and features (Sunset-friendly warm golden palette)
      let color = [95, 145, 65]; // rich warm valley green
      let isWater = false;

      if (avgY <= 0) {
        isWater = true;
        color = [45, 105, 170]; // sunset blue water
      } else if (avgY < 3) {
        color = [205, 185, 130]; // warm golden sandy beach
      } else if (avgY > 120) {
        // Mountain snow with sunset golden/pink glow
        const snowFactor = Math.min(1, (avgY - 120) / 80);
        color = [
          Math.floor(130 + snowFactor * 115),
          Math.floor(120 + snowFactor * 105),
          Math.floor(110 + snowFactor * 95)
        ];
      } else if (avgY > 70) {
        color = [125, 115, 100]; // warm grey-brown rocky slopes
      }

      tiles.push({
        pts: [
          [x0, y0, z0],
          [x1, y1, z0],
          [x1, y2, z1],
          [x0, y3, z1]
        ],
        center: [(x0 + x1) * 0.5, avgY, (z0 + z1) * 0.5],
        color,
        isWater
      });
    }
  }

  // Runway definition (900m long, heading 90 deg -> along X axis)
  const runway = {
    x1: 400,
    x2: 1300,
    z1: -30,
    z2: 30,
    y: 6.05
  };

  // Town blocks / buildings nearby airport (x in [1350, 1900], z in [-400, 400])
  const buildings = [];
  for (let bx = 1350; bx <= 1850; bx += 100) {
    for (let bz = -350; bz <= 350; bz += 100) {
      if (Math.abs(bz) < 70) continue; // Keep clear of airport approach
      const hx = bx + (rng() - 0.5) * 40;
      const hz = bz + (rng() - 0.5) * 40;
      const bw = 25 + rng() * 20;
      const bd = 25 + rng() * 20;
      const bh = 10 + rng() * 25;
      const by = height(hx, hz);

      buildings.push({
        x: hx,
        y: by,
        z: hz,
        w: bw,
        d: bd,
        h: bh,
        color: [
          Math.floor(160 + rng() * 40),
          Math.floor(140 + rng() * 40),
          Math.floor(120 + rng() * 40)
        ]
      });
    }
  }

  return {
    height,
    colors: {
      water: [40, 110, 180],
      runway: [50, 50, 55],
      runwayLines: [240, 240, 245]
    },
    tiles,
    runway,
    buildings
  };
}

/**
 * Draws terrain quads, water, runway, and town buildings back-to-front with lighting and distance fog.
 */
export function drawTerrain(ctx, cam, w, h, fogColor, sunDir, shotMode = null) {
  // If terrain was attached or cached on window/game state, or we rebuild/access it.
  // We can maintain a cached terrain instance or generate on the fly if needed.
  if (!window._cachedTerrain) {
    window._cachedTerrain = buildTerrain(42);
  }
  const terrain = window._cachedTerrain;

  // Gather all renderable primitives with their depth
  const renderList = [];

  const minAmbient = (shotMode === 3) ? 0.45 : 0.08;

  // 1. Terrain tiles
  for (let i = 0; i < terrain.tiles.length; i++) {
    const tile = terrain.tiles[i];
    // Compute face normal for sun shading
    const v0 = tile.pts[0];
    const v1 = tile.pts[1];
    const v2 = tile.pts[2];
    const edge1 = sub(v1, v0);
    const edge2 = sub(v2, v0);
    let normal = norm(cross(edge1, edge2));
    if (normal[1] < 0) normal = [-normal[0], -normal[1], -normal[2]]; // point up

    const ndot = Math.max(minAmbient, Math.pow(Math.max(0, dot(normal, sunDir)), 1.25));

    // Project center to find depth
    const projCenter = projectPoint(tile.center, cam, w, h, Math.PI / 3);
    if (!projCenter.visible && projCenter.depth < 0) continue;

    renderList.push({
      type: 'quad',
      pts: tile.pts,
      color: tile.color,
      ndot,
      depth: projCenter.depth,
      isWater: tile.isWater
    });
  }

  // 2. Runway surface
  const r = terrain.runway;
  const runwayPts = [
    [r.x1, r.y, r.z1],
    [r.x2, r.y, r.z1],
    [r.x2, r.y, r.z2],
    [r.x1, r.y, r.z2]
  ];
  const rCenter = [(r.x1 + r.x2) * 0.5, r.y, 0];
  const projR = projectPoint(rCenter, cam, w, h, Math.PI / 3);
  if (projR.visible || projR.depth > 0) {
    renderList.push({
      type: 'runway',
      pts: runwayPts,
      color: [55, 55, 60],
      depth: projR.depth
    });
  }

  // 3. Runway Centerline dashes & Threshold stripes
  // Centerline
  for (let x = r.x1 + 20; x < r.x2 - 20; x += 30) {
    const dashPts = [
      [x, r.y + 0.05, -2],
      [x + 15, r.y + 0.05, -2],
      [x + 15, r.y + 0.05, 2],
      [x, r.y + 0.05, 2]
    ];
    const dCenter = [x + 7.5, r.y + 0.05, 0];
    const pd = projectPoint(dCenter, cam, w, h, Math.PI / 3);
    if (pd.depth > 0) {
      renderList.push({
        type: 'runwayLine',
        pts: dashPts,
        color: [240, 240, 245],
        depth: pd.depth
      });
    }
  }

  // 4. Buildings (shaded boxes)
  for (let i = 0; i < terrain.buildings.length; i++) {
    const b = terrain.buildings[i];
    const pb = projectPoint([b.x, b.y, b.z], cam, w, h, Math.PI / 3);
    if (pb.depth < 0.5 || pb.depth > 3500) continue;

    const hw = b.w * 0.5;
    const hd = b.d * 0.5;
    const x1 = b.x - hw, x2 = b.x + hw;
    const z1 = b.z - hd, z2 = b.z + hd;
    const y0 = b.y;
    const y1 = b.y + b.h;

    // Building roof and walls simplified as quads or box faces
    const roofPts = [
      [x1, y1, z1],
      [x2, y1, z1],
      [x2, y1, z2],
      [x1, y1, z2]
    ];
    renderList.push({
      type: 'building',
      pts: roofPts,
      color: b.color,
      ndot: 0.9,
      depth: pb.depth
    });
  }

  // Sort renderList back-to-front (descending depth)
  renderList.sort((a, b) => b.depth - a.depth);

  // Render sorted items
  for (let i = 0; i < renderList.length; i++) {
    const item = renderList[i];
    const projectedPts = item.pts.map(p => projectPoint(p, cam, w, h, Math.PI / 3));

    // Check if all points are behind camera or invalid
    let allBehind = true;
    for (let p = 0; p < projectedPts.length; p++) {
      if (projectedPts[p].depth > 0) {
        allBehind = false;
        break;
      }
    }
    if (allBehind) continue;

    ctx.beginPath();
    let started = false;
    let visibleCount = 0;
    for (let p = 0; p < projectedPts.length; p++) {
      const pt = projectedPts[p];
      if (pt.depth > 0) {
        visibleCount++;
        if (!started) {
          ctx.moveTo(pt.x, pt.y);
          started = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      }
    }
    if (!started || visibleCount < 2) continue;
    ctx.closePath();

    // Color calculation with lighting & fog
    let r = item.color[0];
    let g = item.color[1];
    let b = item.color[2];

    if (item.ndot !== undefined) {
      r = Math.floor(r * item.ndot);
      g = Math.floor(g * item.ndot);
      b = Math.floor(b * item.ndot);
    }

    // Distance fog blending (richer atmospheric fog gradient)
    const avgDepth = item.depth;
    const fogFactor = Math.min(1, Math.max(0, Math.pow((avgDepth - 150) / 2800, 1.1)));
    r = Math.floor(r * (1 - fogFactor) + fogColor[0] * fogFactor);
    g = Math.floor(g * (1 - fogFactor) + fogColor[1] * fogFactor);
    b = Math.floor(b * (1 - fogFactor) + fogColor[2] * fogFactor);

    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fill();

    // Optional subtle outline for runway or buildings
    if (item.type === 'runway') {
      ctx.strokeStyle = 'rgba(100, 100, 110, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}
