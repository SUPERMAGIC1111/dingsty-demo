/* Shared top bar for the copied parts (brief, anruf) and the legal drafts.
   Adds one bar at the top of the page: wordmark (back to the landing), Test-Version badge, Start pill.
   Language is read from ?lang= only (de, en, es); nothing is stored. */
(function(){
  var q = new URLSearchParams(location.search);
  var raw = q.get('lang');
  var L = (raw === 'en' || raw === 'es') ? raw : 'de';
  var css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '../assets/shared.css';
  document.head.appendChild(css);
  var T = { de: ['Start', 'Test-Version'], en: ['Start', 'Test version'], es: ['Inicio', 'Versión de prueba'] }[L];
  function el(tag, cls, text){
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  var bar = el('header', 'dx-tb');
  var wm = el('a', 'dx-wm', 'dingsty');
  wm.href = '../index.html?lang=' + L;
  wm.setAttribute('aria-label', 'Dingsty Start');
  wm.appendChild(el('span', 'dx-sl', '///'));
  wm.lastChild.setAttribute('aria-hidden', 'true');
  var right = el('div', 'dx-tb-r');
  right.appendChild(el('span', 'dx-badge', T[1]));
  var start = el('a', 'dx-pill', T[0]);
  start.href = '../index.html?lang=' + L;
  right.appendChild(start);
  bar.appendChild(wm);
  bar.appendChild(right);
  document.body.insertBefore(bar, document.body.firstChild);
  document.body.classList.add('dx-has-bar');
})();
