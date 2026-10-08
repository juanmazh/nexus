import { epochMsToDueDate, epochMsToLocalDateTime, localDateTimeToEpochMs } from "@shared/dates";

/**
 * The one-tap times of the detail (add-reminders design.md D10), computed as
 * wall-clock times of `tz` because that is what the API takes.
 *
 * A shortcut whose time is 5 minutes away or less is left out: by the time the
 * request arrives it could already be in the past, and the API would reject it.
 */

export type Shortcut = { label: string; value: string };

const MINUTE = 60_000;
/** The closest a shortcut may be; also the cron's own resolution. */
const MARGIN = 5 * MINUTE;

/** `YYYY-MM-DD` plus `days`, on the calendar, with no instant in between. */
function addDays(date: string, days: number): string {
	const [year, month, day] = date.split("-").map(Number);
	const next = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
	return next.toISOString().slice(0, 10);
}

function inFuture(value: string, now: number, tz: string): boolean {
	const parsed = localDateTimeToEpochMs(value, tz);
	return parsed.ok && parsed.ms - now > MARGIN;
}

export function reminderShortcuts(now: number, dueAt: number | null, tz: string): Shortcut[] {
	const today = epochMsToDueDate(now, tz) ?? "";
	// "In an hour", rounded **up** to a multiple of five: 18:33 → 19:35, so the
	// time reads clean and is never less than an hour away.
	const inAnHour = Math.ceil((now + 60 * MINUTE) / MARGIN) * MARGIN;

	const candidates: Shortcut[] = [
		{ label: "En 1 h", value: epochMsToLocalDateTime(inAnHour, tz) },
		{ label: "Esta tarde 18:00", value: `${today}T18:00` },
		{ label: "Mañana 9:00", value: `${addDays(today, 1)}T09:00` },
	];
	if (dueAt !== null) {
		candidates.push({
			label: "El día que vence 9:00",
			value: `${epochMsToDueDate(dueAt, tz)}T09:00`,
		});
	}

	const seen = new Set<string>();
	return candidates.filter((shortcut) => {
		if (seen.has(shortcut.value) || !inFuture(shortcut.value, now, tz)) {
			return false;
		}
		seen.add(shortcut.value);
		return true;
	});
}
