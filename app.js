const SPEICHER = 'adventskalender-geoeffnet-';
const REIHENFOLGE = [14, 3, 22, 9, 24, 1, 17, 11, 5, 19, 8, 13, 2, 6, 20, 16, 10, 23, 4, 12, 18, 7, 21, 15];
const GROSS = [6, 24];

let daten = null;

function el(tag, attrs = {}, kinder = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'text') e.textContent = v;
    else if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const kind of [].concat(kinder)) if (kind) e.append(kind);
  return e;
}

function punkteText(n) {
  return Math.abs(n) === 1 ? `${n} Punkt` : `${n} Punkte`;
}

function vorschau() {
  return new URLSearchParams(location.search).has('vorschau');
}

function geoeffnetLesen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SPEICHER + daten.jahr) || '[]'));
  } catch {
    return new Set();
  }
}

function geoeffnetSpeichern(menge) {
  try {
    localStorage.setItem(SPEICHER + daten.jahr, JSON.stringify([...menge]));
  } catch {}
}

function offenBis() {
  if (vorschau()) return 24;
  const jetzt = new Date();
  const jahr = jetzt.getFullYear();
  if (jahr > daten.jahr) return 24;
  if (jahr < daten.jahr || jetzt.getMonth() < 11) return 0;
  return Math.min(jetzt.getDate(), 24);
}

function istHeute(tag) {
  const jetzt = new Date();
  return jetzt.getFullYear() === daten.jahr && jetzt.getMonth() === 11 && jetzt.getDate() === tag;
}

function tageBis(tag) {
  const ziel = new Date(daten.jahr, 11, tag);
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  return Math.round((ziel - heute) / 86400000);
}

function punktestand() {
  return (daten.verlauf || []).reduce((summe, e) => summe + Number(e.punkte || 0), 0);
}

function stufen() {
  return [...(daten.praemien || [])].sort((a, b) => a.punkte - b.punkte);
}

function dialogZeigen({ badge, titel, text, hinweis, aktionen = [] }) {
  const dialog = document.getElementById('dialog');
  const inhalt = dialog.querySelector('.dialog-inhalt');
  const knoepfe = aktionen.map((a) =>
    el('button', {
      class: a.primaer ? 'knopf primaer' : 'knopf',
      value: a.label,
      onclick: a.aktion,
      text: a.label
    })
  );
  knoepfe.push(el('button', { class: 'knopf', value: 'schliessen', text: aktionen.length ? 'Abbrechen' : 'Schließen' }));
  inhalt.replaceChildren(
    badge ? el('span', { class: 'dialog-badge', text: badge }) : null,
    el('h3', { id: 'dialog-titel', text: titel }),
    text ? el('p', { class: 'dialog-text', text }) : null,
    hinweis ? el('p', { class: 'dialog-hinweis', text: hinweis }) : null,
    el('div', { class: 'dialog-knoepfe' }, knoepfe)
  );
  dialog.showModal();
}

function zaehlen(ziel) {
  const ausgabe = document.getElementById('punkte');
  const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (ruhig || ziel <= 0) {
    ausgabe.textContent = String(ziel);
    return;
  }
  const start = performance.now();
  const dauer = 900;
  const schritt = (zeit) => {
    const anteil = Math.min((zeit - start) / dauer, 1);
    ausgabe.textContent = String(Math.round(ziel * (1 - Math.pow(1 - anteil, 3))));
    if (anteil < 1) requestAnimationFrame(schritt);
  };
  requestAnimationFrame(schritt);
}

function kontoZeigen() {
  const stand = punktestand();
  zaehlen(stand);
  const naechste = stufen().find((s) => s.punkte > stand);
  const balken = document.getElementById('fortschritt');
  const text = document.getElementById('naechste');
  if (naechste) {
    balken.style.width = `${Math.max(0, Math.min(100, (stand / naechste.punkte) * 100))}%`;
    text.textContent = stand > 0
      ? `Noch ${punkteText(naechste.punkte - stand)} bis zur ${naechste.punkte}-Punkte-Prämie`
      : 'Öffne Türchen, erledige Aufgaben und sammle deine ersten Punkte';
  } else {
    balken.style.width = '100%';
    text.textContent = 'Du kannst dir jede Prämie aussuchen!';
  }
}

function tuerKlick(tag) {
  const aufgabe = (daten.aufgaben || []).find((a) => a.tag === tag);
  if (tag > offenBis()) {
    const tage = tageBis(tag);
    dialogZeigen({
      badge: 'Noch nicht',
      titel: `Türchen ${tag}`,
      text: tage === 1 ? 'Dieses Türchen darfst du morgen öffnen.' : `Dieses Türchen darfst du in ${tage} Tagen öffnen.`,
      hinweis: 'Ein bisschen Geduld gehört zum Advent dazu.'
    });
    return;
  }
  const offen = geoeffnetLesen();
  offen.add(tag);
  geoeffnetSpeichern(offen);
  tuerenZeigen();
  dialogZeigen({
    badge: aufgabe && aufgabe.punkte ? `+${punkteText(aufgabe.punkte)}` : null,
    titel: `Türchen ${tag}`,
    text: aufgabe ? aufgabe.text : 'Hinter diesem Türchen ist heute eine Überraschung.',
    hinweis: aufgabe && aufgabe.hinweis ? aufgabe.hinweis : 'Sobald die Aufgabe erledigt ist, bekommst du die Punkte gutgeschrieben.'
  });
}

function tuerenZeigen() {
  const container = document.getElementById('tueren');
  const bis = offenBis();
  const offen = geoeffnetLesen();
  const tueren = REIHENFOLGE.map((tag) => {
    const aufgabe = (daten.aufgaben || []).find((a) => a.tag === tag);
    const gesperrt = tag > bis;
    const geoeffnet = !gesperrt && offen.has(tag);
    const klassen = ['tuer', `farbe-${tag % 3}`];
    if (GROSS.includes(tag)) klassen.push('gross');
    if (gesperrt) klassen.push('gesperrt');
    if (geoeffnet) klassen.push('offen');
    if (!gesperrt && !geoeffnet && istHeute(tag)) klassen.push('heute');
    const label = gesperrt
      ? `Türchen ${tag}, noch geschlossen`
      : geoeffnet ? `Türchen ${tag} noch einmal ansehen` : `Türchen ${tag} öffnen`;
    return el('button', {
      type: 'button',
      class: klassen.join(' '),
      'aria-label': label,
      onclick: () => tuerKlick(tag)
    }, [
      el('span', { text: String(tag), 'aria-hidden': 'true' }),
      geoeffnet && aufgabe && aufgabe.punkte
        ? el('span', { class: 'tuer-punkte', text: punkteText(aufgabe.punkte), 'aria-hidden': 'true' })
        : null
    ]);
  });
  container.replaceChildren(...tueren);
}

function nachrichtSenden(praemie, punkte) {
  const kontakt = daten.kontakt || {};
  const text = `Ich möchte eine Prämie einlösen: ${praemie} (${punkteText(punkte)})`;
  if (kontakt.whatsapp) {
    const nummer = String(kontakt.whatsapp).replace(/\D/g, '');
    window.open(`https://wa.me/${nummer}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  } else if (kontakt.email) {
    location.href = `mailto:${kontakt.email}?subject=${encodeURIComponent('Prämie einlösen')}&body=${encodeURIComponent(text)}`;
  }
}

function einloesen(praemie, punkte) {
  const kontakt = daten.kontakt || {};
  const absender = daten.absender || 'mir';
  const erreichbar = Boolean(kontakt.whatsapp || kontakt.email);
  dialogZeigen({
    badge: `−${punkteText(punkte)}`,
    titel: 'Prämie einlösen?',
    text: praemie,
    hinweis: erreichbar
      ? `${absender} bekommt eine Nachricht von dir. Sobald die Prämie eingelöst ist, werden dir ${punkteText(punkte)} abgezogen.`
      : `Sag ${absender} einfach Bescheid. Sobald die Prämie eingelöst ist, werden dir ${punkteText(punkte)} abgezogen.`,
    aktionen: erreichbar
      ? [{ label: 'Ja, einlösen', primaer: true, aktion: () => nachrichtSenden(praemie, punkte) }]
      : []
  });
}

function praemienZeigen() {
  const stand = punktestand();
  const farben = ['var(--rot)', 'var(--gruen)', 'var(--gold-dunkel)'];
  const container = document.getElementById('praemien');
  const karten = stufen().map((stufe, i) => {
    const reicht = stand >= stufe.punkte;
    return el('article', { class: 'stufe', 'aria-label': `Prämien für ${stufe.punkte} Punkte` }, [
      el('div', { class: 'abzeichen', style: `background: ${farben[i % farben.length]}`, 'aria-hidden': 'true' }, [
        el('span', { class: 'abzeichen-zahl', text: String(stufe.punkte) }),
        el('span', { class: 'abzeichen-text', text: 'Punkte' })
      ]),
      el('ul', { class: 'praemien-liste' }, stufe.eintraege.map((eintrag) =>
        el('li', { class: 'praemie' }, [
          el('span', { text: eintrag }),
          el('button', {
            type: 'button',
            class: 'knopf',
            disabled: !reicht,
            'aria-label': reicht ? `${eintrag} einlösen` : `${eintrag}: dafür brauchst du ${punkteText(stufe.punkte)}`,
            onclick: () => einloesen(eintrag, stufe.punkte),
            text: 'Einlösen'
          })
        ])
      ))
    ]);
  });
  container.replaceChildren(...karten);
}

function verlaufZeigen() {
  const liste = document.getElementById('verlauf');
  const eintraege = [...(daten.verlauf || [])].sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
  if (!eintraege.length) {
    liste.replaceChildren(el('li', { class: 'leer', text: 'Noch keine Punkte. Am 1. Dezember geht es los!' }));
    return;
  }
  const format = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });
  liste.replaceChildren(...eintraege.map((e) => {
    const punkte = Number(e.punkte || 0);
    const datum = new Date(`${e.datum}T12:00:00`);
    return el('li', { class: 'eintrag' }, [
      el('span', { class: 'eintrag-datum', text: isNaN(datum) ? '' : format.format(datum) }),
      el('span', { class: 'eintrag-text', text: e.text }),
      el('span', {
        class: `eintrag-punkte ${punkte < 0 ? 'minus' : 'plus'}`,
        text: punkte < 0 ? `−${punkteText(Math.abs(punkte))}` : `+${punkteText(punkte)}`
      })
    ]);
  }));
}

function schneeErzeugen() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const container = document.querySelector('.schnee');
  const flocken = Array.from({ length: 28 }, () => {
    const f = el('span', { class: 'flocke' });
    f.style.setProperty('--l', `${Math.random() * 100}%`);
    f.style.setProperty('--g', `${4 + Math.random() * 6}px`);
    f.style.setProperty('--d', `${10 + Math.random() * 14}s`);
    f.style.setProperty('--v', `${-Math.random() * 20}s`);
    f.style.setProperty('--x', `${(Math.random() - 0.5) * 120}px`);
    return f;
  });
  container.replaceChildren(...flocken);
}

async function starten() {
  schneeErzeugen();
  try {
    const antwort = await fetch('data.json', { cache: 'no-store' });
    if (!antwort.ok) throw new Error(antwort.status);
    daten = await antwort.json();
  } catch {
    document.getElementById('inhalt').replaceChildren(
      el('p', { class: 'fehler', text: 'Die Daten konnten nicht geladen werden. Öffne die Seite über GitHub Pages oder einen lokalen Webserver.' })
    );
    return;
  }
  document.getElementById('eyebrow').textContent = `Adventskalender ${daten.jahr}`;
  document.getElementById('fuss-von').textContent = daten.absender ? `In Liebe, ${daten.absender}` : '';
  kontoZeigen();
  tuerenZeigen();
  praemienZeigen();
  verlaufZeigen();
}

starten();
