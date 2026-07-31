import {
	ABWEICHUNG_SCHWELLE,
	AKTUELL_TAGE,
	BASIS_TAGE,
	FENSTER_TAGE,
	HF_MAX,
	INTENSIV_ANTEIL,
	LOCKER_ANTEIL,
	type Beobachtung,
} from '../../schwellen.ts'
import { median } from './metrics.ts'

// ADR-0005: Diese Datei liefert Zahlen, keine Sätze. Die Formulierung passiert
// in der UI (src/lib/beobachtung-text.ts). Kein Urteil, keine Vorschrift,
// keine medizinische Aussage — nur was in den Daten steht.

export interface SessionFuerBeobachtung {
	start_local: string
	hr_avg: number | null
}

export interface Tageswert {
	datum: string
	wert: number
}

const TAG_MS = 24 * 60 * 60 * 1000

function tageDazwischen(von: string, bis: Date): number {
	return Math.floor((bis.getTime() - new Date(`${von}T00:00:00Z`).getTime()) / TAG_MS)
}

function imFenster<T extends { datum: string }>(werte: T[], heute: Date, tage: number): T[] {
	return werte.filter((w) => tageDazwischen(w.datum, heute) < tage)
}

/**
 * Beobachtungen zur Belastung. `heute` kommt als Parameter (die Uhr ist eine
 * Abhängigkeit, keine globale Wahrheit) — damit ist die Funktion testbar.
 */
export function beobachtungen(
	sessions: SessionFuerBeobachtung[],
	ruhepuls: Tageswert[],
	hrv: Tageswert[],
	heute: Date,
): Beobachtung[] {
	const ergebnis: Beobachtung[] = []

	const jung = sessions
		.filter((s) => s.hr_avg !== null && tageDazwischen(s.start_local.slice(0, 10), heute) < FENSTER_TAGE)
		.sort((a, b) => a.start_local.localeCompare(b.start_local))

	if (jung.length > 0) {
		const intensiv = jung.filter((s) => (s.hr_avg as number) > INTENSIV_ANTEIL * HF_MAX)
		if (intensiv.length > 0) {
			ergebnis.push({ art: 'intensiv-anteil', wert: intensiv.length, bezug: jung.length })
		}

		const locker = jung.filter((s) => (s.hr_avg as number) < LOCKER_ANTEIL * HF_MAX)
		if (locker.length === 0) {
			ergebnis.push({ art: 'kein-lockerer-tag', wert: jung.length, bezug: FENSTER_TAGE })
		} else {
			const letzter = locker[locker.length - 1]
			ergebnis.push({
				art: 'lockerer-tag-her',
				wert: tageDazwischen(letzter.start_local.slice(0, 10), heute),
				bezug: jung.length,
			})
		}
	}

	for (const [art, reihe] of [
		['ruhepuls-abweichung', ruhepuls],
		['hrv-abweichung', hrv],
	] as const) {
		const aktuell = imFenster(reihe, heute, AKTUELL_TAGE)
		const basis = imFenster(reihe, heute, BASIS_TAGE)
		// Die Basis muss deutlich mehr Tage haben als das aktuelle Fenster,
		// sonst vergleicht man die Werte im Wesentlichen mit sich selbst.
		if (aktuell.length === 0 || basis.length < aktuell.length * 2) continue
		const a = median(aktuell.map((w) => w.wert))
		const b = median(basis.map((w) => w.wert))
		if (b === 0 || Math.abs(a - b) / b < ABWEICHUNG_SCHWELLE) continue
		ergebnis.push({ art, wert: a, bezug: b })
	}

	return ergebnis
}
