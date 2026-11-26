/**
 * aircraft.js — Aircraft physics, 3D model geometry, rendering, and helpers
 * ES Module for Stratos Courier Flight Game
 */

import { projectPoint, add, sub, scale, len, norm, dot, cross, rotateX, rotateY, rotateZ, mat4Multiply, transformPoint } from './math3d.js';

export class Aircraft {
  constructor(startX = 500, startY = 6.8, startZ = 0) {
    this.position = [startX, startY, startZ];
    this.velocity = [0, 0, 0]; // m/s
    this.orientation = {
      yaw: Math.PI * 0.5, // pointing along +X (towards runway)
      pitch: 0,
      roll: 0
    };
    this.throttle = 0; // 0 to 100%
    this.fuel = 100; // 0 to 100%
    this.damage = 0; // 0 to 100%
    this.onGround = true;
    this.crashed = false;
    this.landed = false;
    this.particles = [];
  }

  update(dt, input, world) {
    if (this.crashed) {
      this.updateParticles(dt);
      return;
    }

    // 1. Throttle control
    if (input && input.throttleDelta !== undefined) {
      this.throttle += input.throttleDelta * 30 * dt;
      this.throttle = Math.max(0, Math.min(100, this.throttle));
    }

    // Fuel consumption
    if (this.throttle > 0 && this.fuel > 0) {
      this.fuel -= (this.throttle / 100) * 0.05 * dt;
      this.fuel = Math.max(0, this.fuel);
    }
    const effectiveThrottle = (this.fuel <= 0) ? 0 : (this.throttle / 100);

    // 2. Rotation matrix & Local axes
    const yaw = this.orientation.yaw;
    const pitch = this.orientation.pitch;
    const roll = this.orientation.roll;

    const R = mat4Multiply(rotateY(yaw), mat4Multiply(rotateX(pitch), rotateZ(roll)));
    const forward = transformPoint(R, [0, 0, 1]);
    const up = transformPoint(R, [0, 1, 0]);

    // 3. Control inputs (Pitch & Roll)
    if (input) {
      const pitchInput = input.pitch || 0; // -1 up, +1 down
      const rollInput = input.roll || 0;   // -1 left, +1 right

      const spd = len(this.velocity);
      const controlFactor = Math.min(1.0, Math.max(0.2, spd / 25));

      // Pitch rate
      this.orientation.pitch -= pitchInput * 1.5 * controlFactor * dt;
      this.orientation.pitch = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, this.orientation.pitch));

      // Roll rate
      this.orientation.roll += rollInput * 2.5 * controlFactor * dt;
      this.orientation.roll = Math.max(-Math.PI * 0.8, Math.min(Math.PI * 0.8, this.orientation.roll));

      // Turn from roll (banking)
      const turnRate = -Math.sin(roll) * 1.2 * (spd / 25);
      this.orientation.yaw += turnRate * dt;

      // Auto-level tendency when sticks neutral (stronger at low speed)
      if (Math.abs(rollInput) < 0.01 && this.onGround === false) {
        const speedBoost = Math.min(2.5, Math.max(1.0, 30 / (spd + 1)));
        this.orientation.roll -= this.orientation.roll * (1.5 * speedBoost) * dt;
      }
    }

    // 4. Forces calculation
    const spd = len(this.velocity);
    const knots = spd * 1.94384;

    // Thrust vector
    const maxThrustAccel = 22.0; // m/s^2
    const thrustMag = effectiveThrottle * maxThrustAccel;
    const thrustForce = scale(forward, thrustMag);

    // Gravity
    const gravity = [0, -9.81, 0];

    // Lift & Stall (stall below ~35 knots ≈ 18 m/s)
    const stallSpeed = 18.0; // m/s (~35 knots)
    let liftMag = 0;
    if (!this.onGround) {
      if (spd < stallSpeed) {
        // Gentler stall behavior: gradual lift reduction and gentler nose drop
        const stallFactor = Math.max(0.35, spd / stallSpeed);
        liftMag = 0.5 * spd * spd * 0.035 * stallFactor;
        this.orientation.pitch += 0.35 * dt; // gentler stall nose drop
      } else {
        // Normal lift proportional to speed squared
        liftMag = 0.5 * spd * spd * 0.035;
      }
    }
    const liftForce = scale(up, liftMag);

    // Drag (quadratic)
    const dragCoeff = 0.0012;
    const dragMag = dragCoeff * spd * spd;
    const dragForce = scale(this.velocity, -dragMag);

    // Sum of accelerations
    let accel = add(add(thrustForce, gravity), add(liftForce, dragForce));

    if (this.onGround) {
      // Ground roll physics
      accel[1] = 0;
      this.velocity[0] *= 0.96;
      this.velocity[2] *= 0.96;

      const groundAccel = scale(forward, effectiveThrottle * 15.0);
      accel[0] += groundAccel[0];
      accel[2] += groundAccel[2];

      // Takeoff threshold (~55 kn ≈ 28 m/s)
      const takeoffSpeed = 28.0; // m/s (~55 knots)
      if (spd >= takeoffSpeed && (this.orientation.pitch < -0.05 || spd > 35.0)) {
        this.onGround = false;
        this.velocity[1] += 2.0;
      }
    }

    // Update velocity & position
    this.velocity = add(this.velocity, scale(accel, dt));
    this.position = add(this.position, scale(this.velocity, dt));

    // 5. Terrain & Runway Collision / Height check
    if (world && typeof world.height === 'function') {
      const terrainH = world.height(this.position[0], this.position[2]);
      let groundH = terrainH;
      let isRunway = false;

      if (world.runway) {
        const r = world.runway;
        const x = this.position[0];
        const z = this.position[2];
        if (x >= r.x1 - 10 && x <= r.x2 + 10 && z >= r.z1 - 15 && z <= r.z2 + 15) {
          groundH = r.y;
          isRunway = true;
        }
      }

      const aircraftRadius = 1.2;
      if (this.position[1] <= groundH + aircraftRadius) {
        const sinkRate = -this.velocity[1];
        const landingSpeed = knots;

        if (isRunway && landingSpeed < 70 && sinkRate < 4.0 && Math.abs(this.orientation.roll) < 0.3) {
          this.position[1] = groundH + aircraftRadius;
          this.onGround = true;
          this.velocity[1] = 0;
          this.orientation.pitch *= 0.9;
          this.orientation.roll *= 0.9;
          if (landingSpeed < 2 && effectiveThrottle === 0) {
            this.landed = true;
          }
        } else if (isRunway && (landingSpeed >= 70 || sinkRate >= 4.0)) {
          this.triggerCrash("Hard landing / Crash!");
        } else {
          this.triggerCrash("Terrain crash!");
        }
      }
    }

    if (Math.abs(this.position[0]) > 2950 || Math.abs(this.position[2]) > 2950 || this.position[1] < -20) {
      this.triggerCrash("Out of bounds crash!");
    }

    if (this.damage > 20 || this.crashed) {
      this.spawnParticle();
    }
    this.updateParticles(dt);
  }

  triggerCrash(reason) {
    if (this.crashed) return;
    this.crashed = true;
    this.damage = 100;
    this.velocity = [0, 0, 0];
    for (let i = 0; i < 30; i++) {
      this.spawnParticle(true);
    }
  }

  spawnParticle(isExplosion = false) {
    const offset = [
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2 + (isExplosion ? 0 : -0.5),
      (Math.random() - 0.5) * 2 - 1.5
    ];
    this.particles.push({
      pos: add(this.position, offset),
      vel: [
        (Math.random() - 0.5) * 5 + this.velocity[0] * 0.2,
        Math.random() * 6 + 2,
        (Math.random() - 0.5) * 5 + this.velocity[2] * 0.2
      ],
      life: 0,
      maxLife: 1.0 + Math.random() * 1.5,
      type: (isExplosion || Math.random() > 0.4) ? 'fire' : 'smoke'
    });
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.pos = add(p.pos, scale(p.vel, dt));
      p.vel[1] += 2.0 * dt;
    }
  }

  modelPoints() {
    return {
      fuselage: [
        [0, 0.6, 3.2],
        [0.8, 0, 1.2],
        [0, -0.7, 1.5],
        [-0.8, 0, 1.2],
        [0.9, 0.3, -2.5],
        [-0.9, 0.3, -2.5],
        [0, 0.8, -2.8]
      ],
      wings: [
        [-5.5, 0.1, 0.5],
        [5.5, 0.1, 0.5],
        [5.0, -0.1, -0.5],
        [-5.0, -0.1, -0.5]
      ],
      tailFin: [
        [0, 0.5, -2.5],
        [0, 2.2, -3.2],
        [0, 0.3, -3.5]
      ],
      stabilizer: [
        [-2.0, 0.4, -3.0],
        [2.0, 0.4, -3.0],
        [0, 0.4, -3.5]
      ],
      propDisc: [
        [0, 0.6, 3.3],
        [1.2, 1.8, 3.3],
        [-1.2, 1.8, 3.3],
        [-1.2, -0.6, 3.3],
        [1.2, -0.6, 3.3]
      ],
      cockpit: [
        [0, 1.1, 0.8],
        [0.6, 0.5, 0.2],
        [-0.6, 0.5, 0.2],
        [0, 0.5, -1.0]
      ]
    };
  }

  draw(ctx, cam, w, h, fogColor = [180, 200, 220], sunDir = [0.5, 0.7, 0.5]) {
    const yaw = this.orientation.yaw;
    const pitch = this.orientation.pitch;
    const roll = this.orientation.roll;

    const R = mat4Multiply(rotateY(yaw), mat4Multiply(rotateX(pitch), rotateZ(roll)));

    const parts = this.modelPoints();
    const transformPart = pts => pts.map(p => {
      const worldPt = add(this.position, transformPoint(R, p));
      return projectPoint(worldPt, cam, w, h, Math.PI / 3);
    });

    const renderParts = [
      { name: 'fuselage', pts: transformPart(parts.fuselage), color: [220, 225, 230] },
      { name: 'wings', pts: transformPart(parts.wings), color: [200, 205, 215] },
      { name: 'tailFin', pts: transformPart(parts.tailFin), color: [210, 60, 60] },
      { name: 'stabilizer', pts: transformPart(parts.stabilizer), color: [200, 205, 215] },
      { name: 'cockpit', pts: transformPart(parts.cockpit), color: [80, 110, 140] },
      { name: 'propDisc', pts: transformPart(parts.propDisc), color: [100, 100, 100] }
    ];

    for (let i = 0; i < renderParts.length; i++) {
      const pArr = renderParts[i].pts;
      let sumDepth = 0;
      let validCount = 0;
      for (let j = 0; j < pArr.length; j++) {
        if (pArr[j].depth > 0) {
          sumDepth += pArr[j].depth;
          validCount++;
        }
      }
      renderParts[i].depth = validCount > 0 ? sumDepth / validCount : -1;
    }

    renderParts.sort((a, b) => b.depth - a.depth);

    if (this.position[1] < 200) {
      const shadowProj = projectPoint([this.position[0], 0, this.position[2]], cam, w, h, Math.PI / 3);
      if (shadowProj.depth > 0) {
        const sz = Math.max(2, 40 / (shadowProj.depth * 0.5));
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(shadowProj.x, shadowProj.y, sz * 1.5, sz * 0.7, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();
        ctx.restore();
      }
    }

    for (let i = 0; i < renderParts.length; i++) {
      const part = renderParts[i];
      if (part.depth < 0) continue;

      const pts = part.pts;
      let visible = false;
      ctx.beginPath();
      let started = false;
      for (let j = 0; j < pts.length; j++) {
        if (pts[j].depth > 0) {
          if (!started) {
            ctx.moveTo(pts[j].x, pts[j].y);
            started = true;
          } else {
            ctx.lineTo(pts[j].x, pts[j].y);
          }
          visible = true;
        }
      }
      if (!started || !visible) continue;
      ctx.closePath();

      const col = part.color;
      ctx.fillStyle = `rgb(${col[0]}, ${col[1]}, ${col[2]})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(40, 45, 50, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const proj = projectPoint(p.pos, cam, w, h, Math.PI / 3);
      if (!proj.visible || proj.depth <= 0) continue;

      const size = Math.max(2, 30 / proj.depth * (1 + p.life / p.maxLife));
      const alpha = Math.max(0, 1 - p.life / p.maxLife);

      ctx.save();
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, size, 0, Math.PI * 2);
      if (p.type === 'fire') {
        ctx.fillStyle = `rgba(255, 120, 20, ${alpha})`;
      } else {
        ctx.fillStyle = `rgba(100, 100, 100, ${alpha * 0.7})`;
      }
      ctx.fill();
      ctx.restore();
    }
  }
}

export function isAirborne(aircraft) {
  return aircraft && !aircraft.onGround && !aircraft.crashed;
}

export function isOnRunway(aircraft, world) {
  if (!aircraft || !world || !world.runway) return false;
  const r = world.runway;
  const x = aircraft.position[0];
  const z = aircraft.position[2];
  const y = aircraft.position[1];
  return (
    x >= r.x1 && x <= r.x2 &&
    z >= r.z1 && z <= r.z2 &&
    Math.abs(y - r.y) < 3.0
  );
}

export function checkTakeoff(aircraft) {
  return aircraft && !aircraft.onGround && aircraft.position[1] > 15;
}

export function checkLanding(aircraft, world) {
  return aircraft && aircraft.landed && isOnRunway(aircraft, world);
}
