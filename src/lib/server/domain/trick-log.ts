import { z } from 'zod'
import type { AttemptInput } from '../db/index.ts'

const zeile = z.object({
	versuche: z.coerce.number().int().min(0),
	gestanden: z.coerce.number().int().min(0),
	wertung: z.coerce.number().int().min(1).max(3).optional(),
	notiz: z.string().trim().max(500).optional(),
})

export interface ParseErgebnis {
	attempts: AttemptInput[]
	fehler: string[]
}

/**
 * Übersetzt die Formularfelder (versuche_<trickId> usw.) in AttemptInputs.
 * Tricks ohne Versuche werden übersprungen — wer einen Trick nicht probiert
 * hat, soll dafür keinen Eintrag anlegen müssen.
 */
export function parseAttempts(
	form: Record<string, string>,
	sessionId: number,
	tricks: { id: number; name: string }[],
): ParseErgebnis {
	const attempts: AttemptInput[] = []
	const fehler: string[] = []

	for (const trick of tricks) {
		const roh = {
			versuche: form[`versuche_${trick.id}`] ?? '',
			gestanden: form[`gestanden_${trick.id}`] ?? '',
			wertung: form[`wertung_${trick.id}`] || undefined,
			notiz: form[`notiz_${trick.id}`] || undefined,
		}
		if (roh.versuche.trim() === '') continue

		const parsed = zeile.safeParse(roh)
		if (!parsed.success) {
			fehler.push(`${trick.name}: Versuche und Gestanden müssen ganze Zahlen ab 0 sein`)
			continue
		}
		const { versuche, gestanden, wertung, notiz } = parsed.data
		if (gestanden > versuche) {
			fehler.push(`${trick.name}: ${gestanden} gestanden bei ${versuche} Versuchen — mehr als versucht`)
			continue
		}
		attempts.push({
			sessionId,
			trickId: trick.id,
			versuche,
			gestanden,
			// Eine Wertung ohne gestandenen Versuch hat keinen Bezug.
			wertung: gestanden > 0 ? wertung : undefined,
			notiz,
		})
	}

	return { attempts, fehler }
}
