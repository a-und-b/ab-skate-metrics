import { createReadStream } from 'node:fs'
import sax from 'sax'
import { z } from 'zod'

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

/**
 * Streamt Export.xml (1,3 GB) und liefert nur die SkatingSports-Workouts mit
 * ihren WorkoutStatistics. Alle Statistik-Felder sind optional — ältere
 * Sessions (z. B. 2020) haben keine HR- oder Distanzdaten.
 */
export function readSkatingWorkouts(
	xmlPath: string,
	onProgress?: (bytesRead: number) => void,
): Promise<SkateWorkout[]> {
	return new Promise((resolve, reject) => {
		const workouts: SkateWorkout[] = []
		let current: SkateWorkout | undefined
		const parser = sax.createStream(true)

		parser.on('opentag', (tag) => {
			const attrs = tag.attributes as Record<string, string>
			if (tag.name === 'Workout') {
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
		parser.on('end', () => resolve(workouts))

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
