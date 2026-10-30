(function(){
  'use strict';
  var LANGS = ['de', 'en', 'es'];
  var COPY = {
    de: {
      badge:'Test-Version', brand:'Dingsty Paket — Start', choiceLabel:'Wähle einen Weg', eyebrow:'Dingsty Paket', title:'Was hilft dir jetzt?',
      sub:'Wähle Briefhilfe oder eine kleine Übung für die Warteschleife.',
      boundary:'Dingsty sendet nichts und ruft niemanden an. Die Telefon-Demo ist simuliert.',
      brief:'Briefhilfe', briefDesc:'Fünf Schritte bis zu einem bearbeitbaren Brief. Du prüfst und sendest selbst.', briefAction:'Zum Brief →',
      phone:'Warten am Telefon', phoneDesc:'Simulierte Warteschleife mit optionalem Spiel. Kein echter Anruf; das Mikrofon bleibt aus.', phoneAction:'Demo öffnen →',
      briefMeta:'Ca. 5 Min. · Ergebnis: ein Brief zum Bearbeiten', phoneMeta:'Ca. 2 Min. · Ergebnis: weniger Stress beim Warten', hint:'Unsicher? Starte mit der Briefhilfe.',
      note:'Dein Briefentwurf bleibt nur in diesem Browser auf diesem Gerät, bis du „Neuer Fall“ wählst. Keine Cookies; deine Eingaben werden nicht übertragen.',
      privacy:'Datenschutz', legal:'Impressum', contact:'Kontakt', less:'Weniger Stress. Mehr Klarheit.'
    },
    en: {
      badge:'Test version', brand:'Dingsty Paket — Start', choiceLabel:'Choose a path', eyebrow:'Dingsty Paket', title:'What would help right now?',
      sub:'Choose letter help or a small hold-loop game.',
      boundary:'Dingsty sends nothing and calls nobody. The phone experience is simulated.',
      brief:'Letter help', briefDesc:'Five steps to an editable letter. You review it and send it yourself.', briefAction:'Open letter help →',
      phone:'Waiting by phone', phoneDesc:'A simulated hold loop with an optional game. No real call; the microphone stays off.', phoneAction:'Open demo →',
      briefMeta:'About 5 min · Result: an editable letter', phoneMeta:'About 2 min · Result: less stress while you wait', hint:'Not sure? Start with letter help.',
      note:'Your letter draft stays only in this browser on this device until you choose “New case”. No cookies; your entries are not transmitted.',
      privacy:'Privacy', legal:'Legal notice', contact:'Contact', less:'Less stress. More clarity.'
    },
    es: {
      badge:'Versión de prueba', brand:'Dingsty Paket — Inicio', choiceLabel:'Elige una opción', eyebrow:'Dingsty Paket', title:'¿Qué te ayudaría ahora?',
      sub:'Elige ayuda para escribir una carta o un pequeño juego de espera.',
      boundary:'Dingsty no envía nada ni llama a nadie. La experiencia telefónica es simulada.',
      brief:'Ayuda con la carta', briefDesc:'Cinco pasos para preparar una carta editable. Tú la revisas y la envías.', briefAction:'Abrir ayuda →',
      phone:'Esperar al teléfono', phoneDesc:'Una espera simulada con un juego opcional. Sin llamada real; el micrófono permanece apagado.', phoneAction:'Abrir demo →',
      briefMeta:'Unos 5 min · Resultado: una carta editable', phoneMeta:'Unos 2 min · Resultado: menos estrés en la espera', hint:'¿No estás segura? Empieza con la ayuda para la carta.',
      note:'El borrador permanece solo en este navegador y dispositivo hasta que elijas “Nuevo caso”. Sin cookies; tus datos no se transmiten.',
      privacy:'Privacidad', legal:'Aviso legal', contact:'Contacto', less:'Menos estrés. Más claridad.'
    }
  };
  function $(id){ return document.getElementById(id); }
  function validLang(value){ return LANGS.indexOf(value) >= 0 ? value : 'de'; }
  var initial = new URLSearchParams(location.search);
  var lang = validLang(initial.get('lang'));

  function setText(id, value){ var node = $(id); if (node) node.textContent = value; }
  function render(){
    var t = COPY[lang];
    document.documentElement.lang = lang;
    document.title = 'Dingsty Paket — ' + t.title;
    $('brand').setAttribute('aria-label',t.brand);
    $('choices').setAttribute('aria-label',t.choiceLabel);
    setText('badge',t.badge); setText('eyebrow',t.eyebrow); setText('h1',t.title);
    setText('sub',t.sub); setText('boundary',t.boundary);
    setText('brief-title',t.brief); setText('brief-desc',t.briefDesc); setText('brief-action',t.briefAction);
    setText('phone-title',t.phone); setText('phone-desc',t.phoneDesc); setText('phone-action',t.phoneAction);
    setText('brief-meta',t.briefMeta); setText('phone-meta',t.phoneMeta); setText('hint',t.hint);
    setText('note',t.note); setText('l-datenschutz',t.privacy); setText('l-impressum',t.legal);
    setText('l-kontakt',t.contact); setText('weniger',t.less);
    document.querySelectorAll('[data-lang]').forEach(function(button,index){
      button.setAttribute('aria-pressed',button.getAttribute('data-lang') === lang ? 'true' : 'false');
      button.tabIndex = button.getAttribute('data-lang') === lang ? 0 : -1;
    });
    var thumb = document.querySelector('.dx-seg-thumb');
    if (thumb) thumb.style.transform = 'translateX(' + (LANGS.indexOf(lang)*100) + '%)';
    $('brief-choice').href = 'brief/index.html?lang=' + lang;
    $('phone-choice').href = 'anruf/index.html?demo=1&lang=' + lang;
    $('l-datenschutz').href = 'legal/datenschutz.html?lang=' + lang;
    $('l-impressum').href = 'legal/impressum.html?lang=' + lang;
    $('l-kontakt').href = 'legal/kontakt.html?lang=' + lang;
    try { history.replaceState(null,'','?lang=' + lang); } catch (_) {}
  }
  document.querySelector('.dx-seg').addEventListener('click',function(event){
    var button = event.target.closest('[data-lang]');
    if (!button) return;
    lang = validLang(button.getAttribute('data-lang'));
    render();
  });
  document.querySelector('.dx-seg').addEventListener('keydown',function(event){
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    var current = LANGS.indexOf(lang);
    current = (current + (event.key === 'ArrowRight' ? 1 : LANGS.length - 1)) % LANGS.length;
    lang = LANGS[current]; render();
    var active = document.querySelector('[data-lang="' + lang + '"]');
    if (active) active.focus();
    event.preventDefault();
  });
  render();
})();
