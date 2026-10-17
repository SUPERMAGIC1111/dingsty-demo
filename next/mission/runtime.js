/* Browser adapter. Its lifecycle is deliberately testable with a stub DOM. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DingstyLoopRuntime = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  function mount(deps) {
    deps = deps || {};
    const win = deps.window || window, doc = deps.document || document, Logic = deps.Logic || win.DingstyLoopLogic;
    const $ = deps.$ || (s => doc.querySelector(s)), state = deps.state || Logic.make(1017);
    const renderer = deps.renderer || win.DingstyLoopRender.makeRenderer($('#game'));
    const lang = (doc.documentElement && doc.documentElement.lang || 'de').slice(0, 2);
    const text = { de: { gate: 'WÄHLE 0800', paused: 'PAUSE · PLAY zum Weiter', gag: 'DU BIST DRAN', over: 'RUNDE VORBEI', idle: 'PLAY startet die Runde.', running: 'Runde läuft.', hit: 'Seitlich erwischt. Noch ein Versuch.', rearm: 'Ziffer kommt wieder.', wrong: 'Falsche Reihenfolge. Noch einmal.', open: 'Tor offen. Weiter zur nächsten Szene.', loop: 'Zurück zu Szene 1.', stomp: 'Papp-Bot platt.', pickup: 'Token eingesammelt.' }, en: { gate: 'DIAL 0800', paused: 'PAUSED · PLAY to continue', gag: 'YOU ARE NEXT', over: 'GAME OVER', idle: 'PLAY starts the loop.', running: 'Loop running.', hit: 'Side hit. Try again.', rearm: 'Digit returns.', wrong: 'Wrong order. Try again.', open: 'Gate open. Next scene.', loop: 'Back to scene 1.', stomp: 'Bot squashed.', pickup: 'Token collected.' }, es: { gate: 'MARCA 0800', paused: 'PAUSA · PLAY para continuar', gag: 'ERES EL SIGUIENTE', over: 'FIN DEL JUEGO', idle: 'PLAY inicia el bucle.', running: 'Bucle en marcha.', hit: 'Golpe lateral. Inténtalo de nuevo.', rearm: 'El dígito vuelve.', wrong: 'Orden incorrecto. Inténtalo de nuevo.', open: 'Puerta abierta. Siguiente escena.', loop: 'Vuelta a la escena 1.', stomp: 'Bot aplastado.', pickup: 'Ficha recogida.' } };
    const copy = deps.copy || text[lang] || text.de;
    const el = { game: $('#game'), play: $('#play'), pause: $('#pause'), jump: $('#jump'), sound: $('#sound'), keypad: $('#keypad'), status: $('#status'), scene: $('#scene-label') };
    const FRAME_CATCHUP_SECONDS = 1, MAX_STEPS_PER_FRAME = 120, FIXED_STEP = Logic.constants.FIXED_STEP;
    let raf = 0, last = 0, accumulator = 0, stopped = false, soundOn = false, audio = null;
    if (deps.mode) Logic.setMode(state, deps.mode);
    const listen = [];
    function on(node, type, fn, opts) { node.addEventListener(type, fn, opts); listen.push([node, type, fn, opts]); }
    function message(type, value) { try { if (win.parent && win.parent !== win) win.parent.postMessage({ type, value, version: 1 }, win.location.origin); } catch (_) {} }
    function audioCall(name) { if (!audio || audio.state === 'closed' || typeof audio[name] !== 'function') return; try { const result = audio[name](); if (result && result.catch) result.catch(() => {}); } catch (_) {} }
    function status() { const e = Logic.meaningfulEvent(state); const map = { 'gate-open': copy.open, loop: copy.loop, 'side-hit': copy.hit, stomp: copy.stomp, pickup: copy.pickup }; if (state.phase === 'idle') el.status.textContent = copy.idle; else if (state.phase === 'frozen') el.status.textContent = copy.paused; else if (state.phase === 'over') el.status.textContent = copy.over + '. PLAY.'; else if (state.phase === 'gate') { const note = e && (e.type === 'wrong-digit' ? copy.wrong : e.type === 'digit-missed' || e.type === 'gate-rearm' ? copy.rearm : ''); el.status.textContent = note ? note + ' ' + copy.gate : copy.gate; } else el.status.textContent = e && map[e.type] || copy.running; }
    function keypad() { const open = state.phase === 'gate'; el.keypad.hidden = !open; el.keypad.setAttribute('aria-hidden', String(!open)); Array.from(el.keypad.children).forEach(button => { button.disabled = state.phase === 'frozen'; }); }
    function controls() { const paused = state.phase === 'frozen'; el.jump.disabled = paused; el.sound.disabled = paused; el.pause.setAttribute('aria-pressed', String(paused)); el.game.setAttribute('aria-disabled', String(paused)); }
    function draw() { renderer.draw(state, copy); el.scene.textContent = Logic.constants.SCENES[state.scene].name + (state.laps ? ' Runde ' + state.laps : ''); keypad(); controls(); status(); }
    function beep() { if (!soundOn || !audio || audio.state === 'closed' || state.phase === 'frozen') return; try { const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = 480; g.gain.value = .025; o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + .045); } catch (_) {} }
    function frame(now) { if (stopped || state.phase === 'frozen') return; const dt = Math.max(0, Math.min(FRAME_CATCHUP_SECONDS, (now - last) / 1000 || 0)); last = now; accumulator = Math.min(FRAME_CATCHUP_SECONDS, accumulator + dt); let steps = 0; while (accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) { Logic.step(state, FIXED_STEP); accumulator -= FIXED_STEP; steps++; } draw(); raf = win.requestAnimationFrame(frame); }
    function startLoop() { if (!stopped && state.phase !== 'idle' && state.phase !== 'frozen' && !raf) { last = win.performance.now(); accumulator = 0; raf = win.requestAnimationFrame(frame); } }
    function halt() { if (raf) win.cancelAnimationFrame(raf); raf = 0; accumulator = 0; audioCall('suspend'); }
    function start() { if (stopped) return; if (state.phase === 'frozen') { resume(); return; } Logic.start(state); message('game:start', 'play'); draw(); startLoop(); }
    function freeze() { if (stopped || state.phase === 'frozen') return; Logic.freeze(state); halt(); draw(); message('game:freeze'); }
    function resume() { if (stopped || state.phase !== 'frozen') return; Logic.resume(state); if (soundOn) audioCall('resume'); draw(); startLoop(); message('game:resume'); }
    function doJump() { if (state.phase === 'idle' || state.phase === 'over') return; if (Logic.jump(state)) beep(); draw(); }
    function stop() { if (stopped) return; stopped = true; halt(); Logic.stop(state); while (listen.length) { const [node, type, fn, opts] = listen.pop(); node.removeEventListener(type, fn, opts); } audioCall('close'); }
    function keydown(e) { if (['Space', 'ArrowUp'].includes(e.code) && !e.repeat) { e.preventDefault(); doJump(); } if (e.key === 'Escape') { e.preventDefault(); stop(); message('game:stop'); } }
    function receive(e) { if (e.origin !== win.location.origin || !e.data || e.data.version !== 1) return; if (e.data.type === 'game:freeze' || e.data.type === 'dingsty:signal') freeze(); if (e.data.type === 'game:resume') resume(); if (e.data.type === 'game:stop') stop(); if (e.data.type === 'game:mode') { Logic.setMode(state, e.data.mode || e.data.value); draw(); } if (e.data.type === 'game:sound' && !e.data.value) { soundOn = false; el.sound.textContent = 'Ton aus'; } }
    function toggleSound() { soundOn = !soundOn; if (soundOn && !audio) { const Audio = win.AudioContext || win.webkitAudioContext; if (Audio) audio = new Audio(); } if (soundOn) audioCall('resume'); else audioCall('suspend'); el.sound.textContent = soundOn ? 'Ton an' : 'Ton aus'; el.sound.setAttribute('aria-pressed', String(soundOn)); }
    function resize() { renderer.fit(); draw(); }
    for (let n = 0; n <= 9; n++) { const button = doc.createElement('button'); button.type = 'button'; button.textContent = n; button.setAttribute('aria-label', String(n)); el.keypad.appendChild(button); on(button, 'click', () => { Logic.digit(state, String(n)); draw(); }); }
    on(el.play, 'click', start); on(el.pause, 'click', () => { if (state.phase === 'frozen') resume(); else freeze(); }); on(el.jump, 'click', doJump); on(el.game, 'pointerdown', doJump); on(el.sound, 'click', toggleSound);
    on(win, 'keydown', keydown); on(win, 'message', receive); on(win, 'resize', resize); on(win, 'pagehide', stop, { once: true });
    resize();
    return { version: 6, start, freeze, resume, stop, setMode: mode => { Logic.setMode(state, mode); draw(); }, getState: () => Logic.snapshot(state), events: ['game:start', 'game:freeze', 'game:resume', 'game:stop', 'game:mode'] };
  }
  return { mount };
});
