import { createReadStream } from 'node:fs'
import sax from 'sax'

export interface Trackpoint {
	t: Date
	lat: number
	lon: number
	ele?: number
	speedMs?: number
	hAcc?: number
}

/** Liest eine GPX-Datei des Health-Exports. Zeitstempel sind UTC (ISO-8601). */
export function readGpx(path: string): Promise<Trackpoint[]> {
	return new Promise((resolve, reject) => {
		const points: Trackpoint[] = []
		let pt: Partial<Trackpoint> | undefined
		let field: string | undefined
		let text = ''
		const parser = sax.createStream(true)

		parser.on('opentag', (tag) => {
			if (tag.name === 'trkpt') {
				const a = tag.attributes as Record<string, string>
				pt = { lat: Number(a.lat), lon: Number(a.lon) }
			} else if (pt && ['ele', 'time', 'speed', 'hAcc'].includes(tag.name)) {
				field = tag.name
				text = ''
			}
		})
		parser.on('text', (t) => {
			if (field) text += t
		})
		parser.on('closetag', (name) => {
			if (pt && name === field) {
				if (name === 'time') pt.t = new Date(text)
				else if (name === 'ele') pt.ele = Number(text)
				else if (name === 'speed') pt.speedMs = Number(text)
				else if (name === 'hAcc') pt.hAcc = Number(text)
				field = undefined
			} else if (name === 'trkpt' && pt) {
				if (pt.t && !Number.isNaN(pt.t.getTime()) && Number.isFinite(pt.lat) && Number.isFinite(pt.lon)) {
					points.push(pt as Trackpoint)
				}
				pt = undefined
			}
		})
		parser.on('error', reject)
		parser.on('end', () => resolve(points))

		const file = createReadStream(path)
		file.on('error', reject)
		file.pipe(parser)
	})
}
