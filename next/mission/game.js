/* Dingsty Loop - deterministic simulation. No DOM, timers, or audio live here. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DingstyLoopLogic = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const W = 320, GROUND = 148, PLAYER_X = 66, PW = 24, PH = 30;
  const GRAVITY = 980, JUMP_VELOCITY = -355, FIXED_STEP = 1 / 120, GATE_TIMEOUT = 20, SQUASH_TIME = .14;
  const CODE = '0800';
  const SCENES = [
    { name: 'SZENE 1', sky: '#56a8e8', ground: '#e8cf83', obstacle: '#a87548', speed: 92, gateAt: 260, mix: ['box', 'box', 'token'] },
    { name: 'SZENE 2', sky: '#8bc3d9', ground: '#c9d58a', obstacle: '#7d9b87', speed: 108, gateAt: 310, mix: ['token', 'box', 'token', 'box'] },
    { name: 'SZENE 3', sky: '#3978bb', ground: '#d9b878', obstacle: '#80649a', speed: 124, gateAt: 360, mix: ['box', 'box', 'token', 'box'] }
  ];
  function seeded(seed) { let n = (seed >>> 0) || 1; return function () { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; }; }
  function make(seed) { return { seed: seed >>> 0, rand: seeded(seed), mode: 'play', phase: 'idle', scene: 0, laps: 0, lives: 3, score: 0, tokens: 0, distance: 0, player: { x: PLAYER_X, y: GROUND - PH, vy: 0, grounded: true, frame: 0 }, entities: [], spawnIn: .7, gate: null, codeProgress: '', events: [], hitLock: 0, tick: 0 }; }
  function emit(s, type, value) { s.events.push({ type, value: value == null ? null : value, tick: s.tick }); }
  function spawn(s, type, x) { const e = { type: type || 'box', x: x == null ? W + 18 : x, y: GROUND - 26, w: 26, h: 26, squashed: false }; if (e.type === 'token' || e.type === 'digit') { e.y = GROUND - 75; e.w = 16; e.h = 16; } s.entities.push(e); return e; }
  // A gate is a calm, one-target-at-a-time moment. The keypad remains available,
  // but the same code can be completed by jumping for the floating tiles.
  function spawnGateDigit(s) { s.entities = s.entities.filter(e => e.type !== 'digit'); const index = s.codeProgress.length, e = spawn(s, 'digit', W + 34); e.digit = CODE[index]; e.gateIndex = index; return e; }
  function rearmGate(s, reason, resetProgress) { if (resetProgress) s.codeProgress = ''; s.gate.elapsed = 0; s.gate.rearms++; spawnGateDigit(s); emit(s, reason || 'gate-rearm'); }
  function beginGate(s) { s.phase = 'gate'; s.gate = { code: CODE, opened: false, elapsed: 0, rearms: 0 }; s.codeProgress = ''; s.entities = s.entities.filter(e => e.type !== 'box'); spawnGateDigit(s); emit(s, 'gate'); }
  function nextScene(s) { s.scene = (s.scene + 1) % SCENES.length; if (s.scene === 0) { s.laps++; emit(s, 'loop'); } s.phase = 'running'; s.gate = null; s.codeProgress = ''; s.distance = 0; s.entities = []; s.spawnIn = .55; emit(s, 'scene', s.scene + 1); }
  function start(s) { if (s.phase === 'idle' || s.phase === 'over' || s.phase === 'stopped') { const mode = s.mode, fresh = make(s.seed); fresh.mode = mode === 'watch' ? 'watch' : 'play'; Object.keys(s).forEach(k => delete s[k]); Object.assign(s, fresh); s.phase = 'running'; emit(s, 'start'); } return s; }
  function digit(s, value) { if (s.phase !== 'gate') return false; const expected = CODE[s.codeProgress.length]; if (value !== expected) { rearmGate(s, 'wrong-digit', true); return false; } s.codeProgress += value; emit(s, 'digit', value); if (s.codeProgress === CODE) { s.gate.opened = true; emit(s, 'gate-open'); nextScene(s); } else spawnGateDigit(s); return true; }
  function jump(s) { if ((s.phase !== 'running' && s.phase !== 'gate') || !s.player.grounded) return false; s.player.vy = JUMP_VELOCITY; s.player.grounded = false; emit(s, 'jump'); return true; }
  function setMode(s, mode) { s.mode = mode === 'watch' ? 'watch' : 'play'; emit(s, 'mode', s.mode); return s; }
  function resetPlayer(s) { s.player.y = GROUND - PH; s.player.vy = 0; s.player.grounded = true; s.hitLock = .7; }
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function collide(s, e) { if (e.type === 'token') { s.tokens++; s.score += 5; e.popping = SQUASH_TIME; emit(s, 'pickup'); return; } if (e.type === 'digit') { e.dead = true; digit(s, e.digit); return; } if (s.phase === 'gate') return; const falling = s.player.vy > 35, fromAbove = s.player.y + PH - s.player.vy * FIXED_STEP <= e.y + 8; if (falling && fromAbove) { e.squashed = true; e.squashLeft = SQUASH_TIME; s.player.vy = -245; s.score += 10; s.tokens++; emit(s, 'stomp'); return; } if (s.hitLock <= 0) { s.lives--; emit(s, 'side-hit'); resetPlayer(s); if (s.lives <= 0) { s.phase = 'over'; emit(s, 'over'); } } }
  function step(s, dt) { if (!s || s.phase === 'idle' || s.phase === 'frozen' || s.phase === 'stopped' || s.phase === 'over') return s; let left = Math.max(0, Math.min(.1, Number(dt) || 0)); while (left > 0) { const d = Math.min(FIXED_STEP, left); left -= d; tick(s, d); } return s; }
  // Watch mode only consults simulation state. It never changes the play input path:
  // a grounded Dingsty jumps when the next target reaches its deterministic lead window.
  // At box height this lands on the falling half of the arc, so a stomp wins over a side hit.
  function autopilot(s, speed) { if (s.mode !== 'watch' || !s.player.grounded || (s.phase !== 'running' && s.phase !== 'gate')) return false; const target = s.entities.filter(e => !e.dead && !e.squashed && (e.type === 'box' || e.type === 'digit')).sort((a, b) => a.x - b.x)[0]; if (!target) return false; const collisionX = PLAYER_X + PW, lead = speed * (target.type === 'digit' ? .50 : .38); if (target.x >= collisionX && target.x <= collisionX + lead) return jump(s); return false; }
  function tick(s, dt) { s.tick++; s.player.frame += dt; s.hitLock = Math.max(0, s.hitLock - dt); const scene = SCENES[s.scene], speed = scene.speed + s.laps * 14; autopilot(s, speed); s.player.vy += GRAVITY * dt; s.player.y += s.player.vy * dt; if (s.player.y >= GROUND - PH) { s.player.y = GROUND - PH; s.player.vy = 0; s.player.grounded = true; } if (s.phase === 'running') { s.distance += speed * dt; s.spawnIn -= dt; if (s.spawnIn <= 0) { spawn(s, scene.mix[Math.floor(s.rand() * scene.mix.length)]); s.spawnIn = .95 + s.rand() * .75; } if (s.distance >= scene.gateAt) beginGate(s); } if (s.phase === 'gate') { s.gate.elapsed += dt; if (s.gate.elapsed >= GATE_TIMEOUT) rearmGate(s, 'gate-rearm', false); }
    for (const e of s.entities) { e.x -= speed * dt; if (e.squashLeft != null) { e.squashLeft -= dt; if (e.squashLeft <= 0) e.dead = true; continue; } if (e.popping != null) { e.popping -= dt; if (e.popping <= 0) e.dead = true; continue; } if (!e.dead && overlap({ x: s.player.x, y: s.player.y, w: PW, h: PH }, e)) collide(s, e); if (e.type === 'digit' && !e.dead && e.x + e.w < 0 && s.phase === 'gate') rearmGate(s, 'digit-missed', false); }
    s.entities = s.entities.filter(e => !e.dead && e.x + e.w > -20);
  }
  function meaningfulEvent(s) { const priority = ['over', 'gate-open', 'loop', 'side-hit', 'digit-missed', 'gate-rearm', 'wrong-digit', 'gate', 'stomp', 'pickup']; for (let i = s.events.length - 1; i >= 0; i--) if (priority.includes(s.events[i].type)) return s.events[i]; return null; }
  function freeze(s) { if (s.phase !== 'stopped' && s.phase !== 'frozen') { s.beforeFreeze = s.phase; s.phase = 'frozen'; emit(s, 'freeze'); } return s; }
  function resume(s) { if (s.phase === 'frozen') { s.phase = s.beforeFreeze || 'running'; delete s.beforeFreeze; emit(s, 'resume'); } return s; }
  function stop(s) { s.phase = 'stopped'; s.entities = []; emit(s, 'stop'); return s; }
  function snapshot(s) { return JSON.parse(JSON.stringify(s, (k, v) => k === 'rand' || k === 'events' || k === 'beforeFreeze' ? undefined : v)); }
  return { make, start, step, jump, digit, setMode, freeze, resume, stop, spawn, snapshot, meaningfulEvent, seeded, constants: { W, GROUND, PW, PH, FIXED_STEP, CODE, GATE_TIMEOUT, SQUASH_TIME, SCENES } };
});
