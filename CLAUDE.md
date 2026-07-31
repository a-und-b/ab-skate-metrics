# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Was das ist

Privates Nebenprojekt von Holger (nicht anders & besser): Auswertung von
Skateboard-Sessions aus dem Apple-Health-Export. Kern-Idee: objektive
Sensordaten (Puls, GPS) mit subjektivem Trick-Fortschritt korrelieren.
Deutsch ist die Sprache der UI, der Commits, der ADRs und der Kommunikation
mit Holger (Du-Form, keine Ausrufezeichen, keine Motivationssprüche).
Projekt-Ursprung: `BRIEFING.md` (lokal, nicht im Repo — enthält reale
Koordinaten und Gesundheitskontext).

## Zusammenarbeit AI ↔ Mensch (nicht optional)

Holger nutzt dieses Projekt explizit, um Software-Architektur zu lernen:

1. **Keine strukturelle Entscheidung ohne ADR und Holgers OK vorher.**
   Strukturell heißt: neue Dependency, Datenmodell-Änderung, neues externes
   System, neue Grenze im Code. ADRs in `docs/adr/NNNN-titel.md` (MADR:
   Kontext → Optionen → Entscheidung → Konsequenzen), fortlaufend nummeriert,
   Deutsch. Bestehende ADRs nie umschreiben — ablösen („ersetzt ADR-XXXX").
2. **Voller Lernmodus:** Jede ADR endet mit einem „Lernpunkt" — das Muster
   hinter der Entscheidung, benannt und mit Quelle. Bei größeren
   Umsetzungsschritten das Muster auch in der Antwort kurz einordnen.

Vor jeder Architekturarbeit: `docs/adr/` lesen.

## Kommandos

```bash
nvm use                  # Node 24 zwingend — node:sqlite + natives TS-Type-Stripping
npm test                 # node --test "src/lib/**/*.test.ts" — ohne Netzwerk
npm run check            # svelte-check (muss 0 Fehler sein, vor jedem Commit)
npm run dev              # Trick-Erfassung, http://localhost:5173
node scripts/ingest.ts   # Health-Export → SQLite (Meilenstein 1)
node scripts/report.ts   # Session-Tabelle + Top-Speed-Trend im Terminal
```

ENV aus `.env` (siehe `.env.example`): `HEALTH_EXPORT_PATH`, `DATA_DIR`.

## Architektur — die eine Regel

**SvelteKit ist Transport, nicht Fachlichkeit.** `src/lib/server/{domain,ingest,db}`
importiert nichts aus `@sveltejs/kit` und bekommt Abhängigkeiten (Db-Handle,
Uhr, Dateipfade) als Parameter. Routen sind dünne Adapter (< 20 Zeilen),
die CLI in `scripts/` importiert **dieselben** Domain-Module. Konkret:
`scripts/ingest.ts` und eine spätere `/api/sessions`-Route rufen dieselbe
Funktion auf — sonst sitzt Logik an der falschen Stelle.

Die Web-UI umfasst bisher nur die Trick-Erfassung (`/session/[id]`). Sie läuft
lokal; das Deployment nach Coolify/Hetzner steht am Ende (ADR-0006) und bekommt
**nur** `session`, `trick`, `trick_attempt` — `trackpoint` bleibt lokal.

**Gestaltung: technisches Datenblatt / Plotterzeichnung.** Millimeterpapier als
Grund, Tuschelinien, Ecken-Marken, Maßstabsbalken. Bewusst kein Fitness-App-Look:
keine Ringe, Ziele, Streaks oder Feiern — ein Messgerät bewertet nicht.
Farben über semantische Tokens in `src/app.css` (`text-leise`, `rand`, `raster`,
`flaeche`, `hinweis`) mit nativem `light-dark()`; keine `dark:`-Varianten im
Markup, keine rohen `slate-*`-Klassen. Bernstein (`hinweis`) bleibt Hinweisen
vorbehalten und wird nie zur Dekoration. Schrift: Archivo (Text) und IBM Plex
Mono (alle Zahlen, `.zahl`/`.marke` in `app.css`), lokal über `@fontsource` —
**kein CDN-Abruf zur Laufzeit** (Briefing 5.4).

Karten und Profile rendert `domain/spur.ts` **serverseitig** zu fertigen
SVG-Pfaden. Rohkoordinaten erreichen den Client nie, und die Umrechnung ist
testbar statt im Markup versteckt.

**Die Spur-Wiedergabe folgt der Zeit, nicht der Weglänge.** `spur.ts` liefert
dafür `zeitProfil` als CSS-`linear()`-Easing (Zeit → Pfadanteil); ohne das
würden Pausen übersprungen und schnelle Abschnitte am längsten dauern. 1× ist
Echtzeit, das Tempo skaliert über `playbackRate` der Web Animations API —
deshalb WAAPI statt CSS-Animation: nur so bleibt ein Tempowechsel im Lauf
nahtlos. Tests decken Linearität bei konstanter Fahrt und das Plateau bei
Stillstand ab.

## Nicht verhandelbare Invarianten

- **Geo-Fuzzing ist Default** (ADR-0007): jede Kartendarstellung zeigt nur
  Punkte im Radius um den Median-Punkt der Session — die Anfahrt von der
  Haustür erreicht weder Client noch Screenshot. Abschalten nur bewusst über
  `GEO_FUZZ=off`. Ein Test prüft, dass entfernte Punkte nicht im Pfad landen.
- **Datenschutz, Repo ist öffentlich:** keine Gesundheits-/Geodaten im Repo.
  `.gitignore` deckt `data/`, `*.xml`, `*.gpx`, `*.sqlite*`, `.env`, `BRIEFING.md`
  ab. Test-Fixtures sind synthetisch und leben als Strings in den Testdateien
  (keine `.xml`/`.gpx`-Dateien — die sind gitignored). Die GPX-Routen enthalten
  die Wohnadresse; jede Kartendarstellung braucht Geo-Fuzzing (Default: aktiv).
- **Alles SQL lebt in `src/lib/server/db/`**, nur positionale `?`-Parameter.
  Schemaänderungen immer als **neue** Migration (`PRAGMA user_version`), nie
  als Edit an einer bestehenden.
- **Ingest ist idempotent:** erneuter Lauf aktualisiert, dupliziert nicht.
  `Export.xml` (1,3 GB) nur streamend parsen, nie als DOM.
- **Zeitzonen:** `Export.xml` nutzt lokale Zeit mit Offset
  (`2026-07-29 09:54:32 +0200`, kein ISO-8601), GPX nutzt UTC. Zuordnung
  Route ↔ Workout über Zeitfenster, nie über Dateinamen.
- **Node-TS-Grenzen:** in `src/lib/server/` relative Imports **mit**
  `.ts`-Endung, keine Constructor-Parameter-Properties, kein `enum`.
  In Routen/Svelte-Dateien `$lib/...` **ohne** Endung.
- **Keine externen Dienste** (Tiles, Fonts, Analytics) ohne ADR.
- **Beobachtungen sagen nie, wie gut etwas war oder was zu tun ist** (ADR-0005).
  `domain/beobachtung.ts` rechnet und gibt nur Zahlen zurück, `lib/beobachtung-text.ts`
  formuliert. Schwellen liegen in `lib/schwellen.ts` und sind Stellschrauben,
  keine Messungen. Ein Test prüft die Formulierungen gegen verbotene Wörter.

## UI-Prinzipien (ADHS-bedingt, gelten schon für die CLI-Ausgabe)

Nie bei null anfangen (aus Kontext vorbefüllen) · keine Zähler-Badges für
Offenes · eine Liste, ein CTA pro Bildschirm · keine Modals · kritische Werte
in Bernstein, nie Rot, Text als Tatsache ohne Vorwurf · Änderungen optimistisch
mit Rückgängig-Fenster · Zahlen immer mit Einheit und Bezugsgröße.
Zusatz: **keine Bewertung der Leistung** — das Tool zeigt Verläufe und benennt
Auffälligkeiten sachlich, es lobt nicht, mahnt nicht, vergibt keine Punkte.

## Phasen-Disziplin

Meilenstein 1 = Bootstrap, Ingest, Domain-Metriken, Terminal-Report.
Bewusst zurückgestellt: Web-UI, Trick-Log, HR-Zonen, Schlaf, Karte.
Nichts davon nebenbei anfangen; jeder Meilenstein beginnt mit ADRs.
