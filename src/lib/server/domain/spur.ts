import { median } from './metrics.ts'

// ADR-0007: Karte als lokales SVG, kein Tile-Server. Geo-Fuzzing verwirft
// Punkte außerhalb eines Radius um den Median-Punkt — die Anfahrt von zu Hause
// erreicht damit weder den Client noch einen Screenshot.

export interface SpurPunkt {
	t_utc: string
	lat: number
	lon: number
	ele: number | null
	speed_ms: number | null
}

export interface SpurOptionen {
	/** Radius um den Median-Punkt in Metern. */
	radiusM: number
	/** Filterung abschaltbar — Default ist an. */
	fuzz: boolean
	/** Zeichenfläche in SVG-Einheiten. */
	breite: number
	hoehe: number
}

export const SPUR_DEFAULTS: SpurOptionen = { radiusM: 200, fuzz: true, breite: 600, hoehe: 400 }

const ERD_RADIUS_M = 6371000
const GRAD = Math.PI / 180

/**
 * Punkte im Radius um den Median. Median statt Mittelwert: der Mittelwert
 * wandert Richtung Anfahrt, der Median bleibt dort, wo die meiste Zeit
 * verbracht wurde — im Park.
 */
export function imUmkreis(punkte: SpurPunkt[], radiusM: number): SpurPunkt[] {
	if (punkte.length === 0) return []
	const zLat = median(punkte.map((p) => p.lat))
	const zLon = median(punkte.map((p) => p.lon))
	const mProGradLat = ERD_RADIUS_M * GRAD
	const mProGradLon = mProGradLat * Math.cos(zLat * GRAD)
	return punkte.filter((p) => {
		const dy = (p.lat - zLat) * mProGradLat
		const dx = (p.lon - zLon) * mProGradLon
		return Math.hypot(dx, dy) <= radiusM
	})
}

export interface SpurGrafik {
	/** SVG-Pfad der gefahrenen Linie. */
	pfad: string
	/** Länge des Pfads in SVG-Einheiten — speist die Zeichen-Animation. */
	pfadLaenge: number
	/**
	 * CSS-`linear()`-Easing, das Wiedergabe-Zeit auf Pfad-Anteil abbildet.
	 * Ohne das liefe das Replay mit konstanter Weglänge pro Sekunde: Pausen
	 * wären übersprungen und schnelle Abschnitte dauerten am längsten — also
	 * genau umgekehrt zur echten Fahrt.
	 */
	zeitProfil: string
	/** Segmente nach Tempo gestaffelt — für Linienstärke ohne Wertung. */
	segmente: { pfad: string; anteil: number }[]
	/** Geschwindigkeitsprofil über die Zeit, als Flächenpfad. */
	tempoPfad: string
	/** Höhenprofil, falls Höhendaten vorliegen. */
	hoehenPfad: string | null
	/** Kantenlänge des dargestellten Ausschnitts in Metern. */
	spannweiteM: number
	/** Länge eines Maßstabsbalkens in SVG-Einheiten und seine Beschriftung. */
	massstab: { laenge: number; label: string }
	punkte: number
	tempoMaxKmh: number
	dauerMin: number
}

/** Stützstellen des Zeitprofils. 80 reichen für eine flüssige Kurve. */
const PROFIL_STUFEN = 80

/**
 * Bildet gleichmäßige Wiedergabe-Zeit auf den zurückgelegten Pfad-Anteil ab
 * und gibt das Ergebnis als CSS-`linear()`-Easing aus. Damit läuft die
 * Wiedergabe zeitproportional: Stillstand bleibt stehen, schnelle Abschnitte
 * ziehen vorbei — die relative Geschwindigkeit ist sichtbar.
 */
function zeitZuPfadAnteil(
	punkte: SpurPunkt[],
	kumLaenge: number[],
	t0: number,
	dauerMs: number,
): string {
	const gesamt = kumLaenge[kumLaenge.length - 1]
	if (gesamt <= 0) return 'linear'
	const zeiten = punkte.map((p) => new Date(p.t_utc).getTime() - t0)

	const stellen: number[] = []
	let j = 0
	for (let k = 0; k <= PROFIL_STUFEN; k++) {
		const ziel = (k / PROFIL_STUFEN) * dauerMs
		while (j < zeiten.length - 2 && zeiten[j + 1] < ziel) j++
		const spanne = zeiten[j + 1] - zeiten[j]
		// Zwei Punkte in derselben Sekunde kommen vor — dann nicht teilen.
		const anteil = spanne > 0 ? Math.min(1, Math.max(0, (ziel - zeiten[j]) / spanne)) : 0
		const laenge = kumLaenge[j] + (kumLaenge[j + 1] - kumLaenge[j]) * anteil
		stellen.push(Math.min(1, Math.max(0, laenge / gesamt)))
	}
	// linear() erwartet monoton steigende Werte; Rundung darf das nicht brechen.
	let letzter = 0
	const werte = stellen.map((s) => {
		const v = Math.max(letzter, Math.round(s * 1000) / 1000)
		letzter = v
		return v
	})
	werte[werte.length - 1] = 1
	return `linear(${werte.join(',')})`
}

/**
 * Rechnet Trackpoints in fertige SVG-Pfade um. Bewusst serverseitig: so
 * verlassen die Rohkoordinaten den Server nicht, und die Umrechnung ist
 * testbar statt im Markup versteckt.
 */
export function spurGrafik(alle: SpurPunkt[], opt: SpurOptionen = SPUR_DEFAULTS): SpurGrafik | null {
	const punkte = opt.fuzz ? imUmkreis(alle, opt.radiusM) : alle
	if (punkte.length < 2) return null

	const lats = punkte.map((p) => p.lat)
	const lons = punkte.map((p) => p.lon)
	const minLat = Math.min(...lats)
	const maxLat = Math.max(...lats)
	const minLon = Math.min(...lons)
	const maxLon = Math.max(...lons)
	const zLat = (minLat + maxLat) / 2

	// Äquirektangulär mit cos(lat)-Korrektur: auf Parkgröße unter 1 cm Fehler.
	const mProGradLat = ERD_RADIUS_M * GRAD
	const mProGradLon = mProGradLat * Math.cos(zLat * GRAD)
	const breiteM = (maxLon - minLon) * mProGradLon
	const hoeheM = (maxLat - minLat) * mProGradLat
	const spannweiteM = Math.max(breiteM, hoeheM, 1)

	const rand = 12
	const skala = Math.min((opt.breite - 2 * rand) / spannweiteM, (opt.hoehe - 2 * rand) / spannweiteM)
	const versatzX = (opt.breite - breiteM * skala) / 2
	const versatzY = (opt.hoehe - hoeheM * skala) / 2
	const x = (p: SpurPunkt) => versatzX + (p.lon - minLon) * mProGradLon * skala
	// SVG-Y zeigt nach unten, Norden soll oben liegen.
	const y = (p: SpurPunkt) => opt.hoehe - versatzY - (p.lat - minLat) * mProGradLat * skala

	const rund = (n: number) => Math.round(n * 10) / 10
	const pfad = punkte.map((p, i) => `${i === 0 ? 'M' : 'L'}${rund(x(p))} ${rund(y(p))}`).join('')
	// Kumulierte Weglänge je Punkt — Grundlage für die Zuordnung Zeit → Pfadanteil.
	const kumLaenge = [0]
	for (let i = 1; i < punkte.length; i++) {
		kumLaenge.push(
			kumLaenge[i - 1] + Math.hypot(x(punkte[i]) - x(punkte[i - 1]), y(punkte[i]) - y(punkte[i - 1])),
		)
	}
	const pfadLaenge = kumLaenge[kumLaenge.length - 1]

	// Drei Tempostufen als getrennte Pfade. Keine Farbskala: unterschiedliche
	// Strichstärke zeigt Tempo, ohne schnell/langsam zu bewerten.
	const tempi = punkte.map((p) => p.speed_ms ?? 0)
	const tempoMax = Math.max(...tempi, 0.1)
	const STUFEN = 3
	const segmente: { pfad: string; anteil: number }[] = []
	for (let s = 0; s < STUFEN; s++) {
		const von = (tempoMax * s) / STUFEN
		const bis = (tempoMax * (s + 1)) / STUFEN
		let d = ''
		for (let i = 1; i < punkte.length; i++) {
			const v = tempi[i]
			if (v >= von && (v < bis || s === STUFEN - 1)) {
				d += `M${rund(x(punkte[i - 1]))} ${rund(y(punkte[i - 1]))}L${rund(x(punkte[i]))} ${rund(y(punkte[i]))}`
			}
		}
		if (d) segmente.push({ pfad: d, anteil: (s + 1) / STUFEN })
	}

	const t0 = new Date(punkte[0].t_utc).getTime()
	const tEnd = new Date(punkte[punkte.length - 1].t_utc).getTime()
	const dauerMs = Math.max(tEnd - t0, 1)
	const zeitProfil = zeitZuPfadAnteil(punkte, kumLaenge, t0, dauerMs)

	const profil = (werte: (number | null)[], glaetten: number): string | null => {
		const gueltig = werte.map((w, i) => ({ w, i })).filter((e): e is { w: number; i: number } => e.w !== null)
		if (gueltig.length < 2) return null
		const min = Math.min(...gueltig.map((e) => e.w))
		const max = Math.max(...gueltig.map((e) => e.w))
		const spanne = max - min || 1
		const px = (i: number) => ((new Date(punkte[i].t_utc).getTime() - t0) / dauerMs) * opt.breite
		const py = (w: number) => opt.hoehe - ((w - min) / spanne) * (opt.hoehe - 8) - 4
		// Gleitender Mittelwert gegen GPS-Zappeln.
		const g = gueltig.map((e, k, arr) => {
			const von = Math.max(0, k - glaetten)
			const bis = Math.min(arr.length, k + glaetten + 1)
			const fenster = arr.slice(von, bis)
			return { i: e.i, w: fenster.reduce((s, f) => s + f.w, 0) / fenster.length }
		})
		return g.map((e, k) => `${k === 0 ? 'M' : 'L'}${rund(px(e.i))} ${rund(py(e.w))}`).join('')
	}

	// Glättung wächst mit der Punktzahl: bei ~1 Hz zeigt ein rohes Profil
	// jeden Push einzeln, gesucht ist aber der Verlauf. Die Spitzenwerte
	// stehen als Kennzahl daneben und gehen dadurch nicht verloren.
	const fenster = Math.max(3, Math.round(punkte.length / 150))
	const tempoPfad = profil(punkte.map((p) => p.speed_ms), fenster) ?? ''
	const hoehenPfad = profil(punkte.map((p) => p.ele), fenster * 2)

	// Maßstab: runde Meterzahl, die etwa ein Viertel der Breite einnimmt.
	const grob = spannweiteM / 4
	const stufe = [5, 10, 20, 25, 50, 100, 200].find((s) => s >= grob) ?? 200

	return {
		pfad,
		pfadLaenge: Math.ceil(pfadLaenge),
		zeitProfil,
		segmente,
		tempoPfad,
		hoehenPfad,
		spannweiteM: Math.round(spannweiteM),
		massstab: { laenge: rund(stufe * skala), label: `${stufe} m` },
		punkte: punkte.length,
		tempoMaxKmh: tempoMax * 3.6,
		dauerMin: dauerMs / 60000,
	}
}
