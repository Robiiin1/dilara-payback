# Prämienkatalog – Adventskalender

Statische Webseite für GitHub Pages: Adventskalender mit 24 Türchen, Punktestand, Prämien zum Einlösen und Punkte-Verlauf.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Seitenaufbau |
| `style.css` | Design |
| `app.js` | Logik (Türchen, Punkte, Einlösen) |
| `data.json` | **Alles, was du pflegst:** Aufgaben, Prämien, Punkte, Kontakt |
| `CNAME` | Deine Domain für GitHub Pages |
| `robots.txt` | Sperrt Suchmaschinen aus |

## 1. Anpassen

In `data.json`:

- `kontakt.whatsapp`: deine Handynummer mit Ländervorwahl, z. B. `"4915112345678"`. Beim Einlösen öffnet sich WhatsApp mit einer fertigen Nachricht an dich.
- `kontakt.email`: Alternative, falls du lieber E-Mails bekommst (wird nur genutzt, wenn `whatsapp` leer ist).
- `aufgaben`: die Aufgabe hinter jedem Türchen. `hinweis` ist optional.
- `praemien`: Punktestufen mit ihren Prämien.

## 2. Punkte gutschreiben und abziehen

Der Punktestand ist die Summe aller Einträge in `verlauf`. Nach jeder erledigten Aufgabe oder eingelösten Prämie trägst du eine Zeile ein, committest und pushst:

```json
"verlauf": [
  { "datum": "2026-12-01", "text": "Türchen 1: Foto vom Pferd", "punkte": 5 },
  { "datum": "2026-12-03", "text": "Eingelöst: Ich mache das Bett", "punkte": -10 }
]
```

Nach dem Push ist die Änderung meist innerhalb von 1–2 Minuten online.

## 3. Lokal testen

`fetch` funktioniert nicht über `file://`, deshalb einen kleinen Webserver starten:

```bash
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen. Mit `http://localhost:8000/?vorschau` sind alle Türchen schon offen – praktisch zum Testen. Geöffnete Türchen werden im Browser gespeichert; zum Zurücksetzen in den Entwicklertools den Local Storage löschen.

## 4. Auf GitHub veröffentlichen

1. Neues Repository anlegen, z. B. `adventskalender`.
2. Alle Dateien hochladen bzw. pushen:
   ```bash
   git init
   git add .
   git commit -m "Adventskalender"
   git branch -M main
   git remote add origin git@github.com:DEINNAME/adventskalender.git
   git push -u origin main
   ```
3. Im Repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, Branch `main`, Ordner `/ (root)`.
4. Die Seite ist danach unter `https://DEINNAME.github.io/adventskalender/` erreichbar.

> GitHub Pages funktioniert im kostenlosen Plan nur mit **öffentlichen** Repositories. Der Inhalt von `data.json` ist damit für jeden lesbar, der das Repo findet. `noindex` und `robots.txt` halten die Seite aber aus Google raus.

## 5. Domain bei Strato verbinden

1. In der Datei `CNAME` deine Domain eintragen, z. B. `www.punkte-fuer-anna.de`, und pushen.
2. Im Strato Kunden-Login: **Domains → Domainverwaltung → Zahnrad bei der Domain → DNS**.
3. Für `www` einen **CNAME-Record** anlegen: Ziel `DEINNAME.github.io`
4. Für die Hauptdomain ohne `www` die **A-Records** auf GitHub setzen:
   ```
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```
5. In GitHub unter **Settings → Pages → Custom domain** die Domain eintragen und nach der DNS-Prüfung **Enforce HTTPS** aktivieren.

Bis DNS-Änderungen überall angekommen sind, kann es einige Stunden dauern. Richte die Domain also ein paar Tage vor dem 1. Dezember ein.
