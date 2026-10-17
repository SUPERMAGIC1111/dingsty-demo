/* Dingsty flow controller (candidate 1017, round 8, NOT FINAL, NOT READY). Round 8: the frame loop name collision is fixed (N-R7-01), rAF has a timer fallback, Nochmal listens again (N-R7-03).
   Round 6: no cube overlay in game states (R5-08); Stopp hidden in idle (R5-04); the game reports its height (flow frame sized to it).
   One stacked stage: real Dingsty -> pixel burst (frame sequence on canvas) -> pixel runner (iframe) -> human freeze -> reverse burst -> alert -> phone-only close.
   One character: the stage, the burst and the alert all draw keyed frames of the same burst clip (cream phone).
   States: idle | waiting-real | pixelating | game-watch | game-play | human-detected | un-pixel | alert | done
   Round 5: one state machine with a transition guard. While a transition runs (pixelating, human-detected, un-pixel, done) a
   second human input is not a second transition: a press during the burst only marks the human (the runner then freezes once).
   Stopp (button) and Escape return to waiting-real from every state. The burst frames are fetched on first interaction only.
   Entry points from index.html: DingstyFlow.listening(on), DingstyFlow.human(source), DingstyFlow.resume(), DingstyFlow.done(), DingstyFlow.setDemo(on), DingstyFlow.ownsText().
   Game hook (documented, for the next game): window.__dingstyGameHook (see bottom of this file).
   Test hook: open with ?clock=manual, then window.__step(ms) advances the single flow clock and redraws. */
(function () {
  'use strict';

  var FPS = 24, LAST = 191;
  var RATE_PIXEL = 1.25, RATE_RESUME = 2, RATE_VANISH = 2;
  // round 9 (N-R8-04): a human heard from waiting (the demo voice or the microphone) lets the runner play for 10 s before the freeze.
  // "Ich bin da" still freezes at once. Was 1.5 s, which cut every game short.
  var AUTO_FREEZE_MS = 10000;
  // round 15 (N15-01): demo route only. After this much game time without a human, the freeze is armed (see stateStep).
  var DEMO_WATCHDOG_MS = 20000;
  // round 12 (R11-01): a PRESSED "Ich bin da" (or a real microphone detection) is an immediate human: the runner shows for about
  // 1.5 s after the game's entry, then freezes. The 10 s above stays only for the simulated voice (demo route).
  var PRESS_FREEZE_MS = 1500;
  var manual = /[?&]clock=manual(?:&|$)/.test(location.search);
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var lang = (document.documentElement.lang || 'de').slice(0, 2);
  if (['de', 'en', 'es'].indexOf(lang) < 0) lang = 'de';

  var COPY = {
    de: {
      tabs: { watch: 'Zuschauen', play: 'Spielen' },
      sound: { off: 'Ton: aus', on: 'Ton: an' },
      back: 'Stopp',
      here: 'Ich bin da', yes: 'Ja, Mensch!', no: 'Nein, Ansage', again: 'Nochmal', launchDemo: 'Demo ohne Mikro', start: 'Starten',
      demo: 'Demo: simulierte Stimme',
      wait: 'Wartezeit',
      stage: { s: 'Bereit', h: '' }, // round 15: no hint in the ready card (it repeated the controls)
      hearIdle: 'hört nicht zu',
      ack: 'Gehört. Dingsty friert gleich ein.',
      cap: {
        'idle': 'Dingsty wartet mit dir.',
        'waiting-real': 'Dingsty wartet mit dir.',
        'pixelating': 'Dingsty zerfällt in Pixel. Das ist Absicht.',
        'game-watch': 'Zuschauen: Dingsty weicht allein aus.',
        'game-play': 'Spielen: Tippen oder Leertaste springt.',
        'human-detected': 'Stopp. Ein Mensch ist da.',
        'un-pixel': 'Zurück in echt. Gleich bist du dran.',
        'alert': 'Jetzt wärst du dran.',
        'done': 'Gut. Dingsty legt auf. Das Handy bleibt.'
      },
      alertStatus: 'Sprachähnlicher Ton nach Wartemusik erkannt',
      alertHint: 'Prüfe, ob jemand oder eine Ansage spricht.',
      finished: { title: 'Gut. Dingsty legt auf.', hint: 'Das Handy bleibt.' }, // round 13 (R12-04): the finished screen never shows the question copy
      demoShort: 'Demo'
    },
    en: {
      tabs: { watch: 'Watch', play: 'Play' },
      sound: { off: 'Sound: off', on: 'Sound: on' },
      back: 'Stop',
      here: "I'm here", yes: 'Yes, human!', no: 'No, recording', again: 'Again', launchDemo: 'Demo without mic', start: 'Start',
      demo: 'Demo: simulated voice',
      wait: 'Waiting time',
      stage: { s: 'Ready', h: '' }, // round 15: no hint in the ready card (it repeated the controls)
      hearIdle: 'not listening',
      ack: 'Heard you. Dingsty freezes in a second.',
      cap: {
        'idle': 'Dingsty waits with you.',
        'waiting-real': 'Dingsty waits with you.',
        'pixelating': 'Dingsty breaks into pixels. On purpose.',
        'game-watch': 'Watch: Dingsty dodges on his own.',
        'game-play': 'Play: tap or Space to jump.',
        'human-detected': 'Stop. A human is here.',
        'un-pixel': 'Back to real. Your turn in a second.',
        'alert': 'Now it would be your turn.',
        'done': 'Good. Dingsty hangs up. The phone stays.'
      },
      alertStatus: 'Speech after hold music',
      alertHint: 'Check whether a person or a recording is speaking.',
      finished: { title: 'Good. Dingsty hangs up.', hint: 'The phone stays.' },
      demoShort: 'Demo'
    },
    es: {
      tabs: { watch: 'Ver', play: 'Jugar' },
      sound: { off: 'Sonido: apagado', on: 'Sonido: activado' },
      back: 'Parar',
      here: 'Estoy aquí', yes: '¡Sí, persona!', no: 'No, aviso', again: 'Otra vez', launchDemo: 'Demo sin micro', start: 'Empezar',
      demo: 'Demo: voz simulada',
      wait: 'Tiempo de espera',
      stage: { s: 'Listo', h: '' }, // round 15: no hint in the ready card (it repeated the controls)
      hearIdle: 'no escucha',
      ack: 'Te he oído. Dingsty se congela ya.',
      cap: {
        'idle': 'Dingsty espera contigo.',
        'waiting-real': 'Dingsty espera contigo.',
        'pixelating': 'Dingsty se convierte en píxeles. A propósito.',
        'game-watch': 'Ver: Dingsty esquiva solo.',
        'game-play': 'Jugar: toca o pulsa Espacio para saltar.',
        'human-detected': 'Alto. Hay una persona.',
        'un-pixel': 'De vuelta a lo real. Ya te toca.',
        'alert': 'Ahora te toca a ti.',
        'done': 'Bien. Dingsty cuelga. El teléfono se queda.'
      },
      alertStatus: 'Suena a voz tras la espera',
      alertHint: 'Comprueba si habla una persona o una grabación.',
      finished: { title: 'Bien. Dingsty cuelga.', hint: 'El teléfono se queda.' },
      demoShort: 'Demo'
    }
  };
  var T = COPY[lang];

  function $(id) { return document.getElementById(id); }
  var scene = $('flow-scene'), canvas = $('flow-canvas'), ctx = canvas.getContext('2d'),
      fxBox = $('flow-fx'), captionEl = $('flow-caption'), timerEl = $('flow-timer'),
      tabs = $('flow-tabs'), soundBtn = $('flow-sound'), backBtn = $('flow-back'), hereBtn = $('flow-here'), againBtn = $('flow-again'),
      ans = $('answer'), missionFrame = $('mission-frame'), statusEl = $('status'), hintEl = $('hint'), hearEl = $('hear'), demoEl = $('flow-demo');
  // round 8 (N-R7-01): the iframe element is missionFrame. It must not share a name with the frame loop function (frame), or the loop breaks.
  // round 9: the start control (after a stop, or before a session) and the demo offer shown with a notice (N-R8-02, N-R8-03)
  var startBtn = $('flow-start'), noticeDemo = $('notice-demo');
  var layerNodes = {
    'fl-real': scene.querySelector('.fl-real'),
    'fl-burst': scene.querySelector('.fl-burst'),
    'fl-game': scene.querySelector('.fl-game')
  };
  var GAME = { 'game-watch': 1, 'game-play': 1 };
  var ACTIVE = { 'waiting-real': 1, 'pixelating': 1, 'game-watch': 1, 'game-play': 1, 'human-detected': 1, 'un-pixel': 1 };
  var CONTROLS = { 'idle': 1, 'waiting-real': 1, 'pixelating': 1, 'game-watch': 1, 'game-play': 1 };
  // transitions that run on their own clock: input is not a second transition here (Stopp still leaves them)
  var TRANSIT = { 'pixelating': 1, 'human-detected': 1, 'un-pixel': 1, 'done': 1 };

  var S = {
    state: 'idle', prev: null, phase: 0, elapsed: 0,
    mode: 'watch', soundOn: false, gameLive: false, pixelRate: RATE_PIXEL, autoHuman: false, demo: false,
    freezeAfter: AUTO_FREEZE_MS, pressed: false, // round 12 (R11-01): freezeAfter is the game time before the auto freeze; pressed = a press is waiting for the freeze
    pending: false, // round 13 (R12-01): a microphone prompt is open (index.html sets it): Stopp and Escape stay live
    clip: null, drawIdx: 0, fromIdx: LAST,
    frames: { burst: [], vanish: [] },
    fx: [], fxT: 0, seed: 7, running: false, noticeOn: false, gameNotice: ''
  };

  /* ---------- frames ---------- */
  // round 19: the re-keyed frames (flow/burst-v2, flow/vanish-v2; manifest flow/manifest-r18.json). The round 18 folders stay on disk, unreferenced.
  function frameSrc(name, i) { return 'flow/' + name + '-v2/f' + ('00' + i).slice(-3) + '.webp'; }
  // Round 5 (R4-04): nothing loads by itself. A frame is fetched when it is first needed: the first frame (the stage character)
  // at first paint, the rest of a clip when the user picks Watch/Play, Ich bin da, Demo ohne Mikro or Start.
  function frameAt(name, i) {
    var list = S.frames[name];
    if (!list[i]) {
      var im = new Image();
      im.decoding = 'async';
      if (name === 'burst' && i === 0) {
        // the first frame is the stage character: paint it as soon as it arrives, so the canvas is never empty
        im.onload = function () { if (!S.clip && S.state !== 'pixelating') draw('burst', 0); };
      }
      im.src = frameSrc(name, i);
      list[i] = im;
    }
    return list[i];
  }
  function preload(name) {
    for (var i = 0; i <= LAST; i++) frameAt(name, i);
  }
  function ready(im) { return !!(im && im.complete && im.naturalWidth); }
  function draw(name, idx) {
    var list = S.frames[name];
    idx = Math.max(0, Math.min(LAST, Math.round(idx)));
    var im = frameAt(name, idx);
    if (!ready(im)) {
      for (var k = idx; k >= 0; k--) { if (ready(list[k])) { im = list[k]; break; } }
    }
    if (!ready(im)) return; // never blank: keep the previous frame on screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
    S.drawIdx = idx;
  }
  // round 10 (N9-03): the stage canvas always shows frame 0 (the stage character) when the flow is idle or waiting,
  // so a closing frame from the last story never stays on the canvas. draw() keeps the previous frame if frame 0 is not ready.
  function drawStageCharacter() {
    if (!S.clip) draw('burst', 0);
  }
  function startClip(name, from, to, rate, onEnd) {
    preload(name);
    var dur = Math.abs(to - from) / (FPS * rate) * 1000;
    S.clip = { name: name, from: from, to: to, dur: Math.max(1, dur), t: 0, onEnd: onEnd };
    draw(name, from);
  }
  function advanceClip(dt) {
    var c = S.clip;
    if (!c) return;
    c.t += dt;
    var p = Math.min(1, c.t / c.dur);
    draw(c.name, c.from + (c.to - c.from) * p);
    if (p >= 1) {
      S.clip = null;
      if (c.onEnd) c.onEnd();
    }
  }

  /* ---------- game bridge (postMessage, same origin) ---------- */
  function missionSend(type, value) {
    try {
      if (missionFrame && missionFrame.contentWindow) {
        missionFrame.contentWindow.postMessage({ type: type, value: value, version: 1 }, location.origin);
      }
    } catch (e) { /* frame not ready: the flow still works without the game */ }
  }
  function setScene(c) {
    var h = window.DingstyHoldBuddy;
    if (h && h.setScene) h.setScene(c);
  }

  /* ---------- particles (pixel cubes that converge or leave) ---------- */
  function rnd() { S.seed = (S.seed * 16807) % 2147483647; return S.seed / 2147483647; }
  function sceneRect() { return scene.getBoundingClientRect(); }
  function clusterPoint() { var r = sceneRect(); return { x: r.width * 0.5, y: r.height * 0.62 }; }
  function runnerPoint() {
    var r = sceneRect(), fr = missionFrame.getBoundingClientRect();
    var x = fr.left + fr.width * 0.3, y = fr.top + fr.height * 0.5;
    try {
      var c = missionFrame.contentDocument.getElementById('game');
      if (c) {
        var cr = c.getBoundingClientRect();
        x = fr.left + cr.left + cr.width * (88 / 320);   // runner centre x (game x=76 + 12)
        y = fr.top + cr.top + cr.height * (133 / 180);  // runner centre y (ground 146 - 25 + 12)
      }
    } catch (e) { /* cross-origin or not loaded: keep the fallback */ }
    return { x: x - r.left, y: y - r.top };
  }
  function fxRun(from, to, dur, stagger) {
    var r = sceneRect();
    S.fxT = 0;
    S.fx = [];
    for (var i = 0; i < fxBox.children.length; i++) {
      var sx = from.x + (rnd() - 0.5) * Math.min(90, r.width * 0.2);
      var sy = from.y + (rnd() - 0.5) * 60;
      var ex = to.x + (rnd() - 0.5) * 12, ey = to.y + (rnd() - 0.5) * 12;
      S.fx.push({ el: fxBox.children[i], sx: sx, sy: sy, ex: ex, ey: ey, delay: i * stagger, dur: dur });
    }
  }
  function easeOutBack(p) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); }
  function fxUpdate(dt) {
    if (!S.fx.length) return;
    S.fxT += dt;
    for (var i = 0; i < S.fx.length; i++) {
      var p = S.fx[i], local = (S.fxT - p.delay) / p.dur;
      if (local <= 0 || local >= 1) { p.el.style.opacity = '0'; continue; }
      var e = easeOutBack(local);
      var x = p.sx + (p.ex - p.sx) * e, y = p.sy + (p.ey - p.sy) * e;
      p.el.style.opacity = '1';
      p.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + (1 - 0.35 * local).toFixed(2) + ')';
    }
    if (S.fxT > 1500) S.fx = [];
  }
  function fxClear() {
    S.fx = [];
    for (var i = 0; i < fxBox.children.length; i++) fxBox.children[i].style.opacity = '0';
  }

  /* ---------- sound (off by default; chime only when Ton is on) ---------- */
  // round 20 (combined I-1): ONE audio context, created lazily by the first chime (Ton on, an alert) and reused by the next alerts.
  // Ja (done) suspends it (suspendAudio); Stopp, Escape and pagehide close it (releaseAudio). Never created while Ton is off
  // (go('alert') chimes only when Ton is on).
  var audioCtxRef = null;
  function chime() {
    if (S.halted) return; // round 21 (I-3): a halted page never opens an audio context
    try {
      if (!audioCtxRef) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtxRef = new AC();
      }
      var c = audioCtxRef, t = c.currentTime;
      if (c.state === 'suspended' && c.resume) c.resume();
      [784, 988, 1175].forEach(function (f, i) {
        var o = c.createOscillator(), g = c.createGain();
        o.frequency.value = f; g.gain.value = 0.03;
        o.connect(g); g.connect(c.destination);
        o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.2);
      });
    } catch (e) { /* no audio: silent */ }
  }
  function suspendAudio() {
    if (audioCtxRef && audioCtxRef.suspend) { try { audioCtxRef.suspend(); } catch (e) { /* not running */ } }
  }
  function releaseAudio() {
    if (!audioCtxRef) return;
    var c = audioCtxRef;
    audioCtxRef = null;
    try { if (c.close) c.close(); } catch (e) { /* already closed */ }
  }
  window.addEventListener('pagehide', releaseAudio);

  /* ---------- state machine ---------- */
  function enterGame() {
    missionSend('game:mode', S.mode); // the mode may have changed while the burst ran
    go(S.mode === 'play' ? 'game-play' : 'game-watch');
  }

  function go(next) {
    var prev = S.state;
    S.noticeOn = false; // a notice stays until the next state change
    S.gameNotice = '';  // the game's death line too (round 9)
    // round 12 (R11-01): a press waits through the burst and the game only; any other state (the freeze, the alert, done, waiting) ends it
    if (!(next === 'pixelating' || GAME[next])) S.pressed = false;
    // round 8 (N-R7-04): the closing phone is centred only after the vanish clip ends (see the "closed" rule in flow.css)
    if (next !== 'done') scene.classList.remove('closed');
    S.state = next;
    S.prev = prev;
    S.phase = 0;
    // the Ja/Nein row belongs to the alert only, whatever API path led here (hook or button)
    ans.hidden = next !== 'alert';
    switch (next) {
      case 'idle':
        S.clip = null; fxClear(); S.autoHuman = false;
        drawStageCharacter();
        break;
      case 'waiting-real':
        S.clip = null; fxClear(); S.autoHuman = false;
        drawStageCharacter(); // round 10 (N9-03): the canvas shows the stage character, never the closing frame of the last story
        setScene('idle');
        statusEl.textContent = T.stage.s;
        hintEl.textContent = T.stage.h;
        if (hearEl && !S.running) hearEl.textContent = T.hearIdle;
        break;
      case 'pixelating':
        preload('burst');
        missionSend('game:mode', S.mode);
        missionSend('game:resume'); // harmless unless the game was frozen earlier
        if (reduce) { S.clip = null; draw('burst', LAST); }
        else startClip('burst', 0, LAST, S.pixelRate, enterGame);
        S.pixelRate = RATE_PIXEL;
        break;
      case 'game-watch':
      case 'game-play':
        S.clip = null;
        missionSend('game:begin', S.mode); // combined: the game session starts here (combined-only message)
        // round 6 (R5-08): no cube overlay on entry to the game (it crossed the game copy and the Springen edge)
        // round 10 (N9-04): the hidden stage text does not keep the alert copy while the game runs
        statusEl.textContent = T.stage.s;
        hintEl.textContent = T.stage.h;
        break;
      case 'human-detected':
        S.fromIdx = (prev === 'pixelating') ? S.drawIdx : LAST;
        S.clip = null;
        S.autoHuman = false;
        if (S.gameLive) {
          missionSend('dingsty:signal'); // round 6 (R5-08): the freeze has no cube overlay either
        }
        break;
      case 'un-pixel':
        if (reduce) { S.clip = null; draw('burst', 0); }
        else startClip('burst', S.fromIdx, 0, RATE_PIXEL, function () { go('alert'); });
        break;
      case 'alert':
        S.clip = null; S.autoHuman = false;
        setScene('alert');
        statusEl.textContent = T.alertStatus;
        hintEl.textContent = T.alertHint;
        if (hearEl) hearEl.textContent = '';
        if (S.soundOn) chime();
        // round 10 (N9-06): vibrate only after a user gesture (the browser blocks it otherwise, and logs a notice)
        try { if (navigator.userActivation && navigator.userActivation.hasBeenActive && navigator.vibrate) navigator.vibrate([300, 120, 300]); } catch (e) { /* none */ }
        preload('vanish');
        break;
      case 'done':
        S.autoHuman = false;
        suspendAudio(); // round 20 (I-1): Ja ends the session; the one audio context is suspended (reused by the next alert)
        // round 13 (R12-04): the stage text is the finished copy (the question copy of the alert stays in the alert only)
        statusEl.textContent = T.finished.title;
        hintEl.textContent = T.finished.hint;
        if (reduce) { S.clip = null; draw('vanish', LAST); scene.classList.add('closed'); }
        else startClip('vanish', 0, LAST, RATE_VANISH, function () { scene.classList.add('closed'); });
        break;
    }
    render();
    kick();
  }

  function stateStep() {
    switch (S.state) {
      case 'pixelating':
        if (reduce && S.phase >= 900) enterGame();
        break;
      case 'game-watch':
      case 'game-play':
        // round 15 (N15-01): the demo route has no real microphone. If the simulated voice has not armed the freeze within
        // DEMO_WATCHDOG_MS of the game's entry (its audio can starve on a throttled timer), the freeze is armed here, so the
        // story never waits for a press forever. The real microphone route never gets this rule.
        if (S.demo && !S.simVoiced && !S.autoHuman && !S.pressed && S.phase >= DEMO_WATCHDOG_MS) { S.autoHuman = true; S.freezeAfter = 0; }
        if (S.autoHuman && S.phase >= S.freezeAfter) { human('auto'); }
        break;
      case 'human-detected':
        if (S.phase >= 700) go('un-pixel');
        break;
      case 'un-pixel':
        if (reduce && S.phase >= 700) go('alert');
        break;
    }
  }

  function pickMode(m) {
    if (m !== 'watch' && m !== 'play') return;
    // a reverse burst or the freeze is running: the tab is not a second transition (Stopp still leaves)
    if (TRANSIT[S.state] && S.state !== 'pixelating') return;
    // round 21 (F2): not listening (no detector): the press starts the session exactly like Starten (one path: the microphone or the
    // demo simulator, by route). The story starts only when listening has begun (listening() applies the pending mode). Never a game without a detector.
    if (!S.running) {
      S.pendingMode = m;
      try { window.dispatchEvent(new CustomEvent('dingsty:start')); } catch (e) { /* old browser: no start */ }
      render();
      return;
    }
    S.mode = m;
    if (S.state === 'idle' || S.state === 'waiting-real') {
      S.gameLive = false;
      go('pixelating');
    } else if (GAME[S.state]) {
      missionSend('game:mode', m);
      go(m === 'play' ? 'game-play' : 'game-watch');
    }
    render();
  }

  // Human detected (microphone detector, "Ich bin da", the game's own freeze, or the automatic route below).
  // Round 5 guard: one human starts one transition. During the burst a second input only marks the human,
  // so the runner shows, then freezes once (no skip of the runner or the reverse burst).
  function human(source) {
    var from = S.state;
    // round 12 (R11-01): a press ("Ich bin da") or a real detection is an immediate human: it freezes about 1.5 s after the game's
    // entry and is acknowledged at once (pressed button, caption). Only the simulated voice keeps the 10 s wait.
    var wait = source === 'demo' ? AUTO_FREEZE_MS : PRESS_FREEZE_MS;
    var pressed = source !== 'demo' && source !== 'auto';
    if (source === 'demo' && S.pressed) return; // a press already waiting wins over the simulated voice
    if (from === 'idle' || from === 'waiting-real') {
      // No mode picked yet: still play the story (burst -> runner -> freeze -> un-pixel -> alert).
      S.autoHuman = true;
      S.freezeAfter = wait;
      S.gameLive = true;
      S.pixelRate = RATE_PIXEL;
      if (pressed) S.pressed = true;
      go('pixelating');
      return;
    }
    if (from === 'pixelating') {
      S.autoHuman = true;
      S.freezeAfter = wait;
      S.gameLive = true;
      if (pressed) S.pressed = true; // acknowledged now; the freeze comes when the runner has shown for the wait
      render();
      return;
    }
    if (TRANSIT[from] || from === 'alert') return; // already answered (human-detected, un-pixel, done) or waiting for Ja/Nein
    S.gameLive = !!GAME[from];
    go('human-detected');
  }

  // round 9 (N-R8-04): the simulated voice. In a game state it does not freeze the runner at once: it arms the same 10 s
  // auto-freeze, counted from the game's own entry, so the game gets a believable time. Elsewhere it is a human heard as before.
  function demoVoice() {
    S.simVoiced = true; // round 15: the simulated voice has spoken in this session; the watchdog then stays off (N-R8-04 holds)
    if (GAME[S.state]) {
      if (!S.pressed) { S.autoHuman = true; S.freezeAfter = AUTO_FREEZE_MS; } // round 12: a waiting press keeps its 1.5 s
      S.gameLive = true; render(); kick(); return;
    }
    human('demo');
  }

  // round 19 (review 1017 finding 4): "Nein, Ansage" = FALSE ALARM. The game goes straight back to the mode it was in (no dissolve
  // replay, no alert copy), the game unfreezes, the status returns to the stage copy, and the detector keeps listening so a new alert
  // can come (index.html re-arms the detector loop and the simulated speech after Nein). Without a game it waits.
  function resume() {
    if (S.state !== 'alert') return;
    if (!S.gameLive) { go('waiting-real'); return; }
    S.simVoiced = false;               // the demo voice may speak again
    S.pressed = false;
    statusEl.textContent = T.stage.s;
    hintEl.textContent = T.stage.h;
    missionSend('game:resume');
    go(S.mode === 'play' ? 'game-play' : 'game-watch'); // S.phase restarts here: the game's clock starts at the resume
    // round 20 (combined I-2): the next freeze is the game's own 10 s, counted from THIS resume. It is armed here, not by the simulated
    // voice (whose detection came 12 to 19 s after the resume, so the freeze fired late and at once). The alert after it is the normal path.
    S.autoHuman = true;
    S.freezeAfter = AUTO_FREEZE_MS;
    kick();
    render();
  }

  function done() {
    if (S.state === 'alert') { missionSend('game:stop'); go('done'); } // combined: Ja ends the game session
  }

  // Round 5 (R4-05): Stopp and Escape leave any state and return to waiting-real, clean: no clip, no timer, no answers, game unfrozen.
  function back() {
    // round 13 (R12-01): idle with a microphone prompt still open (S.pending) is not a no-op: Stopp and Escape must reach the page,
    // which ends the session so that a late grant is stopped at once
    if (S.state === 'idle' && !S.pending) return;
    var was = S.state;
    S.pending = false;
    S.running = false; // round 7 (R6-01): Stopp, Escape, a hidden tab or a closed page: the detector is released (index.html releaseAll)
    S.demo = false;    // the demo label goes with the simulator
    S.pendingMode = null; // round 21 (F2): Stopp drops a mode that was waiting for the detector
    S.clip = null; fxClear();
    S.autoHuman = false; S.gameLive = false; S.pixelRate = RATE_PIXEL; S.elapsed = 0; S.pressed = false;
    missionSend('game:stop'); // combined: Stopp ends the game session (loop, timers, audio); replaces game:resume here
    releaseAudio(); // round 20 (I-1): Stopp and Escape close the page's audio context
    try { window.dispatchEvent(new CustomEvent('dingsty:back')); } catch (e) { /* old browser: the detector keeps its state */ }
    go('waiting-real');
  }

  // round 9 (N-R8-02): index.html sends a failure or a notice here. The flow owns the stage text, so the notice goes to the
  // flow's own status and hint lines, with the demo offer under it.
  function notice(title, hint) {
    statusEl.textContent = title;
    hintEl.textContent = hint || '';
    S.noticeOn = true;
    render();
  }
  function setDemo(on) {
    S.demo = !!on;
    if (on) S.simVoiced = false; // a new demo session: the simulated voice has not spoken yet
    render();
    kick();
  }

  function listening(on) {
    S.running = !!on;
    // round 7 (R6-09): the burst is not preloaded here; it loads when the story starts (Watch, Play, Ich bin da, or the detector's trigger)
    if (on) {
      // a new start always begins at waiting, also after done or alert (no stale caption or headline from the last call)
      if (S.state === 'idle' || S.state === 'done' || S.state === 'alert') { S.elapsed = 0; S.gameLive = false; go('waiting-real'); }
    }
    render(); // round 9: the start control and the demo badge follow whether we listen
    // round 21 (F2): a mode pressed while not listening starts now that the detector runs
    if (on && S.pendingMode) { var pm = S.pendingMode; S.pendingMode = null; pickMode(pm); return; }
    kick();
  }

  // round 13 (R12-01): index.html marks the microphone prompt as open. Stopp and Escape stay live while it is open.
  function pending(on) {
    S.pending = !!on;
    render();
    kick();
  }

  /* ---------- rendering ---------- */
  function mmss(ms) {
    var s = Math.floor(ms / 1000);
    return (Math.floor(s / 60) < 10 ? '0' : '') + Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }
  function placeBlob() {
    var blob = tabs.querySelector('.blob');
    var sel = tabs.querySelector('button[aria-pressed="true"]') || tabs.querySelector('button');
    if (!blob || !sel) return;
    blob.style.width = sel.offsetWidth + 'px';
    blob.style.transform = 'translateX(' + sel.offsetLeft + 'px)';
  }
  // Which layer is on. Freeze keeps the last visible layer on screen: the runner stays up while it freezes,
  // the burst canvas stays up when the human arrives during the burst. Nothing goes blank between states.
  function layersFor() {
    var s = S.state, prev = S.prev;
    var real = (s === 'idle' || s === 'waiting-real' || s === 'alert');
    var burst = (s === 'pixelating' || s === 'un-pixel' || s === 'done') || (s === 'human-detected' && prev === 'pixelating');
    var game = !!GAME[s] || (s === 'human-detected' && prev !== 'pixelating');
    return { 'fl-real': real, 'fl-burst': burst, 'fl-game': game };
  }
  var lastBlobKey = null, lastBlobVisible = false;
  function render() {
    scene.setAttribute('data-state', S.state);
    var on = layersFor();
    Object.keys(on).forEach(function (k) {
      var node = layerNodes[k];
      if (node) node.classList.toggle('on', !!on[k]);
    });
    var controls = !!CONTROLS[S.state];
    // round 3: nothing is removed from layout. Inactive controls are dimmed or made invisible in their fixed cell.
    tabs.setAttribute('data-dim', controls ? '0' : '1');
    // round 7 (R6-06): dimmed tabs are inert (disabled): no click, no focus, no mode change while the alert or a transition runs
    var tabBtnsNow = tabs.querySelectorAll('button[data-mode]');
    for (var tb = 0; tb < tabBtnsNow.length; tb++) tabBtnsNow[tb].disabled = !controls;
    // round 13 (R12-07): the game frame is in the tab order only while it is the active layer; a focused tab that dims moves the focus to Ton
    if (missionFrame) missionFrame.tabIndex = GAME[S.state] ? 0 : -1;
    if (!controls && typeof document !== 'undefined' && document.activeElement && document.activeElement.disabled && soundBtn) soundBtn.focus();
    // round 9 (N-R8-03): when nothing listens (idle or waiting after a stop), the start control takes the place of "Ich bin da" in the same cell
    var idleStart = !S.running && (S.state === 'idle' || S.state === 'waiting-real');
    startBtn.style.visibility = idleStart ? 'visible' : 'hidden';
    hereBtn.style.visibility = controls && !idleStart ? 'visible' : 'hidden';
    noticeDemo.hidden = !(S.noticeOn && idleStart);
    // round 11 (R11 notice clip): with the demo offer on screen the hero shrinks (CSS), so the offer stays inside the stage box.
    scene.setAttribute('data-notice', noticeDemo.hidden ? '0' : '1');
    againBtn.style.visibility = S.state === 'done' ? 'visible' : 'hidden';
    // round 6 (R5-04): Stopp is kept in its cell but hidden in idle, where it has nothing to stop (no silent no-op)
    // round 13 (R12-01): while a microphone prompt is open the Stopp control is shown too (the state is still idle)
    backBtn.style.visibility = (S.state === 'idle' && !S.pending) ? 'hidden' : 'visible';
    // round 16 (REVIEW-1015 item 1): Stopp and "Mehr" share one slot next to the mode track, so they never overlap. While a session runs
    // (listening, the story, the alert) the slot holds Stopp and the menu is hidden; otherwise the slot holds the menu and Stopp is hidden.
    var inSession = S.running || S.pending || (S.state !== 'idle' && S.state !== 'waiting-real' && S.state !== 'done');
    backBtn.style.visibility = inSession ? 'visible' : 'hidden';
    var moreEl = $('more');
    if (moreEl) { if (inSession && moreEl.open) moreEl.open = false; moreEl.style.visibility = inSession ? 'hidden' : 'visible'; }
    var btns = tabs.querySelectorAll('button[data-mode]');
    for (var i = 0; i < btns.length; i++) {
      var sel = btns[i].getAttribute('data-mode') === S.mode;
      btns[i].setAttribute('aria-pressed', sel ? 'true' : 'false');
    }
    var blobKey = S.mode + (controls ? '1' : '0');
    // round 5: the tab highlight is measured again when the row first becomes visible (the listening UI is revealed after load)
    var blobVisible = tabs.offsetWidth > 0;
    if (blobVisible !== lastBlobVisible) { lastBlobVisible = blobVisible; lastBlobKey = null; }
    if (lastBlobKey !== blobKey) { lastBlobKey = blobKey; placeBlob(); }
    soundBtn.textContent = S.soundOn ? T.sound.on : T.sound.off;
    soundBtn.setAttribute('aria-pressed', S.soundOn ? 'true' : 'false');
    // round 9 (N-R8-06): a line from the game (the death line) shows in the caption while it lasts
    // round 12 (R11-01): a waiting press is acknowledged at once: the button shows the pressed state and the caption says so
    hereBtn.classList.toggle('ack', !!S.pressed);
    hereBtn.setAttribute('aria-pressed', S.pressed ? 'true' : 'false');
    // round 19 (review 1017 finding 3): the flow owns the caption in every state. The game's own copy (its death lines and
    // jokes, which reached this line through 'game:notice') stays inside the game frame and never replaces the flow's caption.
    captionEl.textContent = S.pressed ? T.ack : (T.cap[S.state] || '');
    // round 13 (R12-06): during the game the demo marker is in the timer line, not over the playfield (the badge would cover the road)
    // the story states (the burst, the game, the freeze, the reverse burst) carry the demo marker in the timer line, not over the stage
    var inStory = !!(GAME[S.state] || S.state === 'pixelating' || S.state === 'human-detected' || S.state === 'un-pixel');
    timerEl.textContent = T.wait + ' ' + mmss(S.elapsed) + (S.demo && inStory ? ' · ' + T.demoShort : '');
    timerEl.style.visibility = ACTIVE[S.state] ? 'visible' : 'hidden';
    // round 9 (N-R8-08): the demo badge is not shown in done (the session ends with Ja)
    if (demoEl) demoEl.hidden = !S.demo || S.state === 'done' || inStory;
    // round 13 (R12-05): in a game state the frame is as tall as its own content (the score line included)
    if (GAME[S.state]) { fitFrame(); layoutGame(); } else if (stageLaid) layoutGame();
  }

  /* ---------- tick: one clock for real time and for tests ---------- */
  function tick(dt) {
    S.phase += dt;
    // round 7 (R6-01): the wait counter runs only while listening (or during the story); after Stopp it stays at 00:00
    if (ACTIVE[S.state] && (S.running || S.state !== 'waiting-real')) S.elapsed += dt;
    advanceClip(dt);
    fxUpdate(dt);
    stateStep();
    render();
  }

  /* ---------- frame loop (round 7, R6-01) ----------
     The rAF loop runs only while something moves: listening, a clip, a burst, a particle, the auto freeze, or a story state.
     In waiting or after Stopp (not listening) and in the alert it stops; the next state change starts it again (kick). */
  /* round 8 (N-R7-01): the loop is requestAnimationFrame, with a timer fallback. When rAF has not fired for 250 ms (a background
     tab, a throttled pane), the timer steps the story at about 30 steps a second instead, so the story still advances.
     The loop functions do not share a name with any element (the round-7 collision: frame was both the iframe and the loop). */
  var raf = null, timer = null, lastT = 0, lastRafT = 0;
  var MOVING = { 'pixelating': 1, 'human-detected': 1, 'un-pixel': 1, 'game-watch': 1, 'game-play': 1 };
  function needsFrames() { return !!(S.running || S.clip || S.fx.length || S.autoHuman || MOVING[S.state]); }
  function loopStep(now, cap) {
    var d = Math.min(cap, Math.max(0, now - lastT));
    lastT = now;
    tick(d);
  }
  // round 16 (REVIEW-1015 item 9): ONE clock source. Whichever fires first (a frame or the timer) steps the story by the REAL time since
  // the last step, so a slow frame clock (about 1 Hz) and a throttled timer both advance the story at real speed. No silence detection:
  // the cap is one minute only, so a long sleep does not jump past every state.
  function onRafTick(now) {
    raf = null;
    lastRafT = now;
    if (timer !== null) { clearTimeout(timer); timer = null; }
    loopStep(now, 60000);
    armLoop();
  }
  function onLoopTimer() {
    timer = null;
    loopStep(performance.now(), 60000);
    armLoop();
  }
  function armLoop() {
    // round 21 (I-3): a halted page (pagehide, unload) or a hidden page (the story is paused) arms no loop
    if (S.halted || S.paused || !needsFrames()) return;
    if (raf === null) raf = requestAnimationFrame(onRafTick);
    if (timer === null) timer = setTimeout(onLoopTimer, 33);
  }
  function kick() {
    if (manual) return;
    if (raf === null && timer === null) lastT = lastRafT = performance.now();
    armLoop();
  }

  /* ---------- round 21 (I-3): page lifecycle ----------
     pagehide and unload HALT the flow: the story loop stops (no timer, no frame), the audio context closes, and nothing reopens it.
     A hidden page PAUSES the story (its clock stops; the audio context is suspended) and resumes when the page is shown again.
     The simulator and the detector are released by index.html (pagehide: the microphone and the simulator; hidden: the microphone only). */
  function stopLoop() {
    if (raf !== null) { try { cancelAnimationFrame(raf); } catch (e) { /* none */ } raf = null; }
    if (timer !== null) { clearTimeout(timer); timer = null; }
  }
  function halt() {
    if (S.halted) return;
    S.halted = true;
    stopLoop();
    S.clip = null; S.autoHuman = false;
    releaseAudio();
  }
  window.addEventListener('pagehide', halt);
  window.addEventListener('unload', halt);
  document.addEventListener('visibilitychange', function () {
    if (S.halted) return;
    if (document.hidden) { S.paused = true; stopLoop(); suspendAudio(); }
    else { S.paused = false; lastT = lastRafT = performance.now(); kick(); }
  });

  /* ---------- wiring ---------- */
  for (var f = 0; f < 16; f++) {
    var cube = document.createElement('i');
    cube.className = 'fp ' + (f % 3 === 1 ? 'fp-w' : 'fp-y');
    cube.setAttribute('aria-hidden', 'true');
    fxBox.appendChild(cube);
  }
  var blob = document.createElement('i');
  blob.className = 'blob';
  blob.setAttribute('aria-hidden', 'true');
  tabs.insertBefore(blob, tabs.firstChild);

  var tabBtns = tabs.querySelectorAll('button[data-mode]');
  for (var t = 0; t < tabBtns.length; t++) {
    tabBtns[t].textContent = T.tabs[tabBtns[t].getAttribute('data-mode')];
    tabBtns[t].addEventListener('click', function () { pickMode(this.getAttribute('data-mode')); });
  }
  soundBtn.addEventListener('click', function () {
    S.soundOn = !S.soundOn;
    missionSend('game:sound', S.soundOn);
    render();
  });
  backBtn.textContent = T.back;
  backBtn.addEventListener('click', back);
  if (demoEl) demoEl.textContent = T.demo;
  hereBtn.textContent = T.here;
  hereBtn.addEventListener('click', function () { human('button'); });

  // round 12 (R11-05): the game frame does not request buddy-fonts.css again. The page's sheet is already loaded, so its rules are
  // copied into the frame's document (same origin). Without the page's sheet (or an old browser) the frame keeps its own fallback.
  // round 13 (R12-05): the game frame is as tall as its own content (the score line included). It is read from the frame whenever a game
  // state is shown: the frame's own size message can arrive late (a throttled pane, a hidden tab), and the score line was cut when it did.
  /* round 21 (F1): the stage grows to the game in game states. The game's own height (its runner shell, or the height it reports) is
     fitted into the space below the controls and above the viewport bottom (minus 16 px). The rows above the stage never move.
     At 0.85 or more of the game's height the whole game is shown, scaled down to fit (the keypad stays visible and tappable).
     Below that the frame keeps its size and the game scrolls inside it (320 px). Outside game states the stage has its own height again. */
  var gameH = 0, stageLaid = false;
  function fitFrame() {
    try {
      var doc = missionFrame.contentDocument;
      var shell = doc && doc.querySelector ? doc.querySelector('.runner-shell') : null;
      if (!shell) return;
      gameHeight(shell.getBoundingClientRect().height + 2);
    } catch (e) { /* the frame is not ready: it keeps its size */ }
  }
  function gameHeight(h) {
    h = Math.ceil(+h || 0);
    if (h < 60) return;
    gameH = h;
    layoutGame();
  }
  function layoutGame() {
    if (!GAME[S.state] || !gameH) {
      if (stageLaid) {
        scene.style.height = ''; missionFrame.style.height = ''; missionFrame.style.transform = ''; missionFrame.style.marginBottom = '';
        stageLaid = false;
      }
      return;
    }
    stageLaid = true;
    var top = scene.getBoundingClientRect().top;
    var vh = window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 800;
    var avail = Math.max(120, Math.floor(vh - top - 16));
    var s = Math.min(1, avail / gameH);
    if (s >= 0.85) {
      missionFrame.style.height = gameH + 'px';
      missionFrame.style.transformOrigin = '50% 0';
      missionFrame.style.transform = s < 1 ? 'scale(' + s.toFixed(3) + ')' : '';
      missionFrame.style.marginBottom = s < 1 ? (-(gameH * (1 - s))) + 'px' : '';
      scene.style.height = Math.ceil(gameH * s) + 'px';
    } else {
      missionFrame.style.height = avail + 'px';   // the game scrolls inside the frame (its own document scrolls)
      missionFrame.style.transform = '';
      missionFrame.style.marginBottom = '';
      scene.style.height = avail + 'px';
    }
  }

  function shareFonts() {
    try {
      var doc = missionFrame.contentDocument;
      if (!doc || !doc.head || doc.getElementById('shared-fonts')) return;
      var src = null;
      for (var i = 0; i < document.styleSheets.length; i++) {
        if ((document.styleSheets[i].href || '').indexOf('buddy-fonts.css') >= 0) { src = document.styleSheets[i]; break; }
      }
      if (!src) return;
      var css = '';
      for (var j = 0; j < src.cssRules.length; j++) css += src.cssRules[j].cssText + '\n';
      var st = doc.createElement('style');
      st.id = 'shared-fonts';
      st.textContent = css;
      doc.head.appendChild(st);
    } catch (e) { /* cross-origin or not loaded yet: the frame keeps its fallback */ }
  }
  if (missionFrame) { missionFrame.addEventListener('load', shareFonts); shareFonts(); }
  startBtn.textContent = T.start;
  startBtn.addEventListener('click', function () {
    try { window.dispatchEvent(new CustomEvent('dingsty:start')); } catch (e) { /* old browser: no restart */ }
  });
  noticeDemo.textContent = T.launchDemo;
  noticeDemo.addEventListener('click', function () {
    try { window.dispatchEvent(new CustomEvent('dingsty:demo')); } catch (e) { /* old browser: no demo */ }
  });
  againBtn.textContent = T.again;
  againBtn.addEventListener('click', function () {
    if (S.state === 'done') {
      S.gameLive = false; S.elapsed = 0; go('waiting-real');
      // round 8 (N-R7-03): Nochmal listens again. index.html starts the same session as the start control (same tap, same gesture).
      try { window.dispatchEvent(new CustomEvent('dingsty:again')); } catch (e) { /* old browser: the page keeps the stage text */ }
    }
  });
  canvas.addEventListener('click', function () {
    if (S.clip) S.clip.t = S.clip.dur; // tap the stage to skip the burst
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Esc') back();
  });
  var yesBtn = $('gotit'), noBtn = $('notit');
  if (yesBtn) yesBtn.textContent = T.yes;
  if (noBtn) noBtn.textContent = T.no;
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || e.source !== missionFrame.contentWindow) return;
    // a game freeze counts only in a game state (a stale echo during pixelating, or after the alert, is ignored)
    if (e.data.type === 'game:freeze' && GAME[S.state]) human('game');
    // Escape pressed while the game had focus: the game forwards it, the same as Stopp
    if (e.data.type === 'game:back') back();
    // round 9 (N-R8-06): the game's death line (empty when it ends) is shown in the caption
    // round 19 (review 1017 finding 3): 'game:notice' is accepted and ignored: the game's copy is not shown in the flow caption
    if (e.data.type === 'game:notice') { S.gameNotice = ''; }
    // the game silenced itself (tab hidden or window blurred): the Ton label follows the game, so it never says "on" while the game is silent
    if (e.data.type === 'game:sound' && e.data.value === false && S.soundOn) { S.soundOn = false; render(); }
    // round 5 (R4-09): the game's mode echo counts only in a game state, so a stale echo cannot overwrite the mode during pixelating
    if (GAME[S.state] && e.data.type === 'game:mode' && (e.data.value === 'watch' || e.data.value === 'play') && e.data.value !== S.mode) {
      S.mode = e.data.value;
      go(S.mode === 'play' ? 'game-play' : 'game-watch');
      render();
    }
  });
  window.addEventListener('resize', placeBlob);
  // round 14 (N13-02): a live resize reflows the game frame after this event, and its own size message can come a step later.
  // In a game state the frame is refitted now, in the next frame and after 300 ms, so the card follows the game at once.
  window.addEventListener('resize', function () {
    if (GAME[S.state]) { fitFrame(); layoutGame(); requestAnimationFrame(fitFrame); setTimeout(fitFrame, 300); }
    else if (stageLaid) layoutGame();
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeBlob);
  $('mission-card').open = true;
  // Round 5 (R4-04): no timer and no idle preload. Only the first frame (the stage character) is fetched at first paint.
  frameAt('burst', 0);
  var launchDemo = $('launch-demo');
  if (launchDemo) {
    launchDemo.textContent = T.launchDemo;
    launchDemo.addEventListener('click', function () {
      $('desktop-launch').hidden = true; $('phone-launch').hidden = true; $('listening-ui').hidden = false;
      $('sim').click(); // the existing no-mic demo path (same analyser, no microphone prompt)
    });
  }
  statusEl.textContent = T.stage.s; // the page HTML ships the start hint; the flow owns the stage copy from the first paint
  hintEl.textContent = T.stage.h;

  /* ---------- public API used by index.html ---------- */
  window.DingstyFlow = {
    version: 3,
    listening: listening,
    pending: pending,
    human: human,
    resume: resume,
    done: done,
    back: back,
    setDemo: setDemo,
    notice: notice,
    demoVoice: demoVoice,
    gameHeight: gameHeight, // round 21 (F1): the game reports its height ('dingsty:widget-size' via index.html)
    // round 21 (F2): a failed start (denial, timeout, no microphone) drops a mode that waited for the detector: no story without a detector
    dropPending: function () { S.pendingMode = null; },
    ownsText: function () { return true; }, // the flow writes the stage headline and hint; the detector does not overwrite them
    state: function () { return S.state; }
  };

  /* ---------- documented game hook (for the next game) ----------
     Commands the page sends to the game (postMessage, version 1):
       'game:mode'    value 'watch' | 'play'
       'game:sound'   value true | false
       'game:resume'  continue after a freeze
       'dingsty:signal'  human detected: the game freezes and answers 'game:freeze'
       'dingsty:listening' value true | false  (existing)
     Events the game sends to the page:
       'game:start'   value = mode, once the game has started
       'game:freeze'  the game froze (its own demo alert, or 'dingsty:signal')
       'game:mode'    value = mode, when the player changes it inside the game (tap or key)
       'game:resume'  the game continued
       'game:back'    the player pressed Escape inside the game (same as Stopp)
     A new game plugs in by answering these messages in its own page. */
  window.__dingstyGameHook = {
    version: 3,
    setMode: function (m) { pickMode(m); },
    setSound: function (on) { S.soundOn = !!on; missionSend('game:sound', S.soundOn); render(); },
    freeze: function () { human('game'); },
    resume: function () { resume(); },
    events: ['game:start', 'game:freeze', 'game:mode', 'game:resume', 'game:back']
  };

  /* ---------- clock ---------- */
  if (manual) {
    window.__step = function (ms) {
      var left = Math.max(0, ms);
      while (left > 0) { var d = Math.min(16, left); tick(d); left -= d; }
      return S.state;
    };
    window.__flowInfo = function () {
      return { state: S.state, prev: S.prev, phase: S.phase, elapsed: S.elapsed, clipT: S.clip ? S.clip.t : null,
               drawName: S.clip ? S.clip.name : null, drawIdx: S.drawIdx, mode: S.mode, soundOn: S.soundOn,
               autoHuman: S.autoHuman, fxLive: S.fx.length, scene: scene.getAttribute('data-state'), demo: S.demo };
    };
    window.__flowSeek = function (name, idx) { preload(name); draw(name, idx); };
    render();
  } else {
    render();
    kick();
  }
})();
