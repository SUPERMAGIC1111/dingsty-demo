/* Glue for the copied phone flow (anruf/index.html is byte-identical except for the one
   script line that loads this file). With flow=both it shows one line that refers to the
   hotline sentence from the letter. Nothing else changes. */
(function(){
  var q = new URLSearchParams(location.search);
  var raw = q.get('lang');
  var L = (raw === 'en' || raw === 'es') ? raw : 'de';
  if (q.get('flow') !== 'both') return;
  var TXT = {
    de: 'Brief fertig. Den Satz für die Hotline hast du im Brief.',
    en: 'Letter done. The sentence for the hotline is in the letter.',
    es: 'Carta lista. La frase para la línea está en la carta.'
  };
  var p = document.createElement('p');
  p.className = 'dx-flowhint';
  p.textContent = TXT[L];
  p.style.cssText = 'margin:8px 16px;padding:12px 16px;border-radius:20px;background:#fffdf8;color:#33332f;font:500 15px/1.4 "Elms Sans",ui-sans-serif,system-ui,sans-serif;';
  var tb = document.querySelector('.dx-tb');
  if (tb && tb.parentNode) tb.parentNode.insertBefore(p, tb.nextSibling);
})();
