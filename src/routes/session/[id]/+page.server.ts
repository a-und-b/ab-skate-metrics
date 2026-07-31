import { error, fail } from '@sveltejs/kit'
import {
	attemptsForSession,
	dailySeries,
	getSession,
	listSessions,
	listTricks,
	trackpointsForSession,
	upsertAttempt,
} from '$lib/server/db'
import { db } from '$lib/server/db/handle'
import { beobachtungen } from '$lib/server/domain/beobachtung'
import { spurGrafik, SPUR_DEFAULTS } from '$lib/server/domain/spur'
import { parseAttempts } from '$lib/server/domain/trick-log'

// ADR-0007: Fuzzing ist Default. Nur eine ausdrückliche Abschaltung deaktiviert es.
const SPUR_OPTIONEN = {
	...SPUR_DEFAULTS,
	fuzz: process.env.GEO_FUZZ !== 'off',
	radiusM: Number(process.env.GEO_FUZZ_RADIUS_M) || SPUR_DEFAULTS.radiusM,
}

function nachbarn(id: number) {
	const alle = listSessions(db)
	const i = alle.findIndex((s) => s.id === id)
	return { vorherige: alle[i - 1]?.id, naechste: alle[i + 1]?.id }
}

export function load({ params }) {
	const id = Number(params.id)
	const session = getSession(db, id)
	if (!session) error(404, 'Session nicht gefunden')
	return {
		session,
		spur: spurGrafik(trackpointsForSession(db, id), SPUR_OPTIONEN),
		gefuzzt: SPUR_OPTIONEN.fuzz,
		tricks: listTricks(db),
		erfasst: attemptsForSession(db, id),
		beobachtungen: beobachtungen(
			listSessions(db),
			dailySeries(db, 'ruhepuls'),
			dailySeries(db, 'hrv'),
			new Date(),
		),
		...nachbarn(id),
	}
}

export const actions = {
	default: async ({ request, params }) => {
		const id = Number(params.id)
		if (!getSession(db, id)) error(404, 'Session nicht gefunden')
		const form = Object.fromEntries(await request.formData()) as Record<string, string>
		const { attempts, fehler } = parseAttempts(form, id, listTricks(db))
		// Eingaben zurückgeben: nach einem Fehler soll niemand neu tippen müssen.
		if (fehler.length > 0) return fail(400, { fehler, werte: form })
		for (const a of attempts) upsertAttempt(db, a)
		return { gespeichert: attempts.length }
	},
}
