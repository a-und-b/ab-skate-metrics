import { join } from 'node:path'
import { openDb } from './index.ts'

// Ein Handle pro Prozess. Die Domain-Funktionen bekommen es als Parameter
// übergeben (Briefing 3) — hier wird es nur einmal beschafft.
try {
	process.loadEnvFile()
} catch {
	// keine .env — ENV kann auch direkt gesetzt sein
}

export const db = openDb(join(process.env.DATA_DIR ?? 'data', 'skate.sqlite'))
