/* Combined adapter glue (candidate 1017 combined, NOT FINAL, NOT READY, no vote).
   Loaded by mission/index.html of the COMBINED copy only, in place of the loop game's inline mount line.
   The loop game (runtime.js, game.js, render.js) is unchanged; this file owns the lifecycle the flow needs:
   - language from ?lang= (the loop game reads documentElement.lang at mount);
   - mount at load, STOP (tears the runtime down: loop, timers, listeners, audio), and a fresh MOUNT at the next game:begin;
   - game:begin (combined-only message from flow.js) starts or resumes the game; a running game is not restarted;
   - game:stop (combined-only, from flow.js Stopp and Ja) stops the game and releases its audio;
   - game:sound follows the flow's Ton (the game's own Ton button is hidden in the flow);
   - Escape inside the frame is game:back (the Stopp contract), not a pause, so Escape never reads as a human;
   - a hidden document turns the game's sound off and tells the flow (game:sound false);
   - dingsty:widget-size reports the frame height (the flow also reads .runner-shell directly).
   Messages handled by the runtime itself (not here): game:resume, dingsty:signal (freeze), game:sound false (silence). */
(function () {
  'use strict';
  var win = window, doc = document;
  var embed = !!(win.parent && win.parent !== win);
  var params = new URLSearchParams(win.location.search || '');
  var lang = (params.get('lang') || 'de').slice(0, 2);
  if (['de', 'en', 'es'].indexOf(lang) < 0) lang = 'de';
  doc.documentElement.lang = lang;
  if (embed) doc.documentElement.classList.add('flow-embed');

  var hook = null, mounted = false, wantSound = false, mode = 'play';

  function post(type, value) {
    if (!embed) return;
    try { win.parent.postMessage({ type: type, value: value, version: 1 }, win.location.origin); } catch (e) { /* no parent: nothing to tell */ }
  }
  function el(id) { return doc.getElementById(id); }
  function soundButton() { return el('sound'); }
  function soundIsOn() { var s = soundButton(); return !!s && s.textContent === 'Ton an'; }
  function soundLocked() { var s = soundButton(); return !s || !!s.disabled; }

  // Owned by the glue: the runtime's Ton state is changed only through its own button (a click), so the audio object is the runtime's.
  function applySound() {
    if (!mounted || soundLocked()) return;
    if (wantSound !== soundIsOn()) soundButton().click();
  }

  function mountGame() {
    var kp = el('keypad');
    if (kp) kp.innerHTML = ''; // the runtime appends ten digit buttons at each mount: clear the old ones first
    var s = soundButton();
    if (s) { s.textContent = 'Ton aus'; s.setAttribute('aria-pressed', 'false'); }
    hook = win.DingstyLoopRuntime.mount();
    mounted = true;
    win.__dingstyGameHook = hook;
  }

  function stopGame() {
    if (!mounted) return;
    hook.stop(); // runtime: cancels the frame loop, removes its listeners, closes its audio
    mounted = false;
  }

  function phase() { return mounted ? hook.getState().phase : 'stopped'; }

  function begin(value) {
    if (value === 'watch' || value === 'play') mode = value;
    if (!mounted) mountGame();
    // The mode is handed to the runtime on every begin (a remount starts in play mode, so the mode must be set again).
    // watch = the autopilot plays; play = the player's jump. setMode does not restart a running game.
    hook.setMode(mode);
    var p = phase();
    if (p === 'frozen') hook.resume();          // Nein (false alarm): the same run continues
    else if (p === 'idle' || p === 'over' || p === 'stopped') hook.start(); // a new run; a running or gated game is never restarted
  }

  win.addEventListener('message', function (e) {
    if (!embed || e.origin !== win.location.origin || !e.data || e.data.version !== 1 || e.source !== win.parent) return;
    var t = e.data.type, v = e.data.value;
    if (t === 'game:begin') begin(v);
    else if (t === 'game:stop') stopGame();
    else if (t === 'game:mode') { if (v === 'watch' || v === 'play') mode = v; }
    else if (t === 'game:sound') wantSound = !!v;
    applySound();
  });

  // Escape inside the frame is the Stopp contract (game:back), never the runtime's pause (a pause would read as a human).
  win.addEventListener('keydown', function (e) {
    if (!embed) return;
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      post('game:back');
    }
  }, true);

  // A hidden document is silenced here and the flow is told, so its Ton label never says "on" while the game is silent.
  doc.addEventListener('visibilitychange', function () {
    if (doc.hidden && wantSound) { wantSound = false; applySound(); post('game:sound', false); }
  });

  // the same rule as the flow's fitFrame (ceil of the shell height, plus 2 px), so the page's size message never shrinks the frame by 2 px
  function size() {
    var shell = doc.querySelector ? doc.querySelector('.runner-shell') : null;
    if (shell) post('dingsty:widget-size', Math.ceil(shell.getBoundingClientRect().height)+2);
  }
  win.addEventListener('resize', size);

  if (embed && doc.head) {
    var st = doc.createElement('style');
    // PAUSE is hidden inside the flow: the runtime's pause posts game:freeze, and the flow reads game:freeze as a human (flow.js).
    // The control stays on the standalone game page. Escape is the Stopp mapping here (see the keydown capture below).
    st.textContent = 'html.flow-embed .game-head,html.flow-embed #game-title,html.flow-embed .small-note,html.flow-embed #sound,html.flow-embed #pause,html.flow-embed .pause-row{display:none!important}';
    doc.head.appendChild(st);
  }
  var shellEl = doc.querySelector ? doc.querySelector('.game-shell') : null;
  if (shellEl) shellEl.classList.add('runner-shell'); // the flow's fitFrame() reads this class to size the frame

  mountGame();
  size();
  void mode;
})();
