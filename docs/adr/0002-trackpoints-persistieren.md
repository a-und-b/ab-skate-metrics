# 0002 — Datenmodell: Trackpoints persistieren, nicht nur Aggregate

Status: angenommen · Datum: 2026-07-31

## Kontext

Der Ingest berechnet pro Session aggregierte Metriken (Distanz, Ø fahrend,
Top-Speed, Bewegungsanteil). Frage: Speichern wir nur diese Aggregate oder
auch die bereinigten GPX-Trackpoints (~50k Zeilen pro Monat bei täglichem
Fahren)?

## Betrachtete Optionen

**Nur Aggregate:** schlankste Datenbank, aber jede neue Metrik (HR-Zonen,
Park-Heatmap, andere Speed-Schwellen) erzwingt einen vollen Re-Ingest des
1,9-GB-Exports — Minuten pro Lauf, und der Export muss dafür noch vorliegen.

**Trackpoints behalten:** Rohpunkte (nach `hAcc`-Filter) als eigene Tabelle,
Aggregate zusätzlich. ~600k Zeilen pro Jahr sind für SQLite trivial
(wenige MB). Neue Metriken sind dann eine SQL-Abfrage statt eines Re-Ingests;
die Park-Heatmap und die Erholungsanalyse aus dem Backlog brauchen die Punkte
ohnehin.

## Entscheidung

Trackpoints behalten: Tabelle `trackpoint` (session-FK, Zeit, lat/lon, ele,
speed, hAcc), zusätzlich Tabelle `session` mit den Aggregaten. Aggregate
werden beim Ingest berechnet und lassen sich jederzeit aus den Punkten
neu ableiten.

## Konsequenzen

- Die Datenbank ist die dauerhafte Wahrheit für Rohpunkte — der Export darf
  danach gelöscht werden, ohne Auswertungen zu verlieren.
- Aggregate sind abgeleitete Daten. Ändert sich eine Formel (z. B. die
  Bewegungsschwelle), reicht ein Neuberechnen aus `trackpoint`, kein Re-Ingest.
- Geo-Fuzzing (Wohnadresse in den Tracks) passiert **nicht** beim Ingest —
  gespeichert wird ungefiltert lokal, gefuzzt wird erst bei Darstellung/Export.
  Die Datenbank liegt außerhalb des Repos und verlässt den Rechner nicht.
- Lernpunkt: **Rohdaten sind billig, Neubeschaffung ist teuer.** Aggregate
  wegwerfen und neu rechnen kostet eine Query; Rohdaten wegwerfen kostet einen
  Re-Ingest, der die Quelle voraussetzt. Speichere die feinste Granularität,
  die du günstig halten kannst, und leite Sichten daraus ab (Quelle:
  Kimball, „store the atomic grain" — Data-Warehouse-Grundregel).
