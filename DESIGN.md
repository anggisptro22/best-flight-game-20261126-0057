# Stratos Courier — flight game design brief (for the coding agent)

Build a complete, original flight game as static files under game/. Vanilla JS + canvas 2D, no build step, no network. Playable with keyboard and mouse in desktop Chrome.

## Core
- Pseudo-3D renderer on canvas 2D: painter's-algorithm terrain (heightmap grid, green/olive valleys, grey peaks, water), fog to horizon haze color, sun-lit shading. Recognisable terrain: coastline on one side, river, small town blocks, airport strip.
- Chase camera behind the aircraft (also cockpit view toggle V: HUD instruments become a full panel overlay).
- Aircraft: own low-poly-ish drawing (fuselage, wings, tail, prop disc), drawn as a 3D wireframe+fill model transformed by camera matrix.
- Flight physics: lift from speed, stall below ~35 kn, drag, throttle 0-100% (W/S or Shift/Ctrl), pitch (Up/Down), roll+turn (Left/Right), gentle auto-level, ground roll on runway, takeoff at ~55 kn, landing when touching runway < 70 kn, crash otherwise (fire particles, message).
- HUD: airspeed (kn), altitude (ft), heading tape with N/E/S/W, throttle bar, fuel gauge, damage gauge, compass ribbon, variometer, next-target distance. Instruments look flown: needles, ticks, subtle needle jitter.
- Missions (5+): fly-through rings, cargo drop over a marked zone, land back at runway, race checkpoints with time, rescue flare pickup. Fuel limited: decisions matter; damage from hard landings/ground collision.
- Target ring / runway always visible ahead when relevant; off-screen arrow pointer.
- Sound: WebAudio engine hum pitched by throttle, stall warning beep, chime on ring pass (all synthesized, no assets).

## Files (each one clear job)
- game/index.html — shell, canvas, module script tags
- game/css/style.css
- game/js/math3d.js — vector/matrix 3D math + projection
- game/js/terrain.js — heightmap generation, terrain tile mesh, drawing
- game/js/aircraft.js — physics integration + aircraft model drawing
- game/js/hud.js — HUD and instruments
- game/js/missions.js — mission definitions, rings, scoring, messages
- game/js/input.js — keyboard/mouse handling
- game/js/audio.js — synthesized sound
- game/js/main.js — game loop, camera, state machine (menu/flying/ended)
- Menu screen with title "STRATOS COURIER", mission select, controls listing.

## Demo mode for screenshots
?shot=1..4 URL params: deterministic scenes — 1) chase view over coastline with ring ahead + HUD, 2) cockpit view with full instrument panel, 3) low pass over town at dawn palette, 4) landing approach to runway. Freeze simulation at a good moment.

## Constraints
- All references are files under game/ or data: URIs; no network, no eval.
- Split source cleanly, name files/functions for what they do.
