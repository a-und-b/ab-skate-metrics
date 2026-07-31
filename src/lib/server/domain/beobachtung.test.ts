import assert from 'node:assert/strict'
import { test } from 'node:test'
import { beobachtungText } from '../../beobachtung-text.ts'
import { HF_MAX } from '../../schwellen.ts'
import { beobachtungen, type SessionFuerBeobachtung, type Tageswert } from './beobachtung.ts'

const HEUTE = new Date('2026-07-31T10:00:00Z')

function session(datum: string, hr: number | null): SessionFuerBeobachtung {
	return { start_local: `${datum} 09:00`, hr_avg: hr }
}

/** Tageswerte rückwärts ab einem Startdatum. */
function reihe(startDatum: string, werte: number[]): Tageswert[] {
	const start = new Date(`${startDatum}T00:00:00Z`)
	return werte.map((wert, i) => ({
		datum: new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10),
		wert,
	}))
}

const art = (bs: { art: string }[]) => bs.map((b) => b.art)

test('intensive Sessions werden gezählt, mit Bezugsgröße', () => {
	const bs = beobachtungen(
		[session('2026-07-28', 175), session('2026-07-29', 170), session('2026-07-30', 120)],
		[],
		[],
		HEUTE,
	)
	const intensiv = bs.find((b) => b.art === 'intensiv-anteil')
	assert.ok(intensiv)
	// 175 und 170 liegen über 85 % von 192 (163,2), 120 nicht.
	assert.equal(intensiv.wert, 2)
	assert.equal(intensiv.bezug, 3)
})

test('fehlender lockerer Tag wird benannt, vorhandener datiert', () => {
	const ohne = beobachtungen([session('2026-07-29', 175), session('2026-07-30', 170)], [], [], HEUTE)
	assert.ok(art(ohne).includes('kein-lockerer-tag'))

	const mit = beobachtungen([session('2026-07-28', 140), session('2026-07-30', 175)], [], [], HEUTE)
	const locker = mit.find((b) => b.art === 'lockerer-tag-her')
	assert.ok(locker)
	assert.equal(locker.wert, 3)
})

test('Sessions ohne Puls und außerhalb des Fensters zählen nicht', () => {
	const bs = beobachtungen(
		[session('2026-07-30', null), session('2026-01-01', 180)],
		[],
		[],
		HEUTE,
	)
	assert.equal(bs.length, 0)
})

test('Ruhepuls wird nur bei relevanter Abweichung erwähnt', () => {
	// 60 Tage Basis auf 55, letzte 7 Tage auf 62 — Abweichung deutlich über 5 %.
	const basis = reihe('2026-06-02', Array(52).fill(55))
	const aktuell = reihe('2026-07-25', Array(7).fill(62))
	const auffaellig = beobachtungen([], [...basis, ...aktuell], [], HEUTE)
	const rp = auffaellig.find((b) => b.art === 'ruhepuls-abweichung')
	assert.ok(rp)
	assert.equal(rp.wert, 62)
	assert.equal(rp.bezug, 55)

	const ruhig = beobachtungen([], reihe('2026-06-02', Array(59).fill(55)), [], HEUTE)
	assert.equal(art(ruhig).includes('ruhepuls-abweichung'), false)
})

test('zu dünne Basis erzeugt keine Abweichung — kein Vergleich mit sich selbst', () => {
	const bs = beobachtungen([], reihe('2026-07-28', [70, 70, 70]), [], HEUTE)
	assert.equal(bs.length, 0)
})

test('Formulierungen bleiben Beobachtung: keine Wertung, keine Vorschrift', () => {
	const alle = [
		{ art: 'intensiv-anteil', wert: 9, bezug: 13 },
		{ art: 'kein-lockerer-tag', wert: 13, bezug: 28 },
		{ art: 'lockerer-tag-her', wert: 5, bezug: 13 },
		{ art: 'ruhepuls-abweichung', wert: 62, bezug: 55 },
		{ art: 'hrv-abweichung', wert: 42, bezug: 48 },
	] as const

	// ADR-0005: nie „wie gut" (Wertung) und nie „was zu tun ist" (Vorschrift).
	const verboten =
		/\b(gut|schlecht|stark|schwach|zu viel|zu wenig|übertrain|solltest|mach|reduzier|pause machen|achtung|warnung)\b/i

	for (const b of alle) {
		const text = beobachtungText(b)
		assert.doesNotMatch(text, verboten, `Wertung oder Vorschrift in: ${text}`)
		assert.match(text, /\d/, `Beobachtung ohne Zahl: ${text}`)
		assert.ok(text.endsWith('.'), `Kein ganzer Satz: ${text}`)
	}

	// Bezugsgröße muss mitlaufen (Briefing 9: keine nackten Werte).
	assert.match(beobachtungText(alle[0]), new RegExp(String(HF_MAX)))
})
