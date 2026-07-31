// Dünner CLI-Adapter: ENV lesen → Domain-Funktion → Ausgabe.
import { join } from 'node:path'
import { openDb } from '../src/lib/server/db/index.ts'
import { runIngest } from '../src/lib/server/ingest/index.ts'

try {
	process.loadEnvFile()
} catch {
	// keine .env — ENV kann auch direkt gesetzt sein
}

const exportDir = process.env.HEALTH_EXPORT_PATH
const dataDir = process.env.DATA_DIR
if (!exportDir || !dataDir) {
	console.error('HEALTH_EXPORT_PATH und DATA_DIR setzen (siehe .env.example)')
	process.exit(1)
}

const db = openDb(join(dataDir, 'skate.sqlite'))
const result = await runIngest(db, exportDir, (msg) => console.log(msg))
console.log(`Fertig: ${result.workouts} Sessions gespeichert, davon ${result.withRoute} mit GPS-Route`)
