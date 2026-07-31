# 0004 — Handy-Erfassung: SvelteKit im Heimnetz, kein Server im Internet

Status: vorgeschlagen · Datum: 2026-07-31

## Kontext

Das Trick-Log (ADR-0003) soll vom Handy aus befüllt werden, weil die Erfassung
am Laptop realistisch die Hürde ist, an der das Projekt scheitert. Damit wird
die Web-UI aus dem Backlog zum nächsten Schritt — und mit ihr die Frage, **wie
das Handy an die Anwendung kommt**.

Die Datenlage verschärft die Frage: Die Datenbank enthält Puls- und
Trainingsdaten sowie GPS-Tracks, die an der Haustür beginnen und enden.
Briefing 5.4 verlangt für alles, was Daten nach draußen gibt, eine bewusste
Entscheidung.

Vorhandene Infrastruktur: `ab-ops-dashboard` läuft über Coolify auf einem
Hetzner-Server, Auth über das APP_SECRET-Muster (ab-ops ADR-0011). Tailscale
ist auf dem Rechner nicht installiert.

## Betrachtete Optionen

**Deployment wie ab-ops (Coolify/Hetzner, APP_SECRET):** erprobter Pfad,
überall erreichbar, auch im Park. Preis: Gesundheitsdaten und die Wohnadresse
liegen auf einem gemieteten Server und hängen an einem einzigen Shared Secret.
Für ein Firmen-Dashboard mit zwei Nutzern ist diese Bedrohungslage vertretbar
(ab-ops ADR-0011) — bei Gesundheits- und Standortdaten ist sie eine andere.

**Tailscale:** Handy erreicht den Mac von überall, kein offener Port, Daten
bleiben lokal. Preis: neue Abhängigkeit von einem externen Koordinationsdienst
und ein zusätzliches System, das eingerichtet und verstanden werden will. Der
Mac muss ohnehin laufen.

**Nur im Heimnetz** (`vite dev --host` bzw. `adapter-node` lokal, Handy im
selben WLAN): null Exposition, null neue Infrastruktur, kein Secret, das
verloren gehen kann. Preis: Erfassung geht nur zu Hause und nur, wenn der Mac
läuft. Der Park ist am Ort — die Erfassung passiert nach der Heimfahrt vom
Sofa aus, nicht am Bowl-Rand.

## Entscheidung

Heimnetz. SvelteKit-App, an das lokale Interface gebunden, Handy im selben
WLAN. Kein Deployment, keine Auth, kein externer Dienst.

## Konsequenzen

- Die Web-UI wird nach den Regeln aus ADR (Briefing 3) aufgesetzt: Routen sind
  dünne Adapter auf `src/lib/server/domain`, dieselben Funktionen, die die CLI
  schon nutzt. Der Ingest bleibt CLI.
- **Keine Auth** — bewusst, nicht vergessen: Ohne Erreichbarkeit von außen gibt
  es keine Angriffsfläche, die ein Shared Secret schließen würde. Sobald die
  App das Heimnetz verlässt, ist Auth Teil derselben Entscheidung und dieses
  ADR wird abgelöst.
- **Revisit-Bedingung, explizit:** Wenn sich in den ersten Wochen zeigt, dass
  Sessions unerfasst bleiben, weil der Mac aus war, ist das der Auslöser für
  ein Folge-ADR (Tailscale zuerst, weil es die Daten lokal lässt; Coolify nur,
  wenn Erreichbarkeit ohne laufenden Mac nötig wird). Diese Bedingung ist ein
  Messpunkt, keine Absichtserklärung: die Zahl unerfasster Sessions steht in
  der Datenbank.
- Offline-Erfassung im Park (PWA mit lokalem Puffer und späterem Sync) ist
  damit **nicht** gebaut. Sie wäre die technische Antwort auf „Mac war aus",
  kostet aber Sync-Logik samt Konfliktfällen — erst bauen, wenn das Problem
  gemessen ist.
- Lernpunkt: **Die Bedrohungslage bestimmt die Architektur, nicht der
  vorhandene Deployment-Pfad.** Dass ein erprobter Weg existiert (Coolify +
  APP_SECRET), ist ein Argument für Wiederverwendung — aber Wiederverwendung
  überträgt auch die Annahmen, unter denen die Lösung entstand. Hier ändert
  sich die Datenklasse, also muss die Entscheidung neu getroffen werden. Die
  Umkehrung des Standardwegs ist außerdem billiger als sie aussieht: nicht
  deployen ist immer die reversibelste Option (Quelle: „one-way vs. two-way
  doors", Bezos — Exposition von Gesundheitsdaten ist eine Einbahntür).
