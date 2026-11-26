/**
 * missions.js — Mission Definitions, Objectives, 3D Target Rendering, and MissionEngine
 * ES Module for Stratos Courier Flight Game
 */

import { projectPoint, len } from './math3d.js';

export const MISSIONS = [
  {
    id: 'coastal_rings',
    name: 'Coastal Ring Run',
    brief: 'Navigate your aircraft through 5 glowing guidance rings along the scenic coastline and valley.',
    type: 'rings',
    targets: [
      { pos: [350, 40, 100], r: 45 },
      { pos: [0, 55, -250], r: 45 },
      { pos: [-500, 75, -600], r: 50 },
      { pos: [-1100, 95, -300], r: 50 },
      { pos: [-1600, 115, 200], r: 55 }
    ],
    timeLimit: 180,
    fuelLimit: 100,
    scoring: 'Time remaining + accuracy bonus'
  },
  {
    id: 'cargo_drop',
    name: 'Cargo Drop Delivery',
    brief: 'Fly low over the marked town drop zone (< 50m altitude) to deliver humanitarian cargo.',
    type: 'drop',
    targets: [
      { pos: [1500, 30, 250], r: 70 }
    ],
    timeLimit: 240,
    fuelLimit: 100,
    scoring: 'Successful drop precision & speed'
  },
  {
    id: 'airport_circuit',
    name: 'Airport Circuit & Land',
    brief: 'Take off from the runway, circle the bay waypoint, and land smoothly back at the airport.',
    type: 'land',
    targets: [
      { pos: [800, 150, -800], r: 90 },
      { pos: [850, 6, 0], r: 60 }
    ],
    timeLimit: 300,
    fuelLimit: 100,
    scoring: 'Smooth landing quality & circuit time'
  },
  {
    id: 'alpine_race',
    name: 'Alpine Checkpoint Race',
    brief: 'Speed through 4 high-altitude mountain check gates against the ticking clock.',
    type: 'race',
    targets: [
      { pos: [300, 160, 900], r: 45 },
      { pos: [-400, 200, 1500], r: 50 },
      { pos: [-1300, 230, 1300], r: 50 },
      { pos: [-2000, 190, 600], r: 55 }
    ],
    timeLimit: 150,
    fuelLimit: 100,
    scoring: 'Checkpoint speed & time left'
  },
  {
    id: 'mountain_rescue',
    name: 'Mountain Flare Rescue',
    brief: 'Locate and fly over the distress flare pickup site high in the northern peaks.',
    type: 'rescue',
    targets: [
      { pos: [-1200, 280, -2200], r: 70 }
    ],
    timeLimit: 360,
    fuelLimit: 100,
    scoring: 'Rescue time & survival bonus'
  }
];

export class MissionEngine {
  constructor() {
    this.currentMission = null;
    this.status = 'idle'; // 'idle' | 'active' | 'completed' | 'failed'
    this.currentTargetIndex = 0;
    this.timeLeft = 0;
    this.score = 0;
    this.progressText = '';
    this.flashAnim = 0;
  }

  start(mission) {
    this.currentMission = mission;
    this.status = 'active';
    this.currentTargetIndex = 0;
    this.timeLeft = mission.timeLimit || 300;
    this.score = 0;
    this.updateProgressText();
  }

  updateProgressText() {
    if (!this.currentMission) return;
    const total = this.currentMission.targets.length;
    const cur = this.currentTargetIndex + 1;
    if (this.status === 'completed') {
      this.progressText = 'Mission Accomplished!';
    } else if (this.status === 'failed') {
      this.progressText = 'Mission Failed';
    } else {
      if (this.currentMission.type === 'rings' || this.currentMission.type === 'race') {
        this.progressText = `Checkpoint ${Math.min(cur, total)} / ${total}`;
      } else if (this.currentMission.type === 'drop' || this.currentMission.type === 'rescue') {
        this.progressText = 'Proceed to Target Zone';
      } else if (this.currentMission.type === 'land') {
        if (this.currentTargetIndex === 0) {
          this.progressText = 'Fly to Bay Waypoint';
        } else {
          this.progressText = 'Return & Land on Runway';
        }
      }
    }
  }

  update(aircraft, dt, audio) {
    if (this.status !== 'active' || !this.currentMission) return;

    this.timeLeft -= dt;
    this.flashAnim += dt;

    if (this.timeLeft <= 0) {
      this.status = 'failed';
      this.progressText = 'Time Expired!';
      return;
    }

    if (aircraft.crashed) {
      this.status = 'failed';
      this.progressText = 'Aircraft Crashed!';
      return;
    }

    const targets = this.currentMission.targets;
    if (this.currentTargetIndex >= targets.length) return;

    const target = targets[this.currentTargetIndex];
    const dist = Math.hypot(
      target.pos[0] - aircraft.position[0],
      target.pos[1] - aircraft.position[1],
      target.pos[2] - aircraft.position[2]
    );

    let reached = false;
    if (this.currentMission.type === 'land' && this.currentTargetIndex === 1) {
      // Landing mission final phase: must touch down or land on runway near target
      if (aircraft.landed || (aircraft.onGround && Math.hypot(target.pos[0] - aircraft.position[0], target.pos[2] - aircraft.position[2]) < 150)) {
        reached = true;
      }
    } else if (this.currentMission.type === 'drop') {
      // Drop mission: low altitude over zone
      if (dist <= target.r && aircraft.position[1] - target.pos[1] < 60) {
        reached = true;
      }
    } else {
      if (dist <= target.r) {
        reached = true;
      }
    }

    if (reached) {
      if (audio && typeof audio.playRingChime === 'function') {
        audio.playRingChime();
      }
      this.currentTargetIndex++;
      if (this.currentTargetIndex >= targets.length) {
        this.status = 'completed';
        this.score = Math.round(this.timeLeft * 15 + aircraft.fuel * 5 + (100 - aircraft.damage));
        this.progressText = 'Mission Accomplished!';
      } else {
        this.updateProgressText();
      }
    }
  }

  getTarget() {
    return this.getTargetPosition();
  }

  getTargetPosition() {
    if (!this.currentMission || this.status !== 'active') return null;
    const targets = this.currentMission.targets;
    if (this.currentTargetIndex >= targets.length) return null;
    return targets[this.currentTargetIndex].pos;
  }

  draw(ctx, cam, w, h) {
    if (!this.currentMission || this.status !== 'active') return;
    const targets = this.currentMission.targets;
    if (this.currentTargetIndex >= targets.length) return;

    const target = targets[this.currentTargetIndex];
    const pos = target.pos;
    const r = target.r;

    const proj = projectPoint(pos, cam, w, h, Math.PI / 3);
    if (!proj.visible || proj.depth <= 0) return;

    const scaleFactor = Math.max(0.5, 400 / proj.depth);
    const radiusPx = r * scaleFactor;

    ctx.save();
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, radiusPx, 0, Math.PI * 2);

    const pulse = Math.sin(this.flashAnim * 6) * 0.2 + 0.8;
    ctx.strokeStyle = `rgba(255, 170, 0, ${pulse})`;
    ctx.lineWidth = Math.max(2, 4 * scaleFactor * 0.2);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 170, 0, ${0.15 * pulse})`;
    ctx.fill();

    // Draw inner crosshair or label
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.currentMission.type === 'drop' ? 'DROP ZONE' : `GATE ${this.currentTargetIndex + 1}`, proj.x, proj.y - radiusPx - 8);

    ctx.restore();
  }
}
