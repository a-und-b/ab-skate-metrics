# 0003 — Trick-Log: strukturierte Versuche mit Katalog

Status: vorgeschlagen · Datum: 2026-07-31

## Kontext

Der Zweck des Projekts ist die Korrelation zwischen subjektivem
Trick-Fortschritt und objektiven Sensordaten („Wird der Ollie an Tagen mit
niedrigerem Durchschnittspuls besser?"). Das Datenmodell des Trick-Logs
entscheidet, ob diese Auswertung später überhaupt möglich ist.

Der Zielkonflikt ist nicht technisch: Je mehr Felder das Formular hat, desto
besser die Auswertung — und desto wahrscheinlicher, dass es nach einer
45-Minuten-Session nicht ausgefüllt wird. Ein Formular, das nicht ausgefüllt
wird, ist kein Datenmodell, sondern totes Schema.

## Betrachtete Optionen

**Freie Notiz pro Session:** null Erfassungshürde, aber keine Korrelation.
Aus „heute lief der Ollie besser" lässt sich keine Zeitreihe bilden. Rückwirkend
nicht reparierbar — Struktur aus Text zu gewinnen scheitert an der
Uneinheitlichkeit der eigenen Formulierungen.

**Voll strukturiert** (Trick, Versuche, gestanden, Untergrund, Setup, Wetter,
Tageszeit): beste Auswertung, höchste Hürde. Untergrund und Setup ändern sich
über Wochen kaum — sie kosten bei jeder Erfassung Aufmerksamkeit und liefern
fast nie neue Information.

**Minimal strukturiert plus optionale Notiz:** Trick, Versuche, gestanden,
Wertung. Vier Angaben, davon drei Zahlen. Trägt die Korrelation, weil
Erfolgsquote (`gestanden / versuche`) und Qualität als Zeitreihen vorliegen.
Alles Weitere kann später als eigene Migration folgen, wenn es sich als nötig
zeigt — Felder ergänzen ist billig, Struktur nachträglich erzeugen unmöglich.

## Entscheidung

Minimal strukturiert, plus ein **Trick-Katalog** statt freier Texteingabe:

```sql
CREATE TABLE trick (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL UNIQUE,
	aktiv INTEGER NOT NULL DEFAULT 1   -- aktueller Arbeitspunkt: steuert die Vorbefüllung
);

CREATE TABLE trick_attempt (
	id INTEGER PRIMARY KEY,
	session_id INTEGER NOT NULL REFERENCES session(id) ON DELETE CASCADE,
	trick_id INTEGER NOT NULL REFERENCES trick(id),
	versuche INTEGER NOT NULL CHECK (versuche >= 0),
	gestanden INTEGER NOT NULL CHECK (gestanden >= 0 AND gestanden <= versuche),
	wertung INTEGER CHECK (wertung BETWEEN 1 AND 3),  -- 1 gerade so, 2 gut, 3 sehr gut
	notiz TEXT,
	UNIQUE (session_id, trick_id)
);
```

Ein Eintrag ist **ein Trick in einer Session**. Die Wertung beschreibt die
Qualität der gestandenen Versuche und bleibt leer, wenn nichts stand.
Der Katalog startet mit den Arbeitspunkten aus dem Briefing: Ollie rollend,
Push (Umstellung von Mongo), Rock to Fakie, Boneless.

## Konsequenzen

- **Die Wertung ist eine Selbsteinschätzung, keine Bewertung durch das Tool.**
  Der Unterschied ist der zentrale Punkt gegenüber dem Prinzip „keine Bewertung
  der Leistung" (Briefing 9): Holger bewertet seinen eigenen Trick, das Tool
  speichert diese Angabe und rechnet damit — es erzeugt selbst nie eine Note.
- `wertung` ist INTEGER 1–3, nicht Text: sortierbar, mittelbar, korrelierbar.
  Die Labels („gerade so", „gut", „sehr gut") leben in der UI, nicht in der DB.
- `UNIQUE (session_id, trick_id)` macht das Speichern idempotent — Nachtragen
  überschreibt, dupliziert nicht.
- `gestanden <= versuche` ist ein DB-Constraint, keine App-Prüfung. Die Regel
  gilt damit auch für CLI, spätere Importe und manuelle SQL-Korrekturen.
- Der Katalog erfüllt „nie bei null anfangen" (Briefing 9): das Formular zeigt
  die aktiven Tricks vorbefüllt, statt ein leeres Textfeld anzubieten. Neue
  Tricks legt das Formular bei Bedarf an; `aktiv = 0` blendet abgeschlossene aus,
  ohne Historie zu verlieren.
- Bewusst **nicht** aufgenommen: Untergrund, Setup, Wetter, Tageszeit. Wetter
  und Tageszeit sind aus Sessiondaten bzw. DWD ableitbar (Backlog) und müssen
  nicht getippt werden — was das System selbst weiß, fragt es nicht ab.
- Lernpunkt: **Das Erfassungsmodell muss zur Erfassungssituation passen, nicht
  zur Auswertungsphantasie.** Beim Entwurf eines Datenmodells für selbst
  erhobene Daten ist die begrenzende Ressource die Aufmerksamkeit beim Eintragen,
  nicht der Speicher. Die Frage lautet deshalb nie „was wäre alles auswertbar",
  sondern „was wird zuverlässig eingetragen" — und danach: was davon trägt die
  Kernfrage (Quelle: „Make the common case fast" auf Bedienung übertragen; im
  Kern YAGNI mit dem Nutzer statt dem Entwickler als Kostenträger).
