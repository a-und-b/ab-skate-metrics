import { DatabaseSync } from 'node:sqlite'

// Schemaänderungen: immer eine NEUE Migration anhängen, nie eine bestehende editieren.
const MIGRATIONS: string[] = [
	`
	CREATE TABLE session (
		id INTEGER PRIMARY KEY,
		start_utc TEXT NOT NULL UNIQUE,
		start_local TEXT NOT NULL,
		end_utc TEXT NOT NULL,
		duration_min REAL NOT NULL,
		distance_km REAL,
		distance_source TEXT,
		avg_moving_kmh REAL,
		top_kmh REAL,
		moving_share REAL,
		kcal REAL,
		hr_avg REAL,
		hr_max REAL,
		gpx_file TEXT
	);
	CREATE TABLE trackpoint (
		session_id INTEGER NOT NULL REFERENCES session(id) ON DELETE CASCADE,
		t_utc TEXT NOT NULL,
		lat REAL NOT NULL,
		lon REAL NOT NULL,
		ele REAL,
		speed_ms REAL,
		h_acc REAL
	);
	CREATE INDEX trackpoint_session_idx ON trackpoint(session_id);
	`,
]

export function openDb(path: string): DatabaseSync {
	const db = new DatabaseSync(path)
	db.exec('PRAGMA journal_mode = WAL')
	db.exec('PRAGMA foreign_keys = ON')
	const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number }
	for (let v = user_version; v < MIGRATIONS.length; v++) {
		db.exec('BEGIN')
		db.exec(MIGRATIONS[v])
		db.exec(`PRAGMA user_version = ${v + 1}`)
		db.exec('COMMIT')
	}
	return db
}

export interface SessionInput {
	startUtc: string
	startLocal: string
	endUtc: string
	durationMin: number
	distanceKm?: number
	distanceSource?: 'watch' | 'gpx'
	avgMovingKmh?: number
	topKmh?: number
	movingShare?: number
	kcal?: number
	hrAvg?: number
	hrMax?: number
	gpxFile?: string
}

export function upsertSession(db: DatabaseSync, s: SessionInput): number {
	const row = db
		.prepare(
			`INSERT INTO session
				(start_utc, start_local, end_utc, duration_min, distance_km, distance_source,
				 avg_moving_kmh, top_kmh, moving_share, kcal, hr_avg, hr_max, gpx_file)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(start_utc) DO UPDATE SET
				start_local = excluded.start_local,
				end_utc = excluded.end_utc,
				duration_min = excluded.duration_min,
				distance_km = excluded.distance_km,
				distance_source = excluded.distance_source,
				avg_moving_kmh = excluded.avg_moving_kmh,
				top_kmh = excluded.top_kmh,
				moving_share = excluded.moving_share,
				kcal = excluded.kcal,
				hr_avg = excluded.hr_avg,
				hr_max = excluded.hr_max,
				gpx_file = excluded.gpx_file
			 RETURNING id`,
		)
		.get(
			s.startUtc,
			s.startLocal,
			s.endUtc,
			s.durationMin,
			s.distanceKm ?? null,
			s.distanceSource ?? null,
			s.avgMovingKmh ?? null,
			s.topKmh ?? null,
			s.movingShare ?? null,
			s.kcal ?? null,
			s.hrAvg ?? null,
			s.hrMax ?? null,
			s.gpxFile ?? null,
		) as { id: number }
	return row.id
}

export interface TrackpointInput {
	tUtc: string
	lat: number
	lon: number
	ele?: number
	speedMs?: number
	hAcc?: number
}

export function replaceTrackpoints(db: DatabaseSync, sessionId: number, points: TrackpointInput[]): void {
	db.exec('BEGIN')
	try {
		db.prepare('DELETE FROM trackpoint WHERE session_id = ?').run(sessionId)
		const ins = db.prepare(
			'INSERT INTO trackpoint (session_id, t_utc, lat, lon, ele, speed_ms, h_acc) VALUES (?, ?, ?, ?, ?, ?, ?)',
		)
		for (const p of points) {
			ins.run(sessionId, p.tUtc, p.lat, p.lon, p.ele ?? null, p.speedMs ?? null, p.hAcc ?? null)
		}
		db.exec('COMMIT')
	} catch (e) {
		db.exec('ROLLBACK')
		throw e
	}
}

export interface SessionRow {
	id: number
	start_local: string
	duration_min: number
	distance_km: number | null
	distance_source: string | null
	avg_moving_kmh: number | null
	top_kmh: number | null
	moving_share: number | null
	kcal: number | null
	hr_avg: number | null
	hr_max: number | null
	gpx_file: string | null
}

export function listSessions(db: DatabaseSync): SessionRow[] {
	return db.prepare('SELECT * FROM session ORDER BY start_utc').all() as unknown as SessionRow[]
}

export interface WeekRow {
	week: string
	sessions: number
	top_kmh: number | null
}

export function weeklyTopSpeed(db: DatabaseSync): WeekRow[] {
	return db
		.prepare(
			`SELECT strftime('%Y-W%W', start_local) AS week, COUNT(*) AS sessions, MAX(top_kmh) AS top_kmh
			 FROM session GROUP BY week ORDER BY week`,
		)
		.all() as unknown as WeekRow[]
}
