import {
	AKTUELL_TAGE,
	BASIS_TAGE,
	FENSTER_TAGE,
	HF_MAX,
	INTENSIV_ANTEIL,
	LOCKER_ANTEIL,
	type Beobachtung,
} from './schwellen.ts'

// ADR-0005: Hier wird formuliert, nicht gerechnet. Die Regel für jeden Satz:
// Er sagt, WAS IST und WAS DARAUS FOLGEN KANN — nie, WIE GUT etwas war oder
// WAS ZU TUN IST. Keine Ampeln, keine Streaks, kein Soll.

const puls = (anteil: number) => Math.round(anteil * HF_MAX)
const zahl = (n: number, digits = 0) => n.toFixed(digits).replace('.', ',')

export function beobachtungText(b: Beobachtung): string {
	switch (b.art) {
		case 'intensiv-anteil':
			return `${b.wert} der letzten ${b.bezug} Sessions lagen im Durchschnitt über ${puls(INTENSIV_ANTEIL)} Schlägen (${Math.round(INTENSIV_ANTEIL * 100)} % von HFmax ${HF_MAX}).`
		case 'kein-lockerer-tag':
			return `Eine Session mit einem Durchschnitt unter ${puls(LOCKER_ANTEIL)} Schlägen (${Math.round(LOCKER_ANTEIL * 100)} % von HFmax ${HF_MAX}) steht in den letzten ${b.bezug} Tagen aus — bei ${b.wert} gefahrenen Sessions.`
		case 'lockerer-tag-her':
			return `Die letzte Session unter ${puls(LOCKER_ANTEIL)} Schlägen im Durchschnitt war vor ${b.wert} ${b.wert === 1 ? 'Tag' : 'Tagen'}.`
		case 'ruhepuls-abweichung':
			return `Ruhepuls der letzten ${AKTUELL_TAGE} Tage: ${zahl(b.wert)} im Median, gegenüber ${zahl(b.bezug)} über ${BASIS_TAGE} Tage.`
		case 'hrv-abweichung':
			return `HRV der letzten ${AKTUELL_TAGE} Tage: ${zahl(b.wert)} ms im Median, gegenüber ${zahl(b.bezug)} ms über ${BASIS_TAGE} Tage.`
	}
}

export const BEOBACHTUNG_UEBERSCHRIFT = `Aus den Daten der letzten ${FENSTER_TAGE} Tage`
