<script lang="ts">
	import { WERTUNG_LABELS } from '$lib/wertung'

	let { data, form } = $props()

	const erfasst = $derived(new Map(data.erfasst.map((e) => [e.trick_id, e])))

	// Nach einem Fehler gilt die letzte Eingabe, sonst der gespeicherte Stand.
	const wert = (feld: string, gespeichert: string | number | null | undefined) =>
		form?.werte?.[feld] ?? gespeichert ?? ''
	const zahl = (n: number | null, digits: number, einheit: string) =>
		n === null ? null : `${n.toFixed(digits).replace('.', ',')} ${einheit}`

	const kennzahlen = $derived(
		[
			zahl(data.session.duration_min, 0, 'min'),
			zahl(data.session.distance_km, 1, 'km'),
			data.session.hr_avg === null ? null : `Puls ⌀ ${Math.round(data.session.hr_avg)}`,
			zahl(data.session.top_kmh, 1, 'km/h Top'),
		].filter((k): k is string => k !== null),
	)
</script>

<main class="mx-auto max-w-md p-4 pb-28">
	<header class="mb-6">
		<h1 class="text-xl font-semibold">{data.session.start_local} Uhr</h1>
		<p class="mt-1 text-sm text-text-leise">{kennzahlen.join(' · ')}</p>
		<nav class="mt-3 flex justify-between text-sm">
			{#if data.vorherige}
				<a class="text-text-leise underline" href="/session/{data.vorherige}">vorherige Session</a>
			{:else}<span></span>{/if}
			{#if data.naechste}
				<a class="text-text-leise underline" href="/session/{data.naechste}">nächste Session</a>
			{/if}
		</nav>
	</header>

	{#if form?.fehler}
		<div class="mb-4 rounded border border-hinweis p-3 text-sm">
			<ul class="list-inside list-disc">
				{#each form.fehler as f}<li>{f}</li>{/each}
			</ul>
		</div>
	{:else if form?.gespeichert !== undefined}
		<p class="mb-4 rounded bg-flaeche-leise p-3 text-sm">
			{form.gespeichert}
			{form.gespeichert === 1 ? 'Trick' : 'Tricks'} gespeichert. Erneutes Speichern überschreibt.
		</p>
	{/if}

	<form method="POST">
		<ul class="space-y-7">
			{#each data.tricks as trick}
				{@const vorhanden = erfasst.get(trick.id)}
				<li>
					<h2 class="font-medium">{trick.name}</h2>
					<div class="mt-2 flex gap-3">
						<label class="flex-1">
							<span class="block text-sm text-text-leise">Versuche</span>
							<input
								class="mt-1 w-full rounded border border-rand bg-flaeche p-3 text-lg"
								type="number"
								inputmode="numeric"
								min="0"
								name="versuche_{trick.id}"
								value={wert(`versuche_${trick.id}`, vorhanden?.versuche)}
							/>
						</label>
						<label class="flex-1">
							<span class="block text-sm text-text-leise">davon gestanden</span>
							<input
								class="mt-1 w-full rounded border border-rand bg-flaeche p-3 text-lg"
								type="number"
								inputmode="numeric"
								min="0"
								name="gestanden_{trick.id}"
								value={wert(`gestanden_${trick.id}`, vorhanden?.gestanden)}
							/>
						</label>
					</div>
					<fieldset class="mt-2">
						<legend class="text-sm text-text-leise">Wie standen sie?</legend>
						<div class="mt-1 flex gap-2">
							{#each WERTUNG_LABELS as label, i}
								<label
									class="flex-1 cursor-pointer rounded border border-rand p-2 text-center text-sm
										has-checked:border-text has-checked:bg-text has-checked:text-flaeche
										has-focus-visible:outline has-focus-visible:outline-2"
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
						class="mt-2 w-full rounded border border-rand bg-flaeche p-2 text-sm"
						type="text"
						name="notiz_{trick.id}"
						aria-label="Notiz zu {trick.name}"
						placeholder="Notiz (optional)"
						value={wert(`notiz_${trick.id}`, vorhanden?.notiz)}
					/>
				</li>
			{/each}
		</ul>

		<div class="fixed inset-x-0 bottom-0 bg-flaeche p-3">
			<button
				class="mx-auto block w-full max-w-md rounded-lg bg-text p-4 text-lg font-medium text-flaeche"
				type="submit">Speichern</button
			>
		</div>
	</form>
</main>
