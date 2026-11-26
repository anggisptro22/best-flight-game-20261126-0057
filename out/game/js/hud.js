/**
 * hud.js — Heads-Up Display (HUD) and Cockpit Instrument Panel
 * ES Module for Stratos Courier Flight Game
 */

import { projectPoint, len } from './math3d.js';

export class Hud {
  constructor() {
    this.flashTimer = 0;
  }

  draw(ctx, aircraft, mission, cam, w, h, view) {
    if (!aircraft) return;

    this.flashTimer += 0.05;
    const flashOn = Math.floor(this.flashTimer * 6) % 2 === 0;

    // Flight parameters
    const spdMs = len(aircraft.velocity);
    const knots = Math.round(spdMs * 1.94384);
    const altitudeFt = Math.round(aircraft.position[1] * 3.28084);
    const vSpeedFpm = Math.round(aircraft.velocity[1] * 196.85); // ft/min
    
    // Heading (0 - 360 deg)
    let headingDeg = Math.round((-aircraft.orientation.yaw * 180 / Math.PI) % 360);
    if (headingDeg < 0) headingDeg += 360;

    const throttlePct = Math.round(aircraft.throttle);
    const fuelPct = Math.max(0, Math.round(aircraft.fuel));
    const damagePct = Math.round(aircraft.damage);

    const isStall = !aircraft.onGround && knots < 35;
    const lowFuel = fuelPct <= 20;

    ctx.save();

    // 1. Center Crosshair
    this.drawCrosshair(ctx, w, h);

    // 2. Heading Tape (Top Center)
    this.drawHeadingTape(ctx, headingDeg, w);

    // 3. Airspeed Box & Needle (Top Left)
    this.drawAirspeed(ctx, knots, isStall && flashOn);

    // 4. Altitude Box & Needle (Top Right)
    this.drawAltitude(ctx, altitudeFt, w);

    // 5. Throttle, Fuel, and Damage Bars (Left / Bottom-Left)
    this.drawBars(ctx, throttlePct, fuelPct, damagePct, lowFuel && flashOn);

    // 6. Variometer (Vertical Speed) (Right side)
    this.drawVariometer(ctx, vSpeedFpm, w);

    // 7. Target Distance & Off-screen Target Arrow
    let targetPos = null;
    if (mission) {
      if (typeof mission.getTargetPosition === 'function') {
        targetPos = mission.getTargetPosition();
      } else if (mission.targetPos) {
        targetPos = mission.targetPos;
      }
    }

    if (targetPos) {
      this.drawTargetInfo(ctx, aircraft, targetPos, cam, w, h);
    }

    // 8. Stall Warning & Low Fuel Flashes
    if (isStall && flashOn) {
      this.drawWarning(ctx, "STALL WARNING", w, h * 0.3, "#ff3333");
    }
    if (lowFuel && flashOn) {
      this.drawWarning(ctx, "LOW FUEL", w, h * 0.37, "#ffaa00");
    }

    // 9. Cockpit View Instrument Panel
    if (view === 'cockpit') {
      this.drawCockpitPanel(ctx, aircraft, headingDeg, knots, altitudeFt, vSpeedFpm, throttlePct, fuelPct, w, h);
    }

    ctx.restore();
  }

  drawCrosshair(ctx, w, h) {
    const cx = w * 0.5;
    const cy = h * 0.5;
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy); ctx.lineTo(cx - 3, cy);
    ctx.moveTo(cx + 3, cy); ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy - 3);
    ctx.moveTo(cx, cy + 3); ctx.lineTo(cx, cy + 10);
    ctx.stroke();
  }

  drawHeadingTape(ctx, heading, w) {
    const tapeWidth = 300;
    const leftX = (w - tapeWidth) * 0.5;
    const topY = 15;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 20, 10, 0.6)';
    ctx.strokeStyle = 'rgba(0, 255, 180, 0.8)';
    ctx.lineWidth = 1;
    ctx.fillRect(leftX, topY, tapeWidth, 30);
    ctx.strokeRect(leftX, topY, tapeWidth, 30);

    ctx.beginPath();
    ctx.rect(leftX, topY, tapeWidth, 30);
    ctx.clip();

    ctx.fillStyle = '#00ffcc';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';

    const startHdg = Math.floor((heading - 45) / 10) * 10;
    const endHdg = startHdg + 90;

    for (let hDeg = startHdg; hDeg <= endHdg; hDeg += 10) {
      let normHdg = (hDeg + 360) % 360;
      const xOffset = (hDeg - heading) * (tapeWidth / 90);
      const tickX = (w * 0.5) + xOffset;

      if (tickX >= leftX && tickX <= leftX + tapeWidth) {
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tickX, topY + 22);
        ctx.lineTo(tickX, topY + 30);
        ctx.stroke();

        let label = normHdg.toString();
        if (normHdg === 0) label = 'N';
        else if (normHdg === 90) label = 'E';
        else if (normHdg === 180) label = 'S';
        else if (normHdg === 270) label = 'W';

        if (normHdg % 30 === 0 || ['N','E','S','W'].includes(label)) {
          ctx.fillText(label, tickX, topY + 16);
        }
      }
    }

    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.moveTo(w * 0.5, topY);
    ctx.lineTo(w * 0.5 - 5, topY - 6);
    ctx.lineTo(w * 0.5 + 5, topY - 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawAirspeed(ctx, knots, isStallAlert) {
    const x = 30, y = 80, boxW = 85, boxH = 55;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 20, 30, 0.75)';
    ctx.strokeStyle = isStallAlert ? '#ff3333' : 'rgba(0, 255, 180, 0.7)';
    ctx.lineWidth = isStallAlert ? 2 : 1;
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeRect(x, y, boxW, boxH);

    ctx.fillStyle = '#a0c0d0';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('IAS', x + 6, y + 15);

    ctx.fillStyle = isStallAlert ? '#ff3333' : '#00ffcc';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(knots.toString(), x + boxW - 10, y + 42);

    ctx.fillStyle = '#80a0b0';
    ctx.font = '9px monospace';
    ctx.fillText('KN', x + boxW - 10, y + 52);

    const cx = x + boxW + 25, cy = y + boxH * 0.5, r = 20;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 20, 30, 0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 255, 180, 0.7)';
    ctx.stroke();

    const angle = Math.PI * 0.75 + (Math.min(knots, 200) / 200) * Math.PI * 1.5;
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * (r - 4), cy + Math.sin(angle) * (r - 4));
    ctx.stroke();

    ctx.restore();
  }

  drawAltitude(ctx, altitudeFt, w) {
    const boxW = 85, boxH = 55;
    const posX = w - boxW - 30;
    const posY = 80;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 20, 30, 0.75)';
    ctx.strokeStyle = 'rgba(0, 255, 180, 0.7)';
    ctx.lineWidth = 1;
    ctx.fillRect(posX, posY, boxW, boxH);
    ctx.strokeRect(posX, posY, boxW, boxH);

    ctx.fillStyle = '#a0c0d0';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ALT', posX + 6, posY + 15);

    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(altitudeFt.toString(), posX + boxW - 10, posY + 42);

    ctx.fillStyle = '#80a0b0';
    ctx.font = '9px monospace';
    ctx.fillText('FT', posX + boxW - 10, posY + 52);

    const cx = posX - 25, cy = posY + boxH * 0.5, r = 20;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 20, 30, 0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 255, 180, 0.7)';
    ctx.stroke();

    const altAngle = Math.PI * 0.75 + (Math.min(Math.max(0, altitudeFt), 5000) / 5000) * Math.PI * 1.5;
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(altAngle) * (r - 4), cy + Math.sin(altAngle) * (r - 4));
    ctx.stroke();

    ctx.restore();
  }

  drawBars(ctx, throttle, fuel, damage, lowFuelAlert) {
    const x = 30;
    const y = 155;
    const barW = 110;
    const barH = 12;
    const gap = 20;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 255, 200, 0.4)';
    ctx.shadowBlur = 6;
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';

    const labels = [
      { label: `THR: ${throttle}%`, val: throttle / 100, color: '#00ffcc' },
      { label: `FUL: ${fuel}%`, val: fuel / 100, color: lowFuelAlert ? '#ff3333' : '#00aaee' },
      { label: `DMG: ${damage}%`, val: damage / 100, color: damage > 20 ? '#ff3333' : '#44cc44' }
    ];

    for (let i = 0; i < labels.length; i++) {
      const by = y + i * gap;
      ctx.fillStyle = '#a0c0d0';
      ctx.fillText(labels[i].label, x, by - 3);

      ctx.fillStyle = 'rgba(10, 20, 30, 0.75)';
      ctx.strokeStyle = 'rgba(0, 255, 180, 0.7)';
      ctx.fillRect(x, by, barW, barH);
      ctx.strokeRect(x, by, barW, barH);

      ctx.fillStyle = labels[i].color;
      ctx.fillRect(x + 1, by + 1, (barW - 2) * labels[i].val, barH - 2);
    }

    ctx.restore();
  }

  drawVariometer(ctx, vSpeedFpm, w) {
    const cx = w - 45;
    const cy = 160;
    const r = 25;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 20, 30, 0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 255, 180, 0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#00ffcc';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VSI', cx, cy - r - 4);

    const clamped = Math.max(-2000, Math.min(2000, vSpeedFpm));
    const angle = (clamped / 2000) * (Math.PI * 0.75);

    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(angle) * (r - 4), cy - Math.cos(angle) * (r - 4));
    ctx.stroke();

    ctx.restore();
  }

  drawTargetInfo(ctx, aircraft, targetPos, cam, w, h) {
    const distM = Math.hypot(
      targetPos[0] - aircraft.position[0],
      targetPos[1] - aircraft.position[1],
      targetPos[2] - aircraft.position[2]
    );
    const distFt = Math.round(distM * 3.28084);
    const distNm = (distM / 1852).toFixed(1);

    ctx.save();
    ctx.fillStyle = 'rgba(10, 20, 30, 0.75)';
    ctx.strokeStyle = 'rgba(255, 170, 0, 0.8)';
    ctx.lineWidth = 1;
    ctx.fillRect(w * 0.5 - 75, 55, 150, 24);
    ctx.strokeRect(w * 0.5 - 75, 55, 150, 24);

    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`TARGET: ${distNm} NM (${distFt} FT)`, w * 0.5, 71);

    const proj = projectPoint(targetPos, cam, w, h, Math.PI / 3);
    const margin = 40;

    if (proj.visible && proj.x >= margin && proj.x <= w - margin && proj.y >= margin && proj.y <= h - margin && proj.depth > 0) {
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffaa00';
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      let cx = proj.x;
      let cy = proj.y;

      if (!proj.visible || proj.depth <= 0) {
        cx = w - cx;
        cy = h - cy;
      }

      const dx = cx - w * 0.5;
      const dy = cy - h * 0.5;
      const angle = Math.atan2(dy, dx);

      const edgeX = Math.max(margin, Math.min(w - margin, (w * 0.5) + Math.cos(angle) * (w * 0.4)));
      const edgeY = Math.max(margin, Math.min(h - margin, (h * 0.5) + Math.sin(angle) * (h * 0.4)));

      ctx.save();
      ctx.translate(edgeX, edgeY);
      ctx.rotate(angle);
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-6, -8);
      ctx.lineTo(-6, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  drawWarning(ctx, text, w, yPos, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillText(text, w * 0.5, yPos);
    ctx.restore();
  }

  drawCockpitPanel(ctx, aircraft, heading, knots, altitude, vSpeed, throttle, fuel, w, h) {
    const panelH = 150;
    const panelY = h - panelH;

    ctx.save();
    ctx.fillStyle = 'rgba(12, 18, 24, 0.92)';
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.fillRect(0, panelY, w, panelH);
    ctx.strokeRect(0, panelY, w, panelH);

    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, panelY);
    ctx.lineTo(w, panelY);
    ctx.stroke();

    const ahX = w * 0.3;
    const ahY = panelY + panelH * 0.5;
    const ahR = 55;
    this.drawArtificialHorizon(ctx, ahX, ahY, ahR, aircraft.orientation.pitch, aircraft.orientation.roll);

    const compX = w * 0.7;
    const compY = panelY + panelH * 0.5;
    const compR = 55;
    this.drawCompassRose(ctx, compX, compY, compR, heading);

    this.drawEngineGauges(ctx, w * 0.08, panelY + 20, throttle, fuel);
    this.drawFlightGauges(ctx, w * 0.92, panelY + 20, knots, altitude, vSpeed);

    ctx.restore();
  }

  drawArtificialHorizon(ctx, cx, cy, r, pitch, roll) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#081018';
    ctx.fill();
    ctx.clip();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-roll);

    const pitchOffset = pitch * 40;

    ctx.fillStyle = '#006699';
    ctx.fillRect(-r * 2, -r * 2 + pitchOffset, r * 4, r * 2);

    ctx.fillStyle = '#664422';
    ctx.fillRect(-r * 2, pitchOffset, r * 4, r * 2);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 2, pitchOffset);
    ctx.lineTo(r * 2, pitchOffset);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1;
    for (let p = -2; p <= 2; p++) {
      if (p === 0) continue;
      const yL = pitchOffset + p * 15;
      const wL = p % 2 === 0 ? 20 : 10;
      ctx.beginPath();
      ctx.moveTo(-wL, yL);
      ctx.lineTo(wL, yL);
      ctx.stroke();
    }

    ctx.restore();

    ctx.strokeStyle = '#ffb000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy); ctx.lineTo(cx - 8, cy); ctx.lineTo(cx, cy + 6);
    ctx.moveTo(cx + 20, cy); ctx.lineTo(cx + 8, cy); ctx.lineTo(cx, cy + 6);
    ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy);
    ctx.stroke();

    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  drawCompassRose(ctx, cx, cy, r, heading) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#081018';
    ctx.fill();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-heading * Math.PI / 180);

    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const dirs = [
      { label: 'N', angle: 0, color: '#ff3333' },
      { label: '3', angle: 30, color: '#ffb000' },
      { label: '6', angle: 60, color: '#ffb000' },
      { label: 'E', angle: 90, color: '#00ffcc' },
      { label: '12', angle: 120, color: '#ffb000' },
      { label: '15', angle: 150, color: '#ffb000' },
      { label: 'S', angle: 180, color: '#ffb000' },
      { label: '21', angle: 210, color: '#ffb000' },
      { label: '24', angle: 240, color: '#ffb000' },
      { label: 'W', angle: 270, color: '#00ffcc' },
      { label: '30', angle: 300, color: '#ffb000' },
      { label: '33', angle: 330, color: '#ffb000' }
    ];

    for (let i = 0; i < dirs.length; i++) {
      const d = dirs[i];
      const rad = d.angle * Math.PI / 180;
      const dist = r - 14;
      const x = Math.sin(rad) * dist;
      const y = -Math.cos(rad) * dist;

      ctx.fillStyle = d.color;
      ctx.fillText(d.label, x, y);

      const innerDist = r - 5;
      const outerDist = r - 2;
      const x1 = Math.sin(rad) * innerDist;
      const y1 = -Math.cos(rad) * innerDist;
      const x2 = Math.sin(rad) * outerDist;
      const y2 = -Math.cos(rad) * outerDist;

      ctx.strokeStyle = d.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.restore();

    ctx.strokeStyle = '#ffb000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy - r + 6);
    ctx.stroke();

    ctx.restore();
  }

  drawEngineGauges(ctx, x, y, throttle, fuel) {
    ctx.save();
    ctx.fillStyle = '#00e5ff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ENGINE / FUEL', x, y);

    const gw = 130, gh = 8;
    
    ctx.fillStyle = '#ffb000';
    ctx.fillText(`RPM: ${Math.round(throttle * 24)} RPM`, x, y + 20);
    ctx.fillStyle = 'rgba(20, 30, 40, 0.9)';
    ctx.fillRect(x, y + 26, gw, gh);
    ctx.fillStyle = '#ffb000';
    ctx.fillRect(x, y + 26, gw * (throttle / 100), gh);
    ctx.strokeStyle = '#00e5ff';
    ctx.strokeRect(x, y + 26, gw, gh);

    ctx.fillStyle = '#00ffcc';
    ctx.fillText(`FUEL QTY: ${fuel}%`, x, y + 52);
    ctx.fillStyle = 'rgba(20, 30, 40, 0.9)';
    ctx.fillRect(x, y + 58, gw, gh);
    ctx.fillStyle = fuel <= 20 ? '#ff3333' : '#00ffcc';
    ctx.fillRect(x, y + 58, gw * (fuel / 100), gh);
    ctx.strokeStyle = '#00e5ff';
    ctx.strokeRect(x, y + 58, gw, gh);

    ctx.restore();
  }

  drawFlightGauges(ctx, x, y, knots, altitude, vSpeed) {
    ctx.save();
    ctx.fillStyle = '#00e5ff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('FLIGHT DATA', x, y);

    ctx.fillStyle = '#ffb000';
    ctx.fillText(`AIRSPEED: ${knots} KT`, x, y + 20);
    ctx.fillText(`ALTITUDE: ${altitude} FT`, x, y + 40);
    ctx.fillText(`V.SPEED: ${vSpeed} FPM`, x, y + 60);

    ctx.restore();
  }
}
