import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseAppleDate } from '../ingest/export-xml.ts'
import type { Trackpoint } from '../ingest/gpx.ts'
import { cleanTrackpoints, computeGpxMetrics } from './metrics.ts'

// Synthetische Fixtures (nie aus dem echten Export abgeleitet): Punkte im
// Sekundenabstand entlang eines Breitenkreises, ~1 m pro 0.000009° Latitude.
function makePoints(speedsMs: number[], opts: { hAcc?: number[]; gapAfter?: number } = {}): Trackpoint[] {
	return speedsMs.map((speedMs, i) => ({
		t: new Date(Date.UTC(2026, 0, 1, 12, 0, i + (opts.gapAfter !== undefined && i > opts.gapAfter ? 60 : 0))),
		lat: 50 + i * 0.000009,
		lon: 11,
		speedMs,
		hAcc: opts.hAcc?.[i],
	}))
}

test('cleanTrackpoints filtert hAcc >= 10, behält Punkte ohne hAcc', () => {
	const pts = makePoints([1, 1, 1], { hAcc: [2, 15, undefined as unknown as number] })
	const clean = cleanTrackpoints(pts)
	assert.equal(clean.length, 2)
	assert.ok(clean.every((p) => p.hAcc === undefined || p.hAcc < 10))
})

test('computeGpxMetrics: Distanz aus Haversine, ~1 m pro Punktabstand', () => {
	const m = computeGpxMetrics(makePoints([2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]))
	assert.ok(m)
	// 10 Segmente à ~1 m
	assert.ok(m.distanceKm > 0.009 && m.distanceKm < 0.011, `distanceKm=${m.distanceKm}`)
})

test('computeGpxMetrics: Lücken > 10 s zählen nicht zur Distanz', () => {
	const withGap = computeGpxMetrics(makePoints([2, 2, 2, 2], { gapAfter: 1 }))
	const without = computeGpxMetrics(makePoints([2, 2, 2, 2]))
	assert.ok(withGap && without)
	assert.ok(withGap.distanceKm < without.distanceKm)
})

test('computeGpxMetrics: Top-Speed ist der drittgrößte Wert', () => {
	const m = computeGpxMetrics(makePoints([1, 2, 99, 50, 5, 4, 3]))
	assert.ok(m)
	assert.equal(m.topKmh, 5 * 3.6)
})

test('computeGpxMetrics: Bewegungsanteil zählt Punkte über 0,7 m/s', () => {
	const m = computeGpxMetrics(makePoints([0.1, 0.2, 1, 2, 3, 0.5, 4, 5]))
	assert.ok(m)
	assert.equal(m.movingShare, 5 / 8)
	// Ø fahrend nur über die bewegten Punkte: (1+2+3+4+5)/5 = 3 m/s
	assert.equal(m.avgMovingKmh, 3 * 3.6)
})

test('computeGpxMetrics: unter 2 Punkten undefined', () => {
	assert.equal(computeGpxMetrics([]), undefined)
	assert.equal(computeGpxMetrics(makePoints([1])), undefined)
})

test('parseAppleDate: lokale Zeit mit Offset', () => {
	const d = parseAppleDate('2026-07-29 09:54:32 +0200')
	assert.equal(d.toISOString(), '2026-07-29T07:54:32.000Z')
	assert.throws(() => parseAppleDate('2026-07-29T09:54:32Z'))
})
