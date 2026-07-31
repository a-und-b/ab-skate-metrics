<script lang="ts">
	import { BEOBACHTUNG_UEBERSCHRIFT, beobachtungText } from '$lib/beobachtung-text'
	import { WERTUNG_LABELS } from '$lib/wertung'

	let { data, form } = $props()

	const erfasst = $derived(new Map(data.erfasst.map((e) => [e.trick_id, e])))

	// Nach einem Fehler gilt die letzte Eingabe, sonst der gespeicherte Stand.
	const wert = (feld: string, gespeichert: string | number | null | undefined) =>
		form?.werte?.[feld] ?? gespeichert ?? ''

	const zahl = (n: number | null, digits = 1) =>
		n === null ? '—' : n.toFixed(digits).replace('.', ',')

	// Datenblatt: Label, Wert, Einheit getrennt — nie ein nackter Wert (Briefing 9).
	const kennzahlen = $derived([
		{ marke: 'Dauer', wert: zahl(data.session.duration_min, 0), einheit: 'min' },
		{
			marke: 'Distanz',
			wert: zahl(data.session.distance_km),
			einheit: data.session.distance_source === 'gpx' ? 'km *' : 'km',
		},
		{ marke: 'Ø fahrend', wert: zahl(data.session.avg_moving_kmh), einheit: 'km/h' },
		{ marke: 'Top', wert: zahl(data.session.top_kmh), einheit: 'km/h' },
		{
			marke: 'Bewegung',
			wert: data.session.moving_share === null ? '—' : zahl(data.session.moving_share * 100, 0),
			einheit: '%',
		},
		{ marke: 'Puls ⌀', wert: zahl(data.session.hr_avg, 0), einheit: 'bpm' },
		{ marke: 'Puls max', wert: zahl(data.session.hr_max, 0), einheit: 'bpm' },
		{ marke: 'Energie', wert: zahl(data.session.kcal, 0), einheit: 'kcal' },
	])

	const datum = $derived(data.session.start_local.slice(0, 10).split('-').reverse().join('.'))
	const uhrzeit = $derived(data.session.start_local.slice(11))

	// --- Wiedergabe der Spur ---------------------------------------------
	// Die Animation folgt der Zeit, nicht der Weglänge: das Easing aus
	// spur.ts bildet Wiedergabe-Zeit auf Pfad-Anteil ab. Dadurch steht ein
	// Stillstand auch in der Wiedergabe still und schnelle Abschnitte ziehen
	// vorbei. Web Animations API statt CSS, damit ein Tempowechsel im Lauf
	// nahtlos greift (playbackRate) statt neu zu starten.
	/** 1× ist Echtzeit: die Wiedergabe dauert so lang wie die Session selbst. */
	const TEMPI = [0.25, 0.5, 1, 2, 4, 8, 16]

	let tempo = $state(1)
	/** Die vollständige Spur als schwacher Hintergrund. Aus: der Pfad wächst blank. */
	let kontext = $state(true)
	// Expliziter Zustand: playState der Animation ist nicht reaktiv.
	let zustand = $state<'ruht' | 'laeuft' | 'pausiert'>('ruht')
	let pfadEl = $state<SVGPathElement | null>(null)
	let markerEl = $state<SVGCircleElement | null>(null)
	let animationen: Animation[] = []

	// Grunddauer ist die echte Aufzeichnungsdauer; das Tempo skaliert über
	// playbackRate. So ist 1× tatsächlich Echtzeit und nicht bloß ein Etikett.
	const dauerMs = $derived((data.spur?.dauerMin ?? 0) * 60_000)

	const wiedergabeMin = $derived(dauerMs / tempo / 60_000)
	const dauerText = $derived(
		wiedergabeMin >= 1
			? `${wiedergabeMin.toFixed(wiedergabeMin < 10 ? 1 : 0).replace('.', ',')} min`
			: `${Math.round(wiedergabeMin * 60)} s`,
	)

	function abbrechen() {
		for (const a of animationen) a.cancel()
		animationen = []
		if (pfadEl) pfadEl.style.strokeDasharray = ''
	}

	function starten() {
		if (!data.spur || !pfadEl) return
		abbrechen()
		const optionen: KeyframeAnimationOptions = {
			duration: dauerMs,
			easing: data.spur.zeitProfil,
			fill: 'forwards',
		}
		pfadEl.style.strokeDasharray = String(data.spur.pfadLaenge)
		animationen = [
			pfadEl.animate(
				[
					{ strokeDashoffset: data.spur.pfadLaenge },
					{ strokeDashoffset: 0 },
				],
				optionen,
			),
		]
		if (markerEl) {
			animationen.push(markerEl.animate([{ offsetDistance: '0%' }, { offsetDistance: '100%' }], optionen))
		}
		for (const a of animationen) a.playbackRate = tempo
		animationen[0].addEventListener('finish', () => {
			// Nach dem Durchlauf wieder die vollständige Spur zeigen.
			abbrechen()
			zustand = 'ruht'
		})
		zustand = 'laeuft'
	}

	/** Von vorn — auch mitten im Lauf oder aus der Pause heraus. */
	function neustarten() {
		starten()
	}

	function umschalten() {
		if (zustand === 'ruht') return starten()
		if (zustand === 'laeuft') {
			for (const a of animationen) a.pause()
			zustand = 'pausiert'
		} else {
			for (const a of animationen) a.play()
			zustand = 'laeuft'
		}
	}

	function tempoSetzen(t: number) {
		tempo = t
		for (const a of animationen) a.playbackRate = t
	}
</script>

<div class="mx-auto max-w-2xl px-4 pt-6 pb-28">
	<header class="border-b border-rand pb-4">
		<nav class="marke mb-3 flex justify-between">
			{#if data.vorherige}
				<a class="hover:text-text" href="/session/{data.vorherige}">← vorherige</a>
			{:else}<span></span>{/if}
			{#if data.naechste}<a class="hover:text-text" href="/session/{data.naechste}">nächste →</a>{/if}
		</nav>
		<h1 class="flex items-baseline gap-3">
			<span class="zahl text-4xl font-medium tracking-tight">{datum}</span>
			<span class="zahl text-lg text-text-leise">{uhrzeit} Uhr</span>
		</h1>
	</header>

	<!-- Datenblatt statt Kacheln: Werte in einer Zeile, durch feine Linien getrennt. -->
	<dl class="grid grid-cols-4 border-b border-rand">
		{#each kennzahlen as k, i}
			<div
				class="border-rand px-2 py-3 {i % 4 !== 3 ? 'border-r' : ''} {i < 4 ? 'border-b' : ''}"
			>
				<dt class="marke whitespace-nowrap">{k.marke}</dt>
				<dd class="zahl mt-1 text-xl leading-none">
					{k.wert}<span class="ml-1 text-[0.6rem] text-text-leise">{k.einheit}</span>
				</dd>
			</div>
		{/each}
	</dl>

	{#if data.spur}
		<figure class="mt-8">
			<figcaption class="marke mb-2 flex items-baseline justify-between">
				<span>Spur · {data.spur.punkte} Punkte</span>
				<span>Ausschnitt {data.spur.spannweiteM} m</span>
			</figcaption>

			<div class="relative border border-rand bg-flaeche">
				<!-- Ecken-Marken wie auf einer technischen Zeichnung -->
				{#each [['top-0 left-0', 'border-t border-l'], ['top-0 right-0', 'border-t border-r'], ['bottom-0 left-0', 'border-b border-l'], ['bottom-0 right-0', 'border-b border-r']] as [pos, kanten]}
					<span class="pointer-events-none absolute {pos} {kanten} m-1 h-2 w-2 border-text-leise"
					></span>
				{/each}

				<svg viewBox="0 0 600 400" class="block w-full" role="img" aria-label="Gefahrene Spur der Session">
					<defs>
						<pattern id="raster" width="20" height="20" patternUnits="userSpaceOnUse">
							<path d="M20 0H0V20" fill="none" stroke="var(--color-raster)" stroke-width="1" />
						</pattern>
					</defs>
					<rect width="600" height="400" fill="url(#raster)" />

					<!-- Kontext-Layer: die vollständige Spur, nur angedeutet. Langsame
					     Abschnitte dünn, schnelle kräftig — Strichstärke statt Farbskala,
					     das zeigt Tempo, ohne schnell/langsam zu bewerten. -->
					{#if kontext}
						{#each data.spur.segmente as seg}
							<path
								d={seg.pfad}
								fill="none"
								stroke="var(--color-text)"
								stroke-width={0.6 + seg.anteil * 1.6}
								stroke-opacity={0.06 + seg.anteil * 0.12}
								stroke-linecap="round"
							/>
						{/each}
					{/if}

					<path
						bind:this={pfadEl}
						d={data.spur.pfad}
						fill="none"
						stroke="var(--color-text)"
						stroke-width="1.1"
						stroke-opacity="0.85"
						stroke-linejoin="round"
						stroke-linecap="round"
					/>

					<!-- Läuft die Spur entlang und macht das Tempo sichtbar:
					     bei Stillstand steht er, bei schneller Fahrt zieht er. -->
					<circle
						bind:this={markerEl}
						r="4"
						fill="var(--color-hinweis)"
						style="offset-path: path('{data.spur.pfad}'); offset-rotate: 0deg;"
						opacity={zustand === 'ruht' ? 0 : 1}
					/>

					<g transform="translate(16, 384)">
						<path
							d="M0 -4V0H{data.spur.massstab.laenge}V-4"
							fill="none"
							stroke="var(--color-text-leise)"
							stroke-width="1"
						/>
						<text x={data.spur.massstab.laenge / 2} y="-7" text-anchor="middle"
							fill="var(--color-text-leise)" font-size="9" font-family="var(--font-mono)"
							>{data.spur.massstab.label}</text
						>
					</g>
				</svg>
			</div>

			<div class="mt-2 border border-rand">
				<div class="flex items-stretch justify-between border-b border-rand">
					<div class="flex items-stretch">
						<button
							type="button"
							onclick={umschalten}
							class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-flaeche-leise"
							aria-label={zustand === 'laeuft' ? 'Wiedergabe anhalten' : 'Spur abspielen'}
						>
							<svg viewBox="0 0 12 12" class="h-3 w-3" aria-hidden="true" fill="currentColor">
								{#if zustand === 'laeuft'}
									<rect x="1" y="1" width="3.5" height="10" /><rect
										x="7.5"
										y="1"
										width="3.5"
										height="10"
									/>
								{:else}
									<path d="M2 1L11 6L2 11Z" />
								{/if}
							</svg>
							{zustand === 'laeuft' ? 'Pause' : zustand === 'pausiert' ? 'Weiter' : 'Abspielen'}
						</button>
						<button
							type="button"
							onclick={neustarten}
							class="border-l border-rand px-3 py-2 hover:bg-flaeche-leise"
							aria-label="Wiedergabe von vorn"
							title="Von vorn"
						>
							<svg viewBox="0 0 12 12" class="h-3.5 w-3.5" aria-hidden="true">
								<path
									d="M10 6A4 4 0 1 1 6 2"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
								/>
								<path d="M6 0L6 4L2.6 2Z" fill="currentColor" />
							</svg>
						</button>
					</div>

					<button
						type="button"
						onclick={() => (kontext = !kontext)}
						aria-pressed={kontext}
						class="marke border-l border-rand px-3 hover:bg-flaeche-leise
							{kontext ? 'text-text' : ''}"
					>
						Kontext {kontext ? 'an' : 'aus'}
					</button>
				</div>

				<div class="grid grid-cols-7" role="group" aria-label="Wiedergabetempo">
					{#each TEMPI as t, i}
						<button
							type="button"
							onclick={() => tempoSetzen(t)}
							aria-pressed={tempo === t}
							class="zahl py-2 text-[0.7rem] {i > 0 ? 'border-l border-rand' : ''}
								{tempo === t ? 'bg-text text-flaeche' : 'text-text-leise hover:bg-flaeche-leise'}"
						>
							{t.toString().replace('.', ',')}×
						</button>
					{/each}
				</div>
			</div>

			<p class="mt-2 text-xs text-text-leise">
				{#if data.gefuzzt}
					Kartenausschnitt auf den Park begrenzt — An- und Abfahrt werden nicht dargestellt.
				{/if}
				Die Wiedergabe folgt der Zeit: Pausen stehen still, schnelle Abschnitte ziehen vorbei.
				1× ist Echtzeit — die Session dauerte {Math.round(data.spur.dauerMin)} Minuten, der
				Durchlauf braucht {dauerText}.
			</p>
		</figure>

		<div class="mt-8 grid gap-6 sm:grid-cols-2">
			{#each [{ titel: 'Tempo über die Zeit', pfad: data.spur.tempoPfad, spitze: `${zahl(data.spur.tempoMaxKmh)} km/h` }, { titel: 'Höhe über die Zeit', pfad: data.spur.hoehenPfad, spitze: 'GPS, ± einige Meter' }] as profil}
				{#if profil.pfad}
					<figure>
						<figcaption class="marke mb-2 flex justify-between">
							<span>{profil.titel}</span><span>{profil.spitze}</span>
						</figcaption>
						<svg
							viewBox="0 0 600 400"
							preserveAspectRatio="none"
							class="block h-24 w-full border border-rand bg-flaeche"
							role="img"
							aria-label={profil.titel}
						>
							<rect width="600" height="400" fill="url(#raster)" />
							<path
								d={profil.pfad}
								fill="none"
								stroke="var(--color-text)"
								stroke-width="4"
								vector-effect="non-scaling-stroke"
								stroke-linejoin="round"
							/>
						</svg>
					</figure>
				{/if}
			{/each}
		</div>
	{:else}
		<p class="marke mt-8 border border-rand p-4">Für diese Session liegen keine GPS-Daten vor</p>
	{/if}

	{#if data.beobachtungen.length > 0}
		<section class="mt-8 border-l-2 border-hinweis pl-4">
			<h2 class="marke mb-2">{BEOBACHTUNG_UEBERSCHRIFT}</h2>
			<ul class="space-y-1.5 text-sm text-text-leise">
				{#each data.beobachtungen as b}<li>{beobachtungText(b)}</li>{/each}
			</ul>
		</section>
	{/if}

	<section class="mt-10">
		<h2 class="marke border-b border-rand pb-2">Tricks dieser Session</h2>

		{#if form?.fehler}
			<div class="mt-4 border border-hinweis p-3 text-sm">
				<ul class="space-y-1">
					{#each form.fehler as f}<li>{f}</li>{/each}
				</ul>
			</div>
		{:else if form?.gespeichert !== undefined}
			<p class="mt-4 border border-rand bg-flaeche-leise p-3 text-sm">
				{form.gespeichert}
				{form.gespeichert === 1 ? 'Trick' : 'Tricks'} gespeichert. Erneutes Speichern überschreibt.
			</p>
		{/if}

		<form method="POST">
			<ul>
				{#each data.tricks as trick}
					{@const vorhanden = erfasst.get(trick.id)}
					<li class="border-b border-rand py-5">
						<h3 class="font-medium tracking-tight">{trick.name}</h3>
						<div class="mt-3 flex gap-3">
							<label class="flex-1">
								<span class="marke block">Versuche</span>
								<input
									class="zahl mt-1 w-full border border-rand bg-flaeche p-3 text-lg focus:border-text focus:outline-none"
									type="number"
									inputmode="numeric"
									min="0"
									name="versuche_{trick.id}"
									value={wert(`versuche_${trick.id}`, vorhanden?.versuche)}
								/>
							</label>
							<label class="flex-1">
								<span class="marke block">davon gestanden</span>
								<input
									class="zahl mt-1 w-full border border-rand bg-flaeche p-3 text-lg focus:border-text focus:outline-none"
									type="number"
									inputmode="numeric"
									min="0"
									name="gestanden_{trick.id}"
									value={wert(`gestanden_${trick.id}`, vorhanden?.gestanden)}
								/>
							</label>
						</div>
						<fieldset class="mt-3">
							<legend class="marke">Wie standen sie?</legend>
							<div class="mt-1 flex gap-2">
								{#each WERTUNG_LABELS as label, i}
									<label
										class="flex-1 cursor-pointer border border-rand p-2 text-center text-sm
											transition-colors has-checked:border-text has-checked:bg-text
											has-checked:text-flaeche has-focus-visible:outline has-focus-visible:outline-2"
									>
										<input
											class="sr-only"
											type="radio"
											aria-label="{trick.name}: {label} gestanden"
											name="wertung_{trick.id}"
											value={i + 1}
											checked={Number(wert(`wertung_${trick.id}`, vorhanden?.wertung)) === i + 1}
										/>
										{label}
									</label>
								{/each}
							</div>
						</fieldset>
						<input
							class="mt-3 w-full border border-rand bg-flaeche p-2 text-sm focus:border-text focus:outline-none"
							type="text"
							name="notiz_{trick.id}"
							aria-label="Notiz zu {trick.name}"
							placeholder="Notiz (optional)"
							value={wert(`notiz_${trick.id}`, vorhanden?.notiz)}
						/>
					</li>
				{/each}
			</ul>

			<div class="fixed inset-x-0 bottom-0 border-t border-rand bg-flaeche p-3">
				<button
					class="mx-auto block w-full max-w-2xl bg-text p-4 font-medium tracking-wide text-flaeche
						transition-opacity hover:opacity-90"
					type="submit">Speichern</button
				>
			</div>
		</form>
	</section>

	{#if data.session.distance_source === 'gpx'}
		<p class="marke mt-6">* Distanz aus der GPS-Spur gerechnet, keine Distanz von der Uhr</p>
	{/if}
</div>
