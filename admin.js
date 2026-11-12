const CFG_KEY = 'adventskalender-admin';
const FARBEN = ['var(--rot)', 'var(--gruen)', 'var(--gold-dunkel)'];

let cfg = null;
let daten = null;
let sha = null;
let beschaeftigt = false;
let toastTimer = null;

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

function haken() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '3');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const pfad = document.createElementNS(ns, 'path');
  pfad.setAttribute('d', 'M5 12.5l4.5 4.5L19 7.5');
  svg.append(pfad);
  return svg;
}

function punkteText(n) {
  return Math.abs(n) === 1 ? `${n} Punkt` : `${n} Punkte`;
}

function heute() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function cfgLesen() {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
  } catch {
    return null;
  }
}

function cfgSchreiben(wert) {
  try {
    if (wert) localStorage.setItem(CFG_KEY, JSON.stringify(wert));
    else localStorage.removeItem(CFG_KEY);
  } catch {}
}

function vorschlag() {
  const host = location.hostname;
  if (!host.endsWith('.github.io')) return {};
  const owner = host.split('.')[0];
  const teile = location.pathname.split('/').filter(Boolean);
  const repo = teile.length > 1 || (teile.length === 1 && !teile[0].includes('.')) ? teile[0] : `${owner}.github.io`;
  return { owner, repo };
}

function toast(text, fehler = false) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.classList.toggle('fehler-toast', fehler);
  t.classList.add('sichtbar');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('sichtbar'), fehler ? 6000 : 3500);
}

function decodieren(base64) {
  const binaer = atob(base64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binaer, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function codieren(text) {
  const bytes = new TextEncoder().encode(text);
  let binaer = '';
  for (const b of bytes) binaer += String.fromCharCode(b);
  return btoa(binaer);
}

function apiUrl() {
  return `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/data.json`;
}

function kopf() {
  return {
    Authorization: `Bearer ${cfg.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function fehlerText(status) {
  if (status === 401) return 'Der Token ist ungültig oder abgelaufen.';
  if (status === 403) return 'Der Token hat keine Schreibrechte für dieses Repository.';
  if (status === 404) return 'Repository oder data.json nicht gefunden. Prüf Name, Repo, Branch und den Token-Zugriff.';
  if (status === 409 || status === 422) return 'Die Datei wurde zwischendurch geändert. Ich lade neu, bitte noch einmal versuchen.';
  return `GitHub hat mit Fehler ${status} geantwortet.`;
}

async function laden() {
  const antwort = await fetch(`${apiUrl()}?ref=${encodeURIComponent(cfg.branch)}`, { headers: kopf(), cache: 'no-store' });
  if (!antwort.ok) throw new Error(fehlerText(antwort.status));
  const json = await antwort.json();
  sha = json.sha;
  daten = JSON.parse(decodieren(json.content));
  if (!Array.isArray(daten.verlauf)) daten.verlauf = [];
}

async function speichern(nachricht) {
  const antwort = await fetch(apiUrl(), {
    method: 'PUT',
    headers: { ...kopf(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: nachricht,
      content: codieren(`${JSON.stringify(daten, null, 2)}\n`),
      sha,
      branch: cfg.branch
    })
  });
  if (!antwort.ok) {
    const fehler = new Error(fehlerText(antwort.status));
    fehler.status = antwort.status;
    throw fehler;
  }
  const json = await antwort.json();
  sha = json.content.sha;
}

async function aktion(aenderung, nachricht, erfolg) {
  if (beschaeftigt) return;
  beschaeftigt = true;
  document.body.classList.add('speichert');
  const vorher = structuredClone(daten);
  aenderung(daten);
  alleZeigen();
  try {
    await speichern(nachricht);
    toast(`${erfolg} Auf der Seite in 1–2 Minuten sichtbar.`);
  } catch (fehler) {
    daten = vorher;
    toast(fehler.message, true);
    if (fehler.status === 409 || fehler.status === 422) {
      try {
        await laden();
      } catch {}
    }
    alleZeigen();
  } finally {
    beschaeftigt = false;
    document.body.classList.remove('speichert');
  }
}

function bestaetigen({ titel, text, knopf, aktionFn }) {
  const dialog = document.getElementById('dialog');
  dialog.querySelector('.dialog-inhalt').replaceChildren(
    el('h3', { id: 'dialog-titel', text: titel }),
    el('p', { class: 'dialog-hinweis', text }),
    el('div', { class: 'dialog-knoepfe' }, [
      el('button', { class: 'knopf primaer', value: 'ok', text: knopf, onclick: aktionFn }),
      el('button', { class: 'knopf', value: 'abbrechen', text: 'Abbrechen' })
    ])
  );
  dialog.showModal();
}

function punktestand() {
  return daten.verlauf.reduce((summe, e) => summe + Number(e.punkte || 0), 0);
}

function gutgeschrieben(tag) {
  return daten.verlauf.some((e) => e.tuer === tag);
}

function kontoZeigen() {
  const stand = punktestand();
  const erledigt = (daten.aufgaben || []).filter((a) => gutgeschrieben(a.tag)).length;
  const eingeloest = daten.verlauf.filter((e) => e.praemie).length;
  document.getElementById('punkte').textContent = String(stand);
  document.getElementById('zusammenfassung').textContent =
    `${erledigt} von ${(daten.aufgaben || []).length} Aufgaben gutgeschrieben · ${eingeloest} ${eingeloest === 1 ? 'Prämie' : 'Prämien'} eingelöst`;
}

function tuerenZeigen() {
  const liste = document.getElementById('admin-tueren');
  const aufgaben = [...(daten.aufgaben || [])].sort((a, b) => a.tag - b.tag);
  liste.replaceChildren(...aufgaben.map((a) => {
    const fertig = gutgeschrieben(a.tag);
    return el('li', { class: 'admin-eintrag' }, [
      el('span', {
        class: fertig ? 'nummer erledigt' : 'nummer',
        style: fertig ? null : `background: ${FARBEN[a.tag % 3]}`,
        text: String(a.tag),
        'aria-hidden': 'true'
      }),
      el('div', { class: 'admin-text' }, [
        el('span', { text: a.text }),
        fertig
          ? el('span', { class: 'admin-meta ok' }, [haken(), `${punkteText(a.punkte)} gutgeschrieben`])
          : el('span', { class: 'admin-meta', text: punkteText(a.punkte) })
      ]),
      fertig
        ? el('button', {
            type: 'button',
            class: 'knopf loeschen',
            'aria-label': `Gutschrift für Türchen ${a.tag} rückgängig machen`,
            text: 'Rückgängig',
            onclick: () => bestaetigen({
              titel: `Türchen ${a.tag}`,
              text: `Die Gutschrift über ${punkteText(a.punkte)} wird wieder entfernt.`,
              knopf: 'Rückgängig machen',
              aktionFn: () => aktion(
                (d) => { d.verlauf = d.verlauf.filter((e) => e.tuer !== a.tag); },
                `Gutschrift Türchen ${a.tag} entfernt`,
                `Gutschrift für Türchen ${a.tag} entfernt.`
              )
            })
          })
        : el('button', {
            type: 'button',
            class: 'knopf',
            'aria-label': `Türchen ${a.tag} als erledigt markieren und ${punkteText(a.punkte)} gutschreiben`,
            text: `Erledigt +${a.punkte}`,
            onclick: () => aktion(
              (d) => d.verlauf.push({ datum: heute(), text: `Türchen ${a.tag}: ${a.text}`, punkte: a.punkte, tuer: a.tag }),
              `Türchen ${a.tag} erledigt (+${a.punkte})`,
              `${punkteText(a.punkte)} für Türchen ${a.tag} gutgeschrieben.`
            )
          })
    ]);
  }));
}

function praemienZeigen() {
  const stand = punktestand();
  const stufen = [...(daten.praemien || [])].sort((a, b) => a.punkte - b.punkte);
  document.getElementById('admin-praemien').replaceChildren(...stufen.map((stufe, i) => {
    const reicht = stand >= stufe.punkte;
    return el('article', { class: 'stufe', 'aria-label': `Prämien für ${stufe.punkte} Punkte` }, [
      el('div', { class: 'abzeichen', style: `background: ${FARBEN[i % FARBEN.length]}`, 'aria-hidden': 'true' }, [
        el('span', { class: 'abzeichen-zahl', text: String(stufe.punkte) }),
        el('span', { class: 'abzeichen-text', text: 'Punkte' })
      ]),
      el('ul', { class: 'praemien-liste' }, stufe.eintraege.map((eintrag) => {
        const anzahl = daten.verlauf.filter((e) => e.praemie === eintrag).length;
        return el('li', { class: 'praemie' }, [
          el('span', { class: 'admin-text' }, [
            el('span', { text: eintrag }),
            anzahl ? el('span', { class: 'admin-meta', text: `${anzahl}× eingelöst` }) : null
          ]),
          el('button', {
            type: 'button',
            class: 'knopf',
            disabled: !reicht,
            'aria-label': reicht ? `${eintrag} einlösen und ${punkteText(stufe.punkte)} abziehen` : `${eintrag}: nicht genug Punkte`,
            text: `Eingelöst −${stufe.punkte}`,
            onclick: () => bestaetigen({
              titel: 'Prämie einlösen?',
              text: `„${eintrag}“ wird eingetragen und ${punkteText(stufe.punkte)} werden abgezogen.`,
              knopf: 'Einlösen',
              aktionFn: () => aktion(
                (d) => d.verlauf.push({ datum: heute(), text: `Eingelöst: ${eintrag}`, punkte: -stufe.punkte, praemie: eintrag }),
                `Prämie eingelöst: ${eintrag} (-${stufe.punkte})`,
                `${punkteText(stufe.punkte)} abgezogen.`
              )
            })
          })
        ]);
      }))
    ]);
  }));
}

function verlaufZeigen() {
  const liste = document.getElementById('admin-verlauf');
  const eintraege = daten.verlauf
    .map((e, index) => ({ ...e, index }))
    .sort((a, b) => String(b.datum).localeCompare(String(a.datum)) || b.index - a.index);
  if (!eintraege.length) {
    liste.replaceChildren(el('li', { class: 'leer', text: 'Noch keine Einträge.' }));
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
      }),
      el('button', {
        type: 'button',
        class: 'knopf loeschen',
        'aria-label': `Eintrag „${e.text}“ löschen`,
        text: 'Löschen',
        onclick: () => bestaetigen({
          titel: 'Eintrag löschen?',
          text: `„${e.text}“ (${punkte < 0 ? '−' : '+'}${punkteText(Math.abs(punkte))}) wird aus dem Verlauf entfernt.`,
          knopf: 'Löschen',
          aktionFn: () => aktion(
            (d) => { d.verlauf.splice(e.index, 1); },
            `Eintrag gelöscht: ${e.text}`,
            'Eintrag gelöscht.'
          )
        })
      })
    ]);
  }));
}

function alleZeigen() {
  if (!daten) return;
  kontoZeigen();
  tuerenZeigen();
  praemienZeigen();
  verlaufZeigen();
}

function bereichZeigen(sichtbar) {
  document.getElementById('anmeldung').hidden = sichtbar;
  document.getElementById('bereich').hidden = !sichtbar;
  if (sichtbar) {
    document.getElementById('verbunden').textContent = `Verbunden mit ${cfg.owner}/${cfg.repo} (${cfg.branch})`;
  }
}

async function verbinden() {
  try {
    await laden();
    bereichZeigen(true);
    alleZeigen();
  } catch (fehler) {
    bereichZeigen(false);
    toast(fehler.message, true);
  }
}

function formularVorbereiten() {
  const v = { ...vorschlag(), ...(cfg || {}) };
  if (v.owner) document.getElementById('owner').value = v.owner;
  if (v.repo) document.getElementById('repo').value = v.repo;
  if (v.branch) document.getElementById('branch').value = v.branch;
}

function starten() {
  cfg = cfgLesen();
  formularVorbereiten();

  document.getElementById('anmeldung-form').addEventListener('submit', (ereignis) => {
    ereignis.preventDefault();
    cfg = {
      owner: document.getElementById('owner').value.trim(),
      repo: document.getElementById('repo').value.trim(),
      branch: document.getElementById('branch').value.trim() || 'main',
      token: document.getElementById('token').value.trim()
    };
    cfgSchreiben(cfg);
    document.getElementById('token').value = '';
    verbinden();
  });

  document.getElementById('manuell-form').addEventListener('submit', (ereignis) => {
    ereignis.preventDefault();
    const text = document.getElementById('manuell-text').value.trim();
    const punkte = parseInt(document.getElementById('manuell-punkte').value, 10);
    if (!text || !Number.isFinite(punkte) || punkte === 0) {
      toast('Bitte Beschreibung und Punkte (nicht 0) angeben.', true);
      return;
    }
    aktion(
      (d) => d.verlauf.push({ datum: heute(), text, punkte }),
      `Manueller Eintrag: ${text} (${punkte > 0 ? '+' : ''}${punkte})`,
      'Eintrag gespeichert.'
    );
    ereignis.target.reset();
  });

  document.getElementById('neu-laden').addEventListener('click', async () => {
    try {
      await laden();
      alleZeigen();
      toast('Daten neu geladen.');
    } catch (fehler) {
      toast(fehler.message, true);
    }
  });

  document.getElementById('abmelden').addEventListener('click', () => {
    cfgSchreiben(null);
    cfg = null;
    daten = null;
    sha = null;
    formularVorbereiten();
    bereichZeigen(false);
    toast('Abgemeldet. Der Token wurde aus diesem Browser entfernt.');
  });

  if (cfg && cfg.token) verbinden();
}

starten();
