import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseAttempts } from './trick-log.ts'

const TRICKS = [
	{ id: 1, name: 'Ollie rollend' },
	{ id: 2, name: 'Boneless' },
]

test('Tricks ohne Eingabe erzeugen keinen Eintrag', () => {
	const { attempts, fehler } = parseAttempts({}, 5, TRICKS)
	assert.equal(attempts.length, 0)
	assert.equal(fehler.length, 0)
})

test('gültige Zeile wird übernommen', () => {
	const { attempts, fehler } = parseAttempts(
		{ versuche_1: '20', gestanden_1: '3', wertung_1: '2', notiz_1: '  besser  ' },
		5,
		TRICKS,
	)
	assert.equal(fehler.length, 0)
	assert.deepEqual(attempts, [
		{ sessionId: 5, trickId: 1, versuche: 20, gestanden: 3, wertung: 2, notiz: 'besser' },
	])
})

test('gestanden > versuche wird benannt, ohne die anderen Tricks zu verlieren', () => {
	const { attempts, fehler } = parseAttempts(
		{ versuche_1: '10', gestanden_1: '2', versuche_2: '3', gestanden_2: '5' },
		5,
		TRICKS,
	)
	assert.equal(attempts.length, 1)
	assert.equal(attempts[0].trickId, 1)
	assert.equal(fehler.length, 1)
	assert.match(fehler[0], /Boneless/)
})

test('Wertung ohne gestandenen Versuch wird verworfen', () => {
	const { attempts } = parseAttempts({ versuche_1: '8', gestanden_1: '0', wertung_1: '3' }, 5, TRICKS)
	assert.equal(attempts[0].wertung, undefined)
})

test('unsinnige Eingaben werden gemeldet, nicht durchgereicht', () => {
	for (const roh of [{ versuche_1: 'viele', gestanden_1: '1' }, { versuche_1: '-3', gestanden_1: '0' }]) {
		const { attempts, fehler } = parseAttempts(roh, 5, TRICKS)
		assert.equal(attempts.length, 0)
		assert.equal(fehler.length, 1)
	}
})

test('0 Versuche ist gültig — Trick probiert, nichts gestanden zählt trotzdem', () => {
	const { attempts, fehler } = parseAttempts({ versuche_1: '0', gestanden_1: '0' }, 5, TRICKS)
	assert.equal(fehler.length, 0)
	assert.equal(attempts.length, 1)
	assert.equal(attempts[0].versuche, 0)
})
