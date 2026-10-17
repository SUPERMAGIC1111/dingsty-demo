/* Pure handoff rules. Destinations mirror contacts-verified.json; no network requests. */
(function (root) {
  var carriers = {
    DHL: { verified: true, url: 'https://www.dhl.de/de/privatkunden/hilfe-kundenservice.html', phone: '0228 4333112' },
    Hermes: { verified: true, url: 'https://www.myhermes.de/service/kontakt/' },
    DPD: { verified: true, url: 'https://www.dpd.com/de/de/support/empfaenger/' },
    GLS: { verified: false }, UPS: { verified: false }, 'Deutsche Post': { verified: false }
  };
  var words = {
    de: { shop: 'Schick den Text an den Händler', shopHelp: 'Sende den Entwurf selbst per E-Mail oder Kontaktformular im Shop. Wenn du eine Sendungsnummer bekommst, kommst du hierher zurück.', carrier: 'Kontakt mit {carrier}', unknown: 'Wohin soll der Text?', noSend: 'Dingsty verschickt nichts.', copy: 'Text kopieren', copied: 'Kopiert', notCopied: 'Nicht kopiert', manual: 'Bitte markiere den Text und kopiere ihn selbst.', open: 'Kontaktseite von {carrier} öffnen', unverified: 'Für diesen Zusteller haben wir noch keine geprüfte Kontaktseite', ask: 'Trag den Zusteller ein oder kopiere den Text.', call: 'Lieber anrufen?', dial: 'Anrufen', ownCall: 'Du führst das Gespräch selbst. Dingsty ruft nicht für dich an.', dated: 'Stand 10.10.2026, nicht heute geprüft', listen: 'Anruftext anhören', returned: 'Hast du den Text abgeschickt?', yes: 'Ja', no: 'Noch nicht', neutral: 'Du kannst den Text weiter bearbeiten oder später abschicken.', next: 'Weiter: Was kommt danach?' },
    en: { shop: 'Send the text to the shop', shopHelp: 'Send the draft yourself by email or through the shop contact form. If you get a tracking number, come back here.', carrier: 'Contact {carrier}', unknown: 'Where should the text go?', noSend: 'Dingsty does not send anything.', copy: 'Copy text', copied: 'Copied', notCopied: 'Not copied', manual: 'Select the text and copy it manually.', open: 'Open {carrier} contact page', unverified: 'We do not yet have a verified contact page for this carrier', ask: 'Enter the carrier or copy the text.', call: 'Prefer to call?', dial: 'Call', ownCall: 'You make the call yourself. Dingsty does not call for you.', dated: 'As of 10 Oct 2026, not checked today', listen: 'Listen to the call script', returned: 'Did you send the text?', yes: 'Yes', no: 'Not yet', neutral: 'You can keep editing the text or send it later.', next: 'Next: what comes after?' },
    es: { shop: 'Envía el texto a la tienda', shopHelp: 'Envía el borrador tú mismo por correo o mediante el formulario de contacto de la tienda. Si recibes un número de seguimiento, vuelve aquí.', carrier: 'Contacto con {carrier}', unknown: '¿A quién va el texto?', noSend: 'Dingsty no envía nada.', copy: 'Copiar texto', copied: 'Copiado', notCopied: 'No copiado', manual: 'Selecciona el texto y cópialo manualmente.', open: 'Abrir la página de contacto de {carrier}', unverified: 'Todavía no tenemos una página de contacto verificada para este transportista', ask: 'Indica el transportista o copia el texto.', call: '¿Prefieres llamar?', dial: 'Llamar', ownCall: 'Tú haces la llamada. Dingsty no llama por ti.', dated: 'Actualizado el 10.10.2026, no comprobado hoy', listen: 'Escuchar el texto de la llamada', returned: '¿Has enviado el texto?', yes: 'Sí', no: 'Aún no', neutral: 'Puedes seguir editando el texto o enviarlo más tarde.', next: 'Siguiente: ¿qué viene después?' }
  };
  function fill(s, data) { return s.replace(/\{(\w+)\}/g, function (_, k) { return data[k] || ''; }); }
  var issueSentences = {
    de: { home: 'Der Zusteller hat mich laut Status nicht angetroffen, obwohl ich zu Hause war.', lost: 'Die Sendung ist nicht angekommen.', damaged: 'Die Sendung ist beschädigt angekommen.', late: 'Die Sendung ist deutlich verspätet.', notmet: 'Die Sendung wurde als nicht zustellbar gemeldet.' },
    en: { home: 'According to the status, the driver did not meet me although I was at home.', lost: 'The parcel has not arrived.', damaged: 'The parcel arrived damaged.', late: 'The parcel is significantly delayed.', notmet: 'The parcel was reported as undeliverable.' },
    es: { home: 'Según el estado, el repartidor no me encontró aunque yo estaba en casa.', lost: 'El envío no ha llegado.', damaged: 'El envío llegó dañado.', late: 'El envío lleva un retraso importante.', notmet: 'El envío se informó como no entregable.' }
  };
  function callScript(lang, carrier, tracking, issue) {
    var l = issueSentences[lang] ? lang : 'de', issueSentence = issueSentences[l][issue] || issueSentences[l].lost;
    if (l === 'de') return 'Guten Tag, ich rufe wegen einer Sendung mit ' + carrier + ' an.' + (tracking ? ' Meine Sendungsnummer ist ' + tracking + '.' : '') + ' ' + issueSentence + ' Können Sie mir bitte helfen?';
    if (l === 'es') return 'Buenos días, llamo por un envío con ' + carrier + '.' + (tracking ? ' Mi número de seguimiento es ' + tracking + '.' : '') + ' ' + issueSentence + ' ¿Puede ayudarme, por favor?';
    return 'Hello, I am calling about a parcel with ' + carrier + '.' + (tracking ? ' My tracking number is ' + tracking + '.' : '') + ' ' + issueSentence + ' Could you please help me?';
  }
  function plan(input) {
    input = input || {}; var lang = words[input.lang] ? input.lang : 'de', w = words[lang], carrier = input.carrier || '', c = carriers[carrier];
    var shop = !!(input.noNum || input.online);
    if (shop) return { kind: 'shop', heading: w.shop, shopHelp: w.shopHelp, noSend: w.noSend, copy: w.copy };
    if (!carrier || !c) return { kind: 'unknown', heading: w.unknown, noSend: w.noSend, copy: w.copy, note: w.ask };
    var out = { kind: c.verified ? 'verified' : 'unverified', heading: fill(w.carrier, { carrier: carrier }), noSend: w.noSend, copy: w.copy, carrier: carrier };
    if (c.verified) { out.url = c.url; out.open = fill(w.open, { carrier: carrier }); }
    else out.note = w.unverified;
    if (c.phone) { out.phone = c.phone; out.call = w.call; out.dial = w.dial; out.ownCall = w.ownCall; out.dated = w.dated; out.listen = w.listen; out.script = callScript(lang, carrier, input.tracking, input.issue); }
    return out;
  }
  function copyCurrent(text, write, currentText) {
    // A WebKit/manual fallback returns false when it could not copy.  A fulfilled
    // clipboard promise without a value is still a successful write.
    return Promise.resolve(write(text)).then(function (wrote) {
      return wrote !== false && currentText() === text;
    }, function () { return false; });
  }
  function copyFailureHint(lang) {
    var w = words[words[lang] ? lang : 'de'];
    return w.notCopied + '. ' + w.manual;
  }
  function copyResult(lang, ok) {
    var w = words[words[lang] ? lang : 'de'];
    return { label: ok ? w.copied : w.notCopied, hint: ok ? '' : copyFailureHint(lang) };
  }
  function localizeDate(lang, value) {
    var language = words[lang] ? lang : 'de';
    var key = String(value || '').trim().toLowerCase();
    var dates = {
      gestern: { de: 'gestern', en: 'yesterday', es: 'ayer' },
      heute: { de: 'heute', en: 'today', es: 'hoy' },
      vorgestern: { de: 'vorgestern', en: 'the day before yesterday', es: 'anteayer' },
      'letzte woche': { de: 'letzte Woche', en: 'last week', es: 'la semana pasada' }
    };
    return dates[key] ? dates[key][language] : value;
  }
  function transition(state, action) {
    var next = Object.assign({}, state);
    if (action === 'back') next.step = Math.max(1, state.step - 1);
    if (action === 'sent' || action === 'notSent') next.handoffAnswer = action;
    return next;
  }
  root.DingstyHandoff = { plan: plan, callScript: callScript, copyCurrent: copyCurrent, copyFailureHint: copyFailureHint, copyResult: copyResult, localizeDate: localizeDate, transition: transition, carriers: carriers, words: words, issueSentences: issueSentences };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.DingstyHandoff;
})(typeof window !== 'undefined' ? window : globalThis);
