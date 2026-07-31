# 0005 — Session-Empfehlung: Beobachtung und Option, nie Vorschrift

Status: angenommen · Datum: 2026-07-31

## Kontext

Die Belastungssteuerung soll nicht nur Verläufe zeigen, sondern eine
**Empfehlung für die nächste Session**. Der Befund aus dem eingelesenen
Referenzzeitraum stützt den Bedarf: über 13 Sessions liegt der Durchschnittspuls
bei 168 bei gemessener HFmax 192; in 9 von 13 Sessions lag schon der
**Durchschnitt** über 85 % der HFmax, in keiner einzigen unter 75 %. Es gibt im
gesamten Datensatz keinen lockeren Tag.

Das steht in direktem Konflikt mit Briefing 9: „Keine Bewertung der Leistung.
Das Tool zeigt Verläufe und benennt Auffälligkeiten sachlich. Es lobt nicht, es
mahnt nicht, es vergibt keine Punkte." Eine Empfehlung ist per Definition mehr
als ein Verlauf. Ohne eine harte Regel kippt sie in genau den mahnenden Ton, den
das Prinzip verhindern soll — und der bei ADHS zuverlässig dazu führt, dass das
Werkzeug nicht mehr geöffnet wird.

## Betrachtete Optionen

**Keine Empfehlung, nur Verläufe:** prinzipientreu, aber die Verläufe zu deuten
ist genau die Arbeit, die das Tool abnehmen soll. Der Befund oben war in den
Rohdaten seit Wochen sichtbar und ist trotzdem erst durch eine Auswertung
aufgefallen.

**Trainingsplan-Logik** (Zielzonen, Wochenlast, Soll-Ist-Abgleich): maximale
Steuerung, aber das Tool würde Trainingslehre behaupten, die es nicht hat, und
Abweichungen vom Soll erzeugen automatisch Schuldgefühl. Außerdem wäre es
faktisch Gesundheitsberatung auf Basis einer selbstgebauten Heuristik.

**Beobachtung plus Option, formal getrennt von Wertung:** Das Tool nennt, was
in den Daten steht, und was daraus folgen *kann*. Es sagt nie, wie gut etwas
war, und nie, was zu tun ist.

## Entscheidung

Option 3, festgehalten als Formulierungsregel im Code:

> Das Tool sagt, **was ist** (Beobachtung aus den Daten) und **was daraus folgen
> kann** (Option). Es sagt nie, **wie gut** etwas war (Wertung) oder **was zu
> tun ist** (Vorschrift).

Jede Empfehlung trägt die Zahlen mit, auf denen sie beruht — überprüfbar und
damit überstimmbar.

Zulässig: „Die letzten neun Sessions lagen im Schnitt über 85 % deiner HFmax.
Ein Tag unter 75 % steht seit Beginn der Aufzeichnung aus."
Unzulässig: „Du übertrainierst." · „Starke Woche." · „Heute Pause machen." ·
Ampeln, Punkte, Streaks, Fortschrittsbalken auf ein Soll.

Datengrundlage: Ruhepuls und HRV (SDNN) als Tagesreihen, dazu die vorhandenen
Session-Werte. Beide Typen liegen im Export vor (1.355 bzw. 8.381 Records) und
brauchen einen zweiten Ingest-Zweig plus Tabelle `daily_metric` (Datum, Typ,
Wert) — Aggregation auf Tagesebene beim Ingest, weil die Rohauflösung für einen
Trend nichts beiträgt.

## Konsequenzen

- Die Schwellen (85 % / 75 % der HFmax, HFmax = 192 gemessen) leben als
  benannte Konstanten an einer Stelle und sind anpassbar. Sie sind Konvention,
  keine Messung — eine Heuristik ohne Stellschraube behauptet eine Genauigkeit,
  die sie nicht hat.
- **Keine medizinische Aussage.** Das Tool nennt Datenlagen, keine Diagnosen und
  keine Trainingsvorschriften. Ruhepuls- und HRV-Auffälligkeiten werden als
  Beobachtung gezeigt, nie als Warnung interpretiert.
- Die Empfehlung ist eine **Domain-Funktion** (`domain/empfehlung.ts`), die
  Beobachtungsobjekte zurückgibt (Kennzahl, Wert, Bezugsgröße), keine fertigen
  Sätze. Die Formulierung passiert in der UI. Damit ist die Regel oben testbar:
  Änderungen am Ton brechen keine Logik, und die Logik erzeugt keinen Ton.
- Bewusst zurückgestellt: HR-Zonen-Verteilung innerhalb der Session, Erholung
  zwischen Runs, Wochen-Trainingslast. Alle drei aus dem Backlog, alle drei
  bauen auf `daily_metric` und der Regel oben auf.
- Lernpunkt: **Ein Prinzipienkonflikt wird durch eine überprüfbare Regel
  aufgelöst, nicht durch Augenmaß.** „Sachlich formulieren" ist eine Absicht und
  hält dem ersten Feature nicht stand; die Trennung Beobachtung/Option gegen
  Wertung/Vorschrift ist eine Grenze, gegen die sich jeder einzelne Satz prüfen
  lässt. Dass die Trennung zusätzlich in der Architektur liegt (Domain liefert
  Zahlen, UI formuliert), macht sie strukturell statt disziplinabhängig — das
  ist dieselbe Bewegung wie „SvelteKit ist Transport, nicht Fachlichkeit",
  angewandt auf Sprache (Quelle: Constraints in Code statt in Konventionen,
  vgl. „Make illegal states unrepresentable").
