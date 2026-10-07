/**
 * The single place the olive direction is spent, and the one place the palette
 * would lose its meaning if it were repeated elsewhere (docs/DESIGN.md §5).
 *
 * It marks "now", so it never relies on colour alone: the gold line is joined by
 * the label "Ahora" and by the time in text, which is what WCAG 1.4.11 asks of a
 * graphic that carries information.
 *
 * `--accent-strong` rather than `--accent`: light oil on cal is 2,25:1, fine as a
 * fill under dark text but too low for a marker that has to be seen (design.md D6).
 *
 * The clock is Europe/Madrid, matching how dates are stored and presented
 * (AGENTS.md §5). Rendered on the server-computable side of nothing in
 * particular: it is static text that only changes when the view is revisited,
 * which is enough for a placeholder and costs no timer.
 */
export function NowMarker() {
	const time = new Intl.DateTimeFormat("es-ES", {
		timeZone: "Europe/Madrid",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date());

	return (
		<div
			data-slot="now-marker"
			className="flex items-center gap-2 border-b border-border py-3 text-sm"
		>
			<span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent-strong" />
			<span className="font-medium text-foreground">Ahora</span>
			<span className="text-muted-foreground tabular-nums">{time}</span>
		</div>
	);
}
