# 0001 — XML-Streaming-Parser: `sax`

Status: angenommen · Datum: 2026-07-31

## Kontext

Der Ingest muss `Export.xml` (1,3 GB, Millionen `<Record>`-Elemente) lesen.
DOM-Parsing scheidet aus — der Parser muss streamen und Elemente nach
Verarbeitung freigeben. Kandidaten laut Briefing: `sax`, `saxes`,
`node-xml-stream`. Kriterien: Wartungsstand, Speicherverhalten bei 1,3 GB,
TS-Typen.

## Betrachtete Optionen

**`sax` (1.6.1):** der Klassiker (isaacs), letztes Release Juli 2026 — aktiv
gewartet. Null Dependencies. Event-basiert (`opentag`/`closetag`), hält nie
mehr als das aktuelle Element im Speicher. Typen über `@types/sax`
(DefinitelyTyped).

**`saxes` (6.0.0):** strikterer, schnellerer Fork von `sax`, TS-Typen
eingebaut. Aber: letztes Release Mai 2022, seither still. Die Striktheit
(wirft bei Spec-Verstößen) ist bei einer Apple-generierten Datei eher Risiko
als Nutzen — wir wollen lesen, nicht validieren.

**`node-xml-stream` (1.0.2):** minimalistisch, aber seit 2022 tot, keine
Typen, kaum Nutzerbasis. Scheidet aus.

## Entscheidung

`sax` plus `@types/sax` als Dev-Dependency.

## Konsequenzen

- Absicherung gegen Parser-Drift: der Parser wird **nur** in
  `src/lib/server/ingest/` importiert. Der Rest des Codes sieht bereits
  geparste Objekte (per Zod validiert). Ein Swap zu `saxes` wäre eine Datei.
- Der Parser läuft nicht-strikt (`sax(false)` bzw. `strict: true` mit
  Fehlertoleranz beim `<n>`-vs-`<name>`-Fall in den GPX-Dateien).
- Speicherverhalten wird im Ingest beobachtet (Fortschrittsausgabe), nicht
  vorab gebenchmarkt — bei Event-Parsern ist der Footprint konstruktionsbedingt
  konstant.
- Lernpunkt: **Wartungsstand schlägt Feature-Vergleich.** Bei funktional
  gleichwertigen Bibliotheken (alle drei streamen, alle drei reichen) ist die
  wichtigste Frage nicht „welche kann mehr", sondern „welche wird in fünf
  Jahren noch gepflegt". Ein Release im Juli 2026 gegen Stille seit 2022 ist
  ein stärkeres Signal als eingebaute TS-Typen (Quelle: „Choose boring
  technology", Dan McKinley — Wartbarkeit als primäres Auswahlkriterium).
