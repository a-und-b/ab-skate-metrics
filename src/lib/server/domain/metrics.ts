import type { Trackpoint } from '../ingest/gpx.ts'

// Schwellen aus der Vorab-Analyse (BRIEFING, Abschnitt 4.2) — Regressionsbasis, kein Dogma.
export const H_ACC_MAX_M = 10
export const MOVING_MIN_MS = 0.7
const MAX_GAP_S = 10

/** GPS-Ausreißer raus: Punkte mit hAcc >= 10 m. Punkte ohne hAcc bleiben drin. */
export function cleanTrackpoints(points: Trackpoint[]): Trackpoint[] {
	return points.filter((p) => p.hAcc === undefined || p.hAcc < H_ACC_MAX_M)
}

export interface GpxMetrics {
	distanceKm: number
	avgMovingKmh?: number
	topKmh?: number
	movingShare?: number
}

export function computeGpxMetrics(points: Trackpoint[]): GpxMetrics | undefined {
	if (points.length < 2) return undefined

	let distM = 0
	for (let i = 1; i < points.length; i++) {
		const dtS = (points[i].t.getTime() - points[i - 1].t.getTime()) / 1000
		if (dtS > 0 && dtS <= MAX_GAP_S) {
			distM += haversineM(points[i - 1], points[i])
		}
	}

	const speeds = points.map((p) => p.speedMs).filter((s): s is number => s !== undefined)
	const moving = speeds.filter((s) => s > MOVING_MIN_MS)
	// Top-Speed robust: drittgrößter Wert schützt gegen GPS-Sprünge.
	const topMs = [...speeds].sort((a, b) => b - a)[2]
	const avgMovingMs = moving.length > 0 ? moving.reduce((a, b) => a + b, 0) / moving.length : undefined

	return {
		distanceKm: distM / 1000,
		avgMovingKmh: avgMovingMs === undefined ? undefined : avgMovingMs * 3.6,
		topKmh: topMs === undefined ? undefined : topMs * 3.6,
		// ponytail: Punktanteil statt Zeitanteil — bei ~1 Hz Abtastung dasselbe.
		movingShare: speeds.length > 0 ? moving.length / speeds.length : undefined,
	}
}

function haversineM(a: Trackpoint, b: Trackpoint): number {
	const R = 6371000
	const toRad = (deg: number) => (deg * Math.PI) / 180
	const dLat = toRad(b.lat - a.lat)
	const dLon = toRad(b.lon - a.lon)
	const h =
		Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
	return 2 * R * Math.asin(Math.sqrt(h))
}
