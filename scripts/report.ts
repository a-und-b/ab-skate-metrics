// Dünner CLI-Adapter: Session-Tabelle plus Top-Speed-Verlauf als Wochenaggregat.
import { join } from 'node:path'
import { listSessions, openDb, weeklyTopSpeed } from '../src/lib/server/db/index.ts'

try {
	process.loadEnvFile()
} catch {
	// keine .env — ENV kann auch direkt gesetzt sein
}

const dataDir = process.env.DATA_DIR
if (!dataDir) {
	console.error('DATA_DIR setzen (siehe .env.example)')
	process.exit(1)
}

const db = openDb(join(dataDir, 'skate.sqlite'))
const sessions = listSessions(db)
if (sessions.length === 0) {
	console.log('Noch keine Sessions in der Datenbank — erst node scripts/ingest.ts laufen lassen')
	process.exit(0)
}

const fmt = (n: number | null, digits: number, unit: string) =>
	n === null ? '—' : `${n.toFixed(digits).replace('.', ',')}${unit}`

const cols = ['Datum', 'Dauer', 'Distanz', 'Ø fahrend', 'Top-Speed', 'Bewegung', 'Energie', 'HR ⌀', 'HR max']
const rows = sessions.map((s) => [
	s.start_local,
	fmt(s.duration_min, 0, ' min'),
	fmt(s.distance_km, 1, ' km') + (s.distance_source === 'gpx' ? '*' : ''),
	fmt(s.avg_moving_kmh, 1, ' km/h'),
	fmt(s.top_kmh, 1, ' km/h'),
	fmt(s.moving_share === null ? null : s.moving_share * 100, 0, ' %'),
	fmt(s.kcal, 0, ' kcal'),
	fmt(s.hr_avg, 0, ''),
	fmt(s.hr_max, 0, ''),
])

const widths = cols.map((c, i) => Math.max(c.length, ...rows.map((r) => r[i].length)))
const line = (cells: string[]) =>
	cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  ')

console.log(`Sessions (${sessions.length})\n`)
console.log(line(cols))
console.log(widths.map((w) => '─'.repeat(w)).join('──'))
for (const r of rows) console.log(line(r))
console.log('\n* Distanz aus GPX berechnet (keine Watch-Distanz vorhanden)')
console.log('Hinweis: GPS glättet enge Parkradien — Top-Speeds sind eher konservativ gemessen.')

const weeks = weeklyTopSpeed(db)
const maxTop = Math.max(...weeks.map((w) => w.top_kmh ?? 0))
console.log(`\nTop-Speed pro Woche\n`)
for (const w of weeks) {
	const bar = w.top_kmh === null ? '' : '█'.repeat(Math.max(1, Math.round((w.top_kmh / maxTop) * 30)))
	const label = w.top_kmh === null ? 'keine GPS-Daten' : fmt(w.top_kmh, 1, ' km/h')
	console.log(
		`${w.week}  ${String(w.sessions).padStart(2)} ${w.sessions === 1 ? 'Session ' : 'Sessions'}  ${label.padStart(9)}  ${bar}`,
	)
}
