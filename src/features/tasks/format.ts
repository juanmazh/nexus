/**
 * "vie 10 oct": short, unambiguous within a year and narrow enough for a row at
 * 320 px. Always in the app's timezone, never in the device's, so a trip abroad
 * does not move a task to another day.
 */
export function formatShortDate(ms: number, tz: string): string {
	return new Intl.DateTimeFormat("es-ES", {
		timeZone: tz,
		weekday: "short",
		day: "numeric",
		month: "short",
	})
		.format(ms)
		.replace(",", "")
		.replace(/\./g, "");
}

export function pendingCountLabel(count: number): string {
	if (count === 0) {
		return "Nada pendiente";
	}
	return count === 1 ? "1 pendiente" : `${count} pendientes`;
}
