import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { replaceTrackpoints, upsertSession } from '../db/index.ts'
import { cleanTrackpoints, computeGpxMetrics } from '../domain/metrics.ts'
import { readSkatingWorkouts } from './export-xml.ts'
import { readGpx, type Trackpoint } from './gpx.ts'

const MATCH_TOLERANCE_MS = 5 * 60 * 1000

export interface IngestResult {
	workouts: number
	withRoute: number
}

/**
 * Liest den Health-Export ein: SkatingSports-Workouts aus Export.xml,
 * zugehörige GPX-Route über Zeitfenster-Überlappung (GPX ist UTC,
 * Export.xml lokale Zeit — der Abgleich läuft über epoch, nie über Dateinamen).
 * Idempotent: Upsert über start_utc, Trackpoints werden ersetzt.
 */
export async function runIngest(
	db: DatabaseSync,
	exportDir: string,
	log: (msg: string) => void,
): Promise<IngestResult> {
	log('Lese Export.xml (dauert einige Minuten) …')
	let lastReport = 0
	const workouts = await readSkatingWorkouts(join(exportDir, 'Export.xml'), (bytes) => {
		if (bytes - lastReport >= 200 * 1024 * 1024) {
			lastReport = bytes
			log(`  ${Math.round(bytes / 1024 / 1024)} MB gelesen`)
		}
	})
	log(`${workouts.length} Skate-Workouts gefunden`)

	const routesDir = join(exportDir, 'workout-routes')
	const files = (await readdir(routesDir)).filter((f) => f.endsWith('.gpx')).sort()
	const routes: { file: string; points: Trackpoint[] }[] = []
	for (const file of files) {
		routes.push({ file, points: await readGpx(join(routesDir, file)) })
	}
	log(`${routes.length} GPX-Routen gelesen`)

	let withRoute = 0
	for (const w of workouts) {
		const route = routes.find((r) => {
			if (r.points.length === 0) return false
			const rStart = r.points[0].t.getTime()
			const rEnd = r.points[r.points.length - 1].t.getTime()
			return rStart <= w.end.getTime() + MATCH_TOLERANCE_MS && rEnd >= w.start.getTime() - MATCH_TOLERANCE_MS
		})
		const clean = route ? cleanTrackpoints(route.points) : []
		const m = route ? computeGpxMetrics(clean) : undefined
		if (route) withRoute++

		const distanceKm = w.distanceKmWatch ?? m?.distanceKm
		const id = upsertSession(db, {
			startUtc: w.start.toISOString(),
			startLocal: w.startLocal,
			endUtc: w.end.toISOString(),
			durationMin: w.durationMin,
			distanceKm,
			distanceSource: distanceKm === undefined ? undefined : w.distanceKmWatch !== undefined ? 'watch' : 'gpx',
			avgMovingKmh: m?.avgMovingKmh,
			topKmh: m?.topKmh,
			movingShare: m?.movingShare,
			kcal: w.kcal,
			hrAvg: w.hrAvg,
			hrMax: w.hrMax,
			gpxFile: route?.file,
		})
		replaceTrackpoints(
			db,
			id,
			clean.map((p) => ({
				tUtc: p.t.toISOString(),
				lat: p.lat,
				lon: p.lon,
				ele: p.ele,
				speedMs: p.speedMs,
				hAcc: p.hAcc,
			})),
		)
		log(`  ${w.startLocal} — ${route ? `${clean.length} Trackpoints (${route.file})` : 'keine GPS-Route'}`)
	}

	return { workouts: workouts.length, withRoute }
}
