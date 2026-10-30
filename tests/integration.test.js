const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const home = read('index.html');
const landing = read('landing.js');
const css = read('landing.css');
const briefGlue = read('brief/brief-glue.js');
const brief = read('brief/index.html');
const phone = read('anruf/index.html');
const gameRuntime = read('anruf/mission/runtime.js');
const gameCss = read('anruf/mission/style.css');

test('entry offers exactly the two working, language-preserving destinations', () => {
  assert.match(home, /id="brief-choice"/);
  assert.match(home, /id="phone-choice"/);
  assert.match(landing, /brief\/index\.html\?lang=/);
  assert.match(landing, /anruf\/index\.html\?demo=1&lang=/);
  assert.doesNotMatch(landing, /flow=both|wahl=1|#\s*$/);
});

test('all three languages localize route links and accessible path labels', () => {
  for (const locale of ['de', 'en', 'es']) {
    assert.match(landing, new RegExp(locale + ': \\{'));
  }
  assert.match(landing, /choiceLabel:/);
  assert.match(landing, /setAttribute\('aria-label',t\.choiceLabel\)/);
  assert.match(landing, /aria-pressed/);
});

test('entry makes the no-send, no-call and simulated phone limits explicit', () => {
  for (const claim of ['sendet nichts', 'ruft niemanden an', 'sends nothing', 'calls nobody', 'no envía nada', 'ni llama a nadie']) {
    assert.ok(landing.toLowerCase().includes(claim.toLowerCase()), `missing copy: ${claim}`);
  }
  assert.match(landing, /demo=1/);
});

test('no personal data is captured or persisted by the entry page', () => {
  assert.doesNotMatch(home, /<input|<textarea|<form/i);
  assert.doesNotMatch(landing, /localStorage|sessionStorage|fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/i);
  assert.match(landing, /history\.replaceState/); // only language code is mirrored in the URL
});

test('approved cards keep local artwork, responsive widths and reduced-motion support', () => {
  for (const asset of ['assets/dingsty-paper-plane-cutout.png', 'assets/dingsty-phone-cutout.png']) {
    assert.ok(fs.statSync(path.join(root, asset)).size > 1000, `missing or empty artwork: ${asset}`);
    assert.ok(home.includes(asset));
  }
  assert.match(css, /\.choices\{[^}]*margin-top:80px/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(css, /@media\(max-width:360px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('Brief receives requested Spanish rather than being forced to English', () => {
  assert.match(briefGlue, /languageClicks = L === 'en' \? 1 : \(L === 'es' \? 2 : 0\)/);
  assert.match(brief, /var ES=/);
  assert.match(brief, /Paso 3 de 5/);
});

test('Brief reduced motion disables every page animation and transition', () => {
  assert.match(brief, /@media \(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation:none!important;transition:none!important;scroll-behavior:auto!important\}\}/);
});

test('Brief keeps an editable, device-local draft until the explicit reset action', () => {
  assert.match(brief, /id="letter" contenteditable="true"/);
  assert.match(brief, /dingsty-paket-draft-v1/);
  assert.match(brief, /localStorage\.setItem/);
  assert.match(brief, /localStorage\.removeItem/);
  assert.match(brief, /manualText/);
  assert.match(brief, /Dein Entwurf bleibt nur auf diesem Gerät/);
});

test('phone demo visibly declares that it never places a real call', () => {
  assert.match(phone, /demo-route/);
  assert.match(phone, /DEMO \/ SIMULATION/);
  assert.match(phone, /kein echter Anruf, keine Nummer, kein Mikrofon/);
});

test('legacy microphone experiments immediately route to the approved simulated phone preview', () => {
  for (const legacy of ['hold-buddy/index.html', 'next/index.html']) {
    const source = read(legacy);
    assert.match(source, /http-equiv="refresh" content="0; url=\.\.\/anruf\/index\.html\?demo=1"/);
    assert.match(source, /location\.replace\('\.\.\/anruf\/index\.html\?demo=1'/);
    assert.ok(source.indexOf("location.replace('../anruf/index.html?demo=1'") < source.indexOf('getUserMedia'), `${legacy} redirects before legacy microphone code`);
  }
});

test('real five-step Brief and existing game remain linked in the waiting demo', () => {
  assert.match(brief, /5\/5/);
  assert.match(phone, /id="mission-frame"/);
  assert.match(phone, /id="mission-frame"[^>]*src="about:blank"/);
  assert.match(phone, /mission\.src='mission\/index\.html\?lang='/);
  assert.ok(phone.includes('if(demoRoute)startSim();else startMic()'), 'demo route must use simulation, not microphone start');
});

test('existing return links preserve only the chosen language', () => {
  assert.match(read('shared/topbar.js'), /\.\.\/index\.html\?lang=' \+ L/);
});

test('game honors reduced motion and explains why play is paused', () => {
  assert.match(gameRuntime, /prefers-reduced-motion: reduce/);
  assert.match(gameRuntime, /function startLoop\(\) \{ if \(!reduced\(\)/);
  assert.match(gameRuntime, /motionChange\(\)/);
  assert.match(gameRuntime, /el\.play\.disabled = stopped \|\| \(reduced\(\)/);
  assert.match(gameRuntime, /Reduce Motion is on/);
  assert.match(gameCss, /prefers-reduced-motion:reduce/);
});

test('rolling letter clones do not duplicate Brief button names for assistive technology', () => {
  assert.match(brief, /Keep rolling-letter visual clones out of accessible names/);
  assert.match(brief, /el\.setAttribute\('aria-label',name\)/);
});
