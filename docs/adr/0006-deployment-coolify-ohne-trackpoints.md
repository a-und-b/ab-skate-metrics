# 0006 — Deployment auf Coolify/Hetzner, aber ohne Trackpoints

Status: vorgeschlagen · Datum: 2026-07-31 · ersetzt ADR-0004

## Kontext

Die Erfassung des Trick-Logs (ADR-0003) soll direkt nach oder während der
Session im Park möglich sein. Das setzt Erreichbarkeit über Mobilfunk voraus
und schließt die Heimnetz-Lösung aus ADR-0004 aus.

Damit steht die Frage aus Briefing 5.4 an: Welche Daten gehen tatsächlich nach
draußen? Vorhandene Infrastruktur ist der Coolify-Stack auf dem a&b-Hetzner mit
dem APP_SECRET-Muster (ab-ops ADR-0011) — erprobt, aber unter der Annahme
entworfen, dass es um Projektdaten von zwei Nutzern geht.

Der Bestand der lokalen Datenbank nach dem ersten Ingest: 14 Sessions mit
Aggregaten (Distanz, Puls, Energie) und 34.914 Trackpoints. Die Trackpoints
sind der kritische Teil — die Tracks beginnen und enden an der Haustür.

## Betrachtete Optionen

**Ganze Datenbank auf den Server:** einfachster Sync, aber die Wohnadresse
liegt in 34.914 Zeilen auf einem gemieteten Server hinter einem einzigen
geteilten Secret. Die Trackpoints werden von der Handy-Erfassung nicht
gebraucht — sie wären reines Risiko ohne Gegenwert.

**Alles hochladen, Koordinaten gefuzzt:** Geo-Fuzzing nach Briefing 5.3 beim
Sync statt bei der Darstellung. Schützt die Adresse, kostet aber die
Möglichkeit, die Punkte später serverseitig neu auszuwerten — und ein Fehler
in der Fuzzing-Logik ist erst bemerkbar, wenn die Daten schon oben sind.

**Nur die Daten hochladen, die das Handy braucht:** Sessions (Aggregate) und
das Trick-Log. Trackpoints bleiben ausschließlich lokal. Die Datenklasse, die
das Risiko erzeugt, verlässt den Rechner gar nicht erst.

## Entscheidung

Coolify/Hetzner wie `ab-ops-dashboard`, APP_SECRET-Muster übernommen — aber
der Server bekommt **nur** `session`, `trick` und `trick_attempt`.
Die Tabelle `trackpoint` bleibt lokal.

Sync-Richtungen sind getrennt und damit konfliktfrei:

| Daten | Richtung | Auslöser |
|---|---|---|
| `session` (Aggregate) | lokal → Server | nach jedem Ingest |
| `trick`, `trick_attempt` | Server → lokal | Backup, `VACUUM INTO` wie ab-ops ADR-0010 |
| `trackpoint` | bleibt lokal | — |

Kein Datensatz wird auf beiden Seiten geschrieben. Deshalb gibt es keinen
Merge, keine Konfliktauflösung und keine Sync-Zustandsmaschine — nur zwei
gerichtete Kopien.

## Konsequenzen

- Die Park-Heatmap und jede spätere Neuauswertung der Punkte (Backlog) laufen
  lokal. Das ist keine Einschränkung: der Ingest des 1,3-GB-Exports läuft
  ohnehin lokal, und die Auswertung braucht kein Handy.
- **`APP_SECRET` mindestens 32 Zeichen aus einem CSPRNG.** Ein geteiltes Secret
  ohne Rate-Limit ist grundsätzlich brute-forcebar; ausreichende Entropie ist
  hier die billigere Absicherung als eine Sperrlogik. Fail closed in Produktion,
  Cookie `httpOnly` + `secure` + `sameSite=lax`, Hash im Cookie statt Secret
  (übernommen aus ab-ops ADR-0011).
- `X-Robots-Tag: noindex` und eine sperrende `robots.txt`. Kein Schutz gegen
  Angriffe, aber der Unterschied zwischen „nicht öffentlich" und „auffindbar".
- Die Domain trägt keinen sprechenden Namen (kein `skate.`, kein
  `gesundheit.`) — Hostnamen sind über Certificate-Transparency-Logs öffentlich.
- Das Sync-Skript ist ein CLI-Adapter (`scripts/sync.ts`) auf einer
  Domain-Funktion, die die Teilmenge bestimmt. Damit ist der Ausschluss der
  Trackpoints **eine testbare Funktion**, keine Konvention im Deployment-Skript:
  ein Test prüft, dass die erzeugte Teilmenge keine Koordinaten enthält.
- Revisit-Bedingung: Wenn die Karte doch aufs Handy soll, ist das der Auslöser
  für ein Folge-ADR — dann mit Geo-Fuzzing als Vorbedingung, nicht nachträglich.
- Lernpunkt: **Wenn Exposition unvermeidbar ist, reduziere die exponierte
  Menge statt der Wahrscheinlichkeit.** Härtung (Auth, TLS, Rate-Limits) senkt
  die Wahrscheinlichkeit eines Zugriffs; Datenminimierung senkt den Schaden,
  falls er eintritt — und wirkt auch gegen Fehler, die man nicht vorhergesehen
  hat (Fehlkonfiguration, Backup im falschen Bucket, Serverwechsel). Beides ist
  nötig, aber nur die zweite Maßnahme ist unabhängig von der eigenen
  Fehlerfreiheit (Quelle: Datensparsamkeit als Prinzip, DSGVO Art. 5 Abs. 1 c —
  hier nicht als Pflicht, sondern weil es die robustere Technik ist).
