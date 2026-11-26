/**
 * main.js — Game Loop, Camera Systems, State Machine, and Bootstrap
 * ES Module for Stratos Courier Flight Game
 */

import { makeCamera, add, sub, scale, len, norm, rotateX, rotateY, rotateZ, mat4Multiply, transformPoint } from './math3d.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { buildTerrain, drawTerrain } from './terrain.js';
import { Aircraft } from './aircraft.js';
import { Hud } from './hud.js';
import { MISSIONS, MissionEngine } from './missions.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    
    this.input = new Input();
    this.audio = new Sfx();
    this.terrain = buildTerrain(42);
    // Attach terrain globally so terrain.js and aircraft collision can access it if needed
    window._cachedTerrain = this.terrain;

    this.aircraft = new Aircraft(500, 6.8, 0);
    this.hud = new Hud();
    this.missionEngine = new MissionEngine();

    this.state = 'menu'; // 'menu' | 'flying' | 'ended'
    this.view = 'chase';  // 'chase' | 'cockpit'
    this.currentMissionIndex = 0;

    this.shotMode = null;
    this.demoTime = 0;

    this.lastTime = performance.now();
    this.accumulator = 0;
    this.fixedTimeStep = 1 / 60;

    this.initDOM();
    this.initResize();
    this.checkUrlShot();
  }

  initDOM() {
    const menuScreen = document.getElementById('menu-screen');
    const endScreen = document.getElementById('end-screen');
    const missionListEl = document.getElementById('mission-list');
    const restartBtn = document.getElementById('restart-btn');
    const menuBtn = document.getElementById('menu-btn');

    // Populate mission select buttons
    MISSIONS.forEach((m, idx) => {
      const btn = document.createElement('button');
      btn.className = 'mission-btn';
      btn.innerHTML = `<span><strong>[${idx + 1}]</strong> ${m.name}</span> <span style="font-size:0.8rem; color:#80a0b0;">${m.timeLimit}s</span>`;
      btn.addEventListener('click', () => {
        this.audio.init();
        this.startMission(idx);
      });
      missionListEl.appendChild(btn);
    });

    restartBtn.addEventListener('click', () => {
      this.audio.init();
      this.startMission(this.currentMissionIndex);
    });

    menuBtn.addEventListener('click', () => {
      this.showMenu();
    });

    // Keyboard mission select (1-5) on menu screen
    window.addEventListener('keydown', (e) => {
      if (this.state === 'menu') {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= MISSIONS.length) {
          this.audio.init();
          this.startMission(num - 1);
        }
      }
    });
  }

  initResize() {
    const resize = () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();
  }

  checkUrlShot() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot) {
      const shotNum = parseInt(shot, 10);
      if (shotNum >= 1 && shotNum <= 4) {
        this.shotMode = shotNum;
        this.audio.init();
        this.setupShot(shotNum);
        this.state = 'flying';
        const menuScreen = document.getElementById('menu-screen');
        if (menuScreen) menuScreen.classList.add('hidden');
      }
    }
  }

  setupShot(num) {
    this.state = 'flying';
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('end-screen').classList.add('hidden');

    let missionIdx = 0;
    if (num === 1) missionIdx = 0;
    else if (num === 2) missionIdx = 1;
    else if (num === 3) {
      const dropMission = MISSIONS.find(m => m.type === 'drop');
      missionIdx = dropMission ? MISSIONS.indexOf(dropMission) : 1;
    }
    else if (num === 4) {
      const landMission = MISSIONS.find(m => m.type === 'land');
      missionIdx = landMission ? MISSIONS.indexOf(landMission) : 2;
    }

    this.currentMissionIndex = missionIdx;
    const mission = MISSIONS[missionIdx];
    this.missionEngine.start(mission);
    if (num === 4 && mission.type === 'land') {
      this.missionEngine.currentTargetIndex = 1;
    }

    let x = 0, z = 0, y = 0;
    let yaw = 0, pitch = 0, roll = 0;
    let throttle = 80;
    const speed = 55; // m/s

    const targetPos = this.missionEngine.getTarget() || [350, 40, 100];
    const r = this.terrain.runway || window._cachedTerrain.runway;

    if (num === 1) {
      // Shot 1: coastal ring run chase view with target ring ahead
      x = -200; z = -100;
      yaw = Math.atan2(targetPos[0] - x, targetPos[2] - z);
      pitch = 0.05; roll = 0.0;
      throttle = 80;
      this.view = 'chase';
      y = Math.max(this.terrain.height(x, z) + 35, 30);
    } else if (num === 2) {
      // Shot 2: cockpit view with instrument panel
      x = 1250; z = 250;
      yaw = Math.atan2(targetPos[0] - x, targetPos[2] - z);
      pitch = 0.0; roll = 0.0;
      throttle = 75;
      this.view = 'cockpit';
      y = Math.max(this.terrain.height(x, z) + 35, 30);
    } else if (num === 3) {
      // Shot 3: low pass over town at dawn palette with target ring straight ahead (~400m away, ~120m altitude)
      const t = this.missionEngine.getTarget() || [1500, 30, 250];
      x = t[0] - 400;
      z = t[2];
      y = 120;
      yaw = Math.atan2(t[0] - x, t[2] - z);
      pitch = -0.15; roll = 0.0;
      throttle = 90;
      this.view = 'chase';
    } else if (num === 4) {
      // Shot 4: landing approach ~700m before runway threshold at ~60m altitude above runway
      x = r.x1 - 700;
      z = (r.z1 + r.z2) / 2;
      y = r.y + 60;
      yaw = Math.atan2(r.x2 - r.x1, 0); // runway heading (+X)
      pitch = -0.03; roll = 0.0;
      throttle = 35;
      this.view = 'chase';
    }

    this.aircraft.position = [x, y, z];
    this.aircraft.orientation = { yaw, pitch, roll };

    const R = mat4Multiply(rotateY(yaw), mat4Multiply(rotateX(pitch), rotateZ(roll)));
    const forward = transformPoint(R, [0, 0, 1]);
    this.aircraft.velocity = scale(forward, speed);

    this.aircraft.throttle = throttle;
    this.aircraft.fuel = 100;
    this.aircraft.damage = 0;
    this.aircraft.onGround = false;
    this.aircraft.crashed = false;
    this.aircraft.landed = false;

    const up = transformPoint(R, [0, 1, 0]);
    const idealEye = add(sub(this.aircraft.position, scale(forward, 16)), scale(up, 4.5));
    this._lerpEye = [...idealEye];
  }

  showMenu() {
    this.state = 'menu';
    document.getElementById('menu-screen').classList.remove('hidden');
    document.getElementById('end-screen').classList.add('hidden');
  }

  startMission(index) {
    this.currentMissionIndex = index;
    const mission = MISSIONS[index];
    this.missionEngine.start(mission);

    // Reset aircraft on runway ready for takeoff
    this.aircraft = new Aircraft(450, 6.05, 0);
    this.aircraft.orientation = { yaw: Math.PI * 0.5, pitch: 0, roll: 0 };
    this.aircraft.throttle = 0;
    this.aircraft.fuel = 100;
    this.aircraft.damage = 0;
    this.aircraft.onGround = true;
    this.aircraft.crashed = false;
    this.aircraft.landed = false;

    this.state = 'flying';
    this.view = 'chase';

    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('end-screen').classList.add('hidden');
  }

  showEndScreen() {
    this.state = 'ended';
    const endScreen = document.getElementById('end-screen');
    const endTitle = document.getElementById('end-title');
    const endMessage = document.getElementById('end-message');
    const statScore = document.getElementById('stat-score');
    const statTime = document.getElementById('stat-time');
    const statFuel = document.getElementById('stat-fuel');

    const isSuccess = this.missionEngine.status === 'completed';
    endTitle.textContent = isSuccess ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED';
    endTitle.style.color = isSuccess ? '#00ffcc' : '#ff3333';
    endMessage.textContent = this.missionEngine.progressText;

    statScore.textContent = this.missionEngine.score;
    statTime.textContent = Math.max(0, Math.round(this.missionEngine.timeLeft));
    statFuel.textContent = Math.round(this.aircraft.fuel);

    endScreen.classList.remove('hidden');
  }

  run() {
    const loop = (timestamp) => {
      const dt = Math.min(0.1, (timestamp - this.lastTime) / 1000);
      this.lastTime = timestamp;

      this.update(dt);
      this.render();

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  update(dt) {
    // Check edge actions from input
    const action = this.input.consumeAction();
    if (action === 'view') {
      this.view = this.view === 'chase' ? 'cockpit' : 'chase';
    } else if (action === 'restart') {
      if (this.state === 'flying' || this.state === 'ended') {
        this.startMission(this.currentMissionIndex);
      }
    } else if (action === 'mute') {
      this.audio.toggleMute();
    }

    if (this.shotMode) {
      return;
    }

    if (this.state === 'flying') {
      // Fixed timestep updates for physics & simulation
      this.accumulator += dt;
      while (this.accumulator >= this.fixedTimeStep) {
        this.aircraft.update(this.fixedTimeStep, this.input, this.terrain);
        this.missionEngine.update(this.aircraft, this.fixedTimeStep, this.audio);
        this.accumulator -= this.fixedTimeStep;
      }

      this.audio.update(
        this.aircraft.throttle,
        !this.aircraft.onGround && len(this.aircraft.velocity) * 1.94384 < 35,
        this.aircraft.crashed
      );

      if (this.missionEngine.status === 'completed' || this.missionEngine.status === 'failed' || this.aircraft.crashed) {
        this.showEndScreen();
      }
    }
  }

  render() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.ctx.clearRect(0, 0, w, h);

    // Camera setup
    const yaw = this.aircraft.orientation.yaw;
    const pitch = this.aircraft.orientation.pitch;
    const roll = this.aircraft.orientation.roll;
    const R = mat4Multiply(rotateY(yaw), mat4Multiply(rotateX(pitch), rotateZ(roll)));
    const forward = transformPoint(R, [0, 0, 1]);
    const up = transformPoint(R, [0, 1, 0]);

    let eye, lookAt;
    if (this.view === 'chase') {
      // Chase camera: smooth follow behind aircraft, never fighting (lerp position, look-ahead)
      const idealEye = add(sub(this.aircraft.position, scale(forward, 16)), scale(up, 4.5));
      if (!this._lerpEye) this._lerpEye = [...idealEye];
      this._lerpEye[0] += (idealEye[0] - this._lerpEye[0]) * 0.15;
      this._lerpEye[1] += (idealEye[1] - this._lerpEye[1]) * 0.15;
      this._lerpEye[2] += (idealEye[2] - this._lerpEye[2]) * 0.15;

      eye = this._lerpEye;
      lookAt = add(this.aircraft.position, scale(forward, 15));
    } else {
      // Cockpit camera view
      eye = add(this.aircraft.position, add(scale(up, 0.7), scale(forward, 0.4)));
      lookAt = add(this.aircraft.position, scale(forward, 30));
    }

    const cam = makeCamera(eye, lookAt, [0, 1, 0]);

    // Atmosphere palette (Dawn/Warm fog for shot 3, normal otherwise)
    const fogColor = this.shotMode === 3 ? [235, 180, 140] : [180, 200, 220];
    const sunDir = this.shotMode === 3 ? [0.7, 0.5, 0.5] : [0.5, 0.7, 0.5];

    // Background sky gradient
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, h);
    if (this.shotMode === 3) {
      skyGrad.addColorStop(0, '#804050');
      skyGrad.addColorStop(0.5, '#e09070');
      skyGrad.addColorStop(1, '#f8d0b0');
    } else {
      skyGrad.addColorStop(0, '#284060');
      skyGrad.addColorStop(0.5, '#6080a0');
      skyGrad.addColorStop(1, '#b0c8e0');
    }
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, w, h);

    // Draw world terrain & features
    drawTerrain(this.ctx, cam, w, h, fogColor, sunDir, this.shotMode);

    // Draw aircraft (if chase view)
    if (this.view === 'chase') {
      this.aircraft.draw(this.ctx, cam, w, h, fogColor, sunDir);
    }

    // Draw 3D mission target ring / markers
    this.missionEngine.draw(this.ctx, cam, w, h);

    // Draw HUD & Instruments
    this.hud.draw(this.ctx, this.aircraft, this.missionEngine, cam, w, h, this.view);
  }
}

// Bootstrap on DOMContentLoaded, export nothing
document.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  window.__game = game;
  game.run();
});
