import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	attemptsForSession,
	ensureTrick,
	listTricks,
	openDb,
	upsertAttempt,
	upsertSession,
} from './index.ts'

function setup() {
	const db = openDb(':memory:')
	const sessionId = upsertSession(db, {
		startUtc: '2026-07-29T07:54:32.000Z',
		startLocal: '2026-07-29 09:54',
		endUtc: '2026-07-29T08:28:00.000Z',
		durationMin: 34,
	})
	return { db, sessionId }
}

test('Katalog startet mit den Arbeitspunkten, nicht leer', () => {
	const { db } = setup()
	const namen = listTricks(db).map((t) => t.name)
	assert.equal(namen.length, 4)
	assert.ok(namen.includes('Ollie rollend'))
})

test('ensureTrick legt neu an und ist idempotent', () => {
	const { db } = setup()
	const a = ensureTrick(db, 'Shove-it')
	const b = ensureTrick(db, '  Shove-it  ')
	assert.equal(a, b)
	assert.equal(listTricks(db).length, 5)
	assert.throws(() => ensureTrick(db, '   '))
})

test('upsertAttempt überschreibt statt zu duplizieren', () => {
	const { db, sessionId } = setup()
	const trickId = listTricks(db)[0].id
	upsertAttempt(db, { sessionId, trickId, versuche: 10, gestanden: 2 })
	upsertAttempt(db, { sessionId, trickId, versuche: 20, gestanden: 5, wertung: 2 })
	const rows = attemptsForSession(db, sessionId)
	assert.equal(rows.length, 1)
	assert.equal(rows[0].versuche, 20)
	assert.equal(rows[0].wertung, 2)
})

test('gestanden darf versuche nicht übersteigen — DB-Constraint, nicht App-Prüfung', () => {
	const { db, sessionId } = setup()
	const trickId = listTricks(db)[0].id
	assert.throws(() => upsertAttempt(db, { sessionId, trickId, versuche: 3, gestanden: 4 }))
})

test('Wertung nur 1 bis 3', () => {
	const { db, sessionId } = setup()
	const trickId = listTricks(db)[0].id
	assert.throws(() => upsertAttempt(db, { sessionId, trickId, versuche: 5, gestanden: 1, wertung: 4 }))
	upsertAttempt(db, { sessionId, trickId, versuche: 5, gestanden: 0 })
	assert.equal(attemptsForSession(db, sessionId)[0].wertung, null)
})

test('inaktive Tricks verschwinden aus der Vorbefüllung, bleiben aber in der Historie', () => {
	const { db, sessionId } = setup()
	const trickId = listTricks(db)[0].id
	upsertAttempt(db, { sessionId, trickId, versuche: 8, gestanden: 3, wertung: 1 })
	db.prepare('UPDATE trick SET aktiv = 0 WHERE id = ?').run(trickId)
	assert.equal(listTricks(db).length, 3)
	assert.equal(listTricks(db, false).length, 4)
	assert.equal(attemptsForSession(db, sessionId).length, 1)
})
