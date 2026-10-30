/* Glue for the copied Paket Brief (brief/index.html is byte-identical except for the one
   script line that loads this file). It only clicks the Brief's own controls:
   - language: lets the Brief's own DE/EN/ES route handling select the requested language
   - optional pre-selected problem chip: clicks the Brief's own chip (lost / damaged) once
   - "Beides" path: adds a "Jetzt anrufen" link at the end of step 5 (5/5) */
(function(){
  var q = new URLSearchParams(location.search);
  var raw = q.get('lang');
  var L = (raw === 'en' || raw === 'es') ? raw : 'de';
  var languageClicks = L === 'en' ? 1 : (L === 'es' ? 2 : 0);
  var ISSUE = { nicht: 'lost', beschaedigt: 'damaged' };
  var chip = q.get('case') || '';
  var pending = ISSUE[chip] || null;
  var both = q.get('flow') === 'both';
  var langDone = languageClicks === 0;
  var CALL = { de: 'Jetzt anrufen', en: 'Call now', es: 'Llamar ahora' };
  var win = document.getElementById('win');

  function step(){
    if (!langDone && document.getElementById('lang')) {
      langDone = true;
      for (var i = 0; i < languageClicks; i++) {
        var lb = document.getElementById('lang');
        if (lb) lb.click();
      }
    }
    if (pending && document.querySelector('[data-issue]')) {
      var c = document.querySelector('[data-issue="' + pending + '"]');
      pending = null;
      if (c && !c.classList.contains('on')) c.click();
    }
    var p = document.querySelector('.pill');
    if (both && win && p && p.textContent.trim() === '5/5' && !document.getElementById('dx-call')) {
      var wrap = document.createElement('div');
      wrap.id = 'dx-call';
      wrap.style.cssText = 'margin:14px 0 6px;';
      var a = document.createElement('a');
      a.href = '../anruf/index.html?lang=' + L + '&case=' + encodeURIComponent(chip) + '&flow=both';
      a.textContent = CALL[L] + ' →';
      a.style.cssText = 'display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;min-height:48px;padding:0 22px;border-radius:999px;background:#fff200;color:#33332f;font:600 16px/20px Geist,ui-sans-serif,system-ui,sans-serif;text-decoration:none;';
      wrap.appendChild(a);
      win.appendChild(wrap);
    }
  }

  var css = document.createElement('style');
  css.textContent = '.corner{display:none !important}';
  document.head.appendChild(css);
  var icon = document.createElement('link');
  icon.rel = 'icon';
  icon.href = 'data:,';
  document.head.appendChild(icon);
  if (win) new MutationObserver(step).observe(win, { childList: true, subtree: true });
  // The observer can fire before the Brief has updated its step counter, so poll as well (cheap, idempotent)
  setInterval(step, 300);
  step();
})();
