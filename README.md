# ab-skate-metrics

Privates Nebenprojekt von Holger — kein Produkt von anders & besser. Das Repo
liegt nur unter der Studio-Organisation, weil die Infrastruktur dort schon
existiert.

Auswertungswerkzeug für Skateboard-Sessions auf Basis des Apple-Health-Exports.
Der Zweck: objektive Sensordaten (Puls, GPS, Distanz) mit subjektivem
Trick-Fortschritt zusammenbringen — das kann keine der existierenden
Fitness-Apps.

## Projektstand

Meilenstein 1 ist umgesetzt: Ingest des Health-Exports nach SQLite plus
Terminal-Report. Dazu die Trick-Erfassung als Web-Formular (handy-tauglich,
läuft bisher nur lokal) und die Belastungsbeobachtung aus Ruhepuls und HRV.
HR-Zonen, Trick-Korrelation und Karte existieren noch nicht.

Das Werkzeug bewertet keine Leistung. Es zeigt Verläufe und benennt
Auffälligkeiten sachlich — es lobt nicht, mahnt nicht und gibt keine
Trainings- oder Gesundheitsempfehlung.

## Setup und Nutzung

```bash
nvm use                  # Node 24 zwingend (node:sqlite, natives TS-Type-Stripping)
npm install
cp .env.example .env     # Pfade eintragen
node scripts/ingest.ts   # Export.xml + GPX → SQLite (idempotent, dauert Minuten)
node scripts/report.ts   # Session-Tabelle + Top-Speed-Trend im Terminal
npm run dev              # Trick-Erfassung im Browser (http://localhost:5173)
npm test                 # Domain-Tests gegen synthetische Fixtures
npm run check            # svelte-check
```

## Datenschutz

Nicht verhandelbar:

- Keine Gesundheits- oder Geodaten im Repo. Die `.gitignore` deckt
  `data/`, `*.xml`, `*.gpx`, `*.sqlite*` und `.env` ab.
- Das Datenverzeichnis (SQLite) liegt außerhalb des Repos, Pfad aus `.env`.
- Test-Fixtures sind synthetisch, nie aus dem echten Export abgeleitet.
- Keine externen Dienste (Tiles, Fonts, Analytics) ohne ADR.

## Architektur

Eine Regel: **SvelteKit ist Transport, nicht Fachlichkeit.** Domain-Code lebt
in `src/lib/server/`, CLI (`scripts/`) und spätere Web-Routen sind gleichrangige
dünne Adapter. Entscheidungen stehen in `docs/adr/`.
