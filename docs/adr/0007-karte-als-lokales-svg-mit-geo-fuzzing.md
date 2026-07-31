# 0007 — Karte als lokales SVG, Geo-Fuzzing über den Dichte-Mittelpunkt

Status: vorgeschlagen · Datum: 2026-07-31

## Kontext

Die Session-Ansicht soll die gefahrene Spur zeigen. Damit werden zwei offene
Punkte fällig: die Kartendarstellung (Briefing 7.4) und das Geo-Fuzzing
(Briefing 5.3, „Default: aktiv"). Die GPX-Tracks beginnen und enden an der
Haustür — eine ungefilterte Darstellung zeigt die Wohnadresse.

## Betrachtete Optionen

**MapLibre mit externen Tiles:** vertraute Karte mit Straßen und Kontext.
Aber jeder Tile-Request sendet die Bounding-Box der Spur an einen fremden
Server — also genau die Koordinaten, die geschützt werden sollen. Briefing 5.4
verlangt dafür eine bewusste Entscheidung; der Gegenwert ist gering, weil ein
einzelner Skatepark keinen Kartenkontext braucht.

**Lokales SVG ohne Basemap:** die Spur wird selbst projiziert und gezeichnet.
Keine Requests, keine Dependency, kein Tile-Cache. Für einen Park, der auf
150 m Kantenlänge passt, ist die Spur selbst die Karte — Straßennamen tragen
nichts bei.

Für den Fuzzing-Mittelpunkt:

**Feste Koordinate aus der Konfiguration:** exakt steuerbar, aber jemand muss
sie eintragen, und eine Park-Koordinate in `.env.example` oder gar im Code wäre
wieder ein Datenleck-Risiko.

**Median der Punkte einer Session:** liegt zwangsläufig dort, wo die meisten
Punkte liegen — im Park, weil dort die Zeit verbracht wird und nicht auf der
Anfahrt. Keine Koordinate im Repo, keine Konfiguration nötig, funktioniert für
jeden Park und jeden Nutzer automatisch.

## Entscheidung

Lokales SVG-Rendering ohne Basemap. Geo-Fuzzing verwirft alle Punkte außerhalb
eines Radius um den **Median-Punkt** der Session (Median, nicht Mittelwert —
der Mittelwert wird von der Anfahrt verzerrt).

Konfiguration über `.env`:

- `GEO_FUZZ_RADIUS_M` (Default 200) — Radius um den Median
- `GEO_FUZZ=off` schaltet die Filterung ab

Default ist aktiv. Die Rohpunkte bleiben unangetastet in der Datenbank
(ADR-0002); gefiltert wird ausschließlich bei der Darstellung.

## Konsequenzen

- Die Anfahrt ist in der Ansicht nicht sichtbar. Das ist kein Verlust: die
  Distanzmetriken kommen aus den Rohdaten, nicht aus der Darstellung.
- Kein Koordinatensystem-Kontext (Norden, Maßstab in Metern) — deshalb trägt
  die Darstellung einen Maßstabsbalken, damit die Spur lesbar bleibt.
- Projektion: äquirektangulär mit `cos(lat)`-Korrektur. Auf 200 m Kantenlänge
  ist der Fehler gegenüber einer echten Projektion unter einem Zentimeter.
- Die Pfade werden **serverseitig** berechnet und als fertige SVG-Strings
  ausgeliefert. Das hält rohe Koordinaten aus dem Client-Bundle heraus und
  macht die Berechnung testbar — ein Test prüft, dass außerhalb des Radius
  liegende Punkte nicht im Ergebnis auftauchen.
- Revisit-Bedingung: Wenn eine Basemap doch gewünscht wird (etwa für mehrere
  Parks), löst das ein Folge-ADR aus — dann mit selbst gehosteten Tiles oder
  bewusster Entscheidung für einen externen Dienst.
- Lernpunkt: **Wenn eine Anforderung Konfiguration verlangt, prüfe zuerst, ob
  die Daten die Antwort schon enthalten.** Ein konfigurierbarer Mittelpunkt
  klingt nach der flexiblen Lösung, verlagert die Arbeit aber auf den Nutzer
  und schafft eine neue Stelle, an der eine sensible Koordinate im Klartext
  liegt. Der Median ist unkonfiguriert, robust gegen Ausreißer und
  selbstkalibrierend — die Stellschraube bleibt trotzdem erhalten, sie sitzt
  nur am Radius statt am Ort (Quelle: „Convention over Configuration", hier
  mit Datenschutz statt Bequemlichkeit als Begründung).
