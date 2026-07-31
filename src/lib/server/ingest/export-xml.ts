import { createReadStream } from 'node:fs'
import sax from 'sax'
import { z } from 'zod'
import { median } from '../domain/metrics.ts'

// Apple-Health-Format: "2026-07-29 09:54:32 +0200" — lokale Zeit mit Offset, kein ISO-8601.
export function parseAppleDate(s: string): Date {
	const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2}):?(\d{2})$/.exec(s)
	if (!m) throw new Error(`Unerwartetes Datumsformat: ${s}`)
	const d = new Date(`${m[1]}T${m[2]}${m[3]}:${m[4]}`)
	if (Number.isNaN(d.getTime())) throw new Error(`Ungültiges Datum: ${s}`)
	return d
}

const workoutAttrs = z.object({
	workoutActivityType: z.string(),
	startDate: z.string(),
	endDate: z.string(),
	duration: z.coerce.number(),
})

export interface SkateWorkout {
	start: Date
	end: Date
	startLocal: string
	durationMin: number
	kcal?: number
	distanceKmWatch?: number
	hrAvg?: number
	hrMax?: number
}

/** Tagesreihen für die Belastungsbeobachtung (ADR-0005). */
export interface DailyWerte {
	/** lokales Datum (YYYY-MM-DD) → Tageswert */
	ruhepuls: Map<string, number>
	hrv: Map<string, number>
}

export interface ExportInhalt {
	workouts: SkateWorkout[]
	daily: DailyWerte
}

const RECORD_TYPEN: Record<string, keyof DailyWerte> = {
	HKQuantityTypeIdentifierRestingHeartRate: 'ruhepuls',
	HKQuantityTypeIdentifierHeartRateVariabilitySDNN: 'hrv',
}

/**
 * Streamt Export.xml (1,3 GB) in einem Durchlauf: SkatingSports-Workouts mit
 * ihren WorkoutStatistics sowie Ruhepuls- und HRV-Records als Tagesmediane.
 * Alle Statistik-Felder sind optional — ältere Sessions (z. B. 2020) haben
 * keine HR- oder Distanzdaten. Ein zweiter Durchlauf würde erneut Minuten
 * kosten, deshalb wird hier alles Nötige mitgenommen.
 */
export function readExport(
	xmlPath: string,
	onProgress?: (bytesRead: number) => void,
): Promise<ExportInhalt> {
	return new Promise((resolve, reject) => {
		const workouts: SkateWorkout[] = []
		let current: SkateWorkout | undefined
		// Nur die zwei relevanten Typen sammeln — ActiveEnergy allein hat 1,4 Mio Records.
		const roh: Record<keyof DailyWerte, Map<string, number[]>> = {
			ruhepuls: new Map(),
			hrv: new Map(),
		}
		const parser = sax.createStream(true)

		parser.on('opentag', (tag) => {
			const attrs = tag.attributes as Record<string, string>
			if (tag.name === 'Record') {
				const typ = RECORD_TYPEN[attrs.type]
				if (!typ) return
				const wert = Number(attrs.value)
				if (!Number.isFinite(wert)) return
				// startDate ist lokale Zeit — die ersten 10 Zeichen sind der lokale Tag.
				const datum = attrs.startDate?.slice(0, 10)
				if (!datum) return
				const liste = roh[typ].get(datum)
				if (liste) liste.push(wert)
				else roh[typ].set(datum, [wert])
			} else if (tag.name === 'Workout') {
				const w = workoutAttrs.safeParse(attrs)
				if (!w.success || w.data.workoutActivityType !== 'HKWorkoutActivityTypeSkatingSports') return
				const start = parseAppleDate(w.data.startDate)
				current = {
					start,
					end: parseAppleDate(w.data.endDate),
					startLocal: w.data.startDate.slice(0, 16),
					durationMin: w.data.duration,
				}
			} else if (tag.name === 'WorkoutStatistics' && current) {
				const num = (key: string) => (attrs[key] === undefined ? undefined : Number(attrs[key]))
				switch (attrs.type) {
					case 'HKQuantityTypeIdentifierActiveEnergyBurned':
						current.kcal = num('sum')
						break
					case 'HKQuantityTypeIdentifierDistanceSkatingSports':
						current.distanceKmWatch = num('sum')
						break
					case 'HKQuantityTypeIdentifierHeartRate':
						current.hrAvg = num('average')
						current.hrMax = num('maximum')
						break
				}
			}
		})
		parser.on('closetag', (name) => {
			if (name === 'Workout' && current) {
				workouts.push(current)
				current = undefined
			}
		})
		parser.on('error', reject)
		parser.on('end', () =>
			resolve({
				workouts,
				daily: {
					ruhepuls: new Map([...roh.ruhepuls].map(([d, w]) => [d, median(w)])),
					hrv: new Map([...roh.hrv].map(([d, w]) => [d, median(w)])),
				},
			}),
		)

		const file = createReadStream(xmlPath)
		file.on('error', reject)
		if (onProgress) {
			let bytes = 0
			file.on('data', (chunk) => {
				bytes += chunk.length
				onProgress(bytes)
			})
		}
		file.pipe(parser)
	})
}
