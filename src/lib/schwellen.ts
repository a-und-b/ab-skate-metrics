// Schwellen und Typen der Belastungsbeobachtung (ADR-0005).
// Geteilt zwischen Domain (rechnet) und UI (formuliert) — deshalb hier und
// nicht unter server/.

/** Gemessen im Referenz-Export, keine Formel. Anpassen, wenn ein höherer Wert auftritt. */
export const HF_MAX = 192
/** Konvention, keine Messung — beide Schwellen sind Stellschrauben. */
export const INTENSIV_ANTEIL = 0.85
export const LOCKER_ANTEIL = 0.75
/** Betrachtungsfenster für die Sessions. */
export const FENSTER_TAGE = 28
/** Aktueller Zustand gegen längere Basis — Fenster für Ruhepuls und HRV. */
export const AKTUELL_TAGE = 7
export const BASIS_TAGE = 60
/** Ab welcher relativen Abweichung ein Tageswert überhaupt erwähnt wird. */
export const ABWEICHUNG_SCHWELLE = 0.05

export type BeobachtungArt =
	| 'intensiv-anteil'
	| 'kein-lockerer-tag'
	| 'lockerer-tag-her'
	| 'ruhepuls-abweichung'
	| 'hrv-abweichung'

export interface Beobachtung {
	art: BeobachtungArt
	wert: number
	bezug: number
}
