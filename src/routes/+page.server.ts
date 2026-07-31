import { redirect } from '@sveltejs/kit'
import { listSessions } from '$lib/server/db'
import { db } from '$lib/server/db/handle'

export function load() {
	const sessions = listSessions(db)
	if (sessions.length === 0) return { leer: true }
	// Nie bei null anfangen: direkt in die jüngste Session, das ist der Normalfall.
	redirect(307, `/session/${sessions[sessions.length - 1].id}`)
}
