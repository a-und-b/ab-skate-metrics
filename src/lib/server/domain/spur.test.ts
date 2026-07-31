import assert from 'node:assert/strict'
import { test } from 'node:test'
import { imUmkreis, spurGrafik, SPUR_DEFAULTS, type SpurPunkt } from './spur.ts'

// Synthetische Fixtures um 0/0 — im öffentlichen Repo steht keine Geografie.
function punkt(i: number, dLat: number, dLon: number, speed = 2): SpurPunkt {
	return {
		t_utc: new Date(Date.UTC(2026, 0, 1, 12, 0, i)).toISOString(),
		lat: dLat,
		lon: dLon,
		ele: 100 + (i % 5),
		speed_ms: speed,
	}
}

/** 40 Punkte dicht beieinander (der „Park") plus eine Spur, die weit wegführt. */
function parkMitAnfahrt(): SpurPunkt[] {
	const park = Array.from({ length: 40 }, (_, i) => punkt(i, i * 0.000009, (i % 7) * 0.000009))
	// ~0.009° Latitude ≈ 1 km entfernt — das wäre die Haustür.
	const weg = Array.from({ length: 5 }, (_, i) => punkt(40 + i, 0.009 + i * 0.0009, 0))
	return [...park, ...weg]
}

test('imUmkreis verwirft entfernte Punkte, behält den dichten Bereich', () => {
	const gefiltert = imUmkreis(parkMitAnfahrt(), 200)
	assert.equal(gefiltert.length, 40)
	assert.ok(gefiltert.every((p) => p.lat < 0.001), 'kein Punkt aus der Anfahrt darf übrig bleiben')
})

test('der Median hält den Mittelpunkt im Park, auch bei langer Anfahrt', () => {
	// Doppelt so viele Anfahrtspunkte wie oben: ein Mittelwert würde kippen.
	const punkte = [
		...Array.from({ length: 30 }, (_, i) => punkt(i, i * 0.000009, 0)),
		...Array.from({ length: 20 }, (_, i) => punkt(30 + i, 0.05 + i * 0.0009, 0)),
	]
	const gefiltert = imUmkreis(punkte, 200)
	assert.equal(gefiltert.length, 30)
})

test('Fuzzing steckt im Pfad: entfernte Koordinaten tauchen nicht auf', () => {
	const mit = spurGrafik(parkMitAnfahrt(), SPUR_DEFAULTS)
	const ohne = spurGrafik(parkMitAnfahrt(), { ...SPUR_DEFAULTS, fuzz: false })
	assert.ok(mit && ohne)
	assert.equal(mit.punkte, 40)
	assert.equal(ohne.punkte, 45)
	// Der gefilterte Ausschnitt ist deutlich kleiner als der ungefilterte.
	assert.ok(mit.spannweiteM < ohne.spannweiteM / 5)
})

test('Pfad bleibt in der Zeichenfläche', () => {
	const g = spurGrafik(parkMitAnfahrt())
	assert.ok(g)
	const zahlen = g.pfad.match(/-?\d+(\.\d+)?/g)!.map(Number)
	assert.ok(zahlen.length > 0)
	assert.ok(Math.min(...zahlen) >= 0, 'keine negativen Koordinaten')
	assert.ok(Math.max(...zahlen) <= Math.max(SPUR_DEFAULTS.breite, SPUR_DEFAULTS.hoehe))
})

test('zu wenige Punkte ergeben keine Grafik statt einer kaputten', () => {
	assert.equal(spurGrafik([]), null)
	assert.equal(spurGrafik([punkt(0, 0, 0)]), null)
})

test('Maßstab und Tempo werden mitgeliefert', () => {
	const g = spurGrafik(parkMitAnfahrt())
	assert.ok(g)
	assert.match(g.massstab.label, /^\d+ m$/)
	assert.ok(g.massstab.laenge > 0)
	assert.ok(Math.abs(g.tempoMaxKmh - 7.2) < 0.01, `tempoMaxKmh=${g.tempoMaxKmh}`)
	assert.ok(g.hoehenPfad, 'Höhenprofil aus ele-Werten')
})

test('fehlende Höhendaten ergeben kein Höhenprofil, aber eine Grafik', () => {
	const ohneEle = parkMitAnfahrt().map((p) => ({ ...p, ele: null }))
	const g = spurGrafik(ohneEle)
	assert.ok(g)
	assert.equal(g.hoehenPfad, null)
})
