import { TZDate } from "@date-fns/tz";
import { startOfDay } from "date-fns";

/**
 * The one place where "which day is this?" is decided.
 *
 * Everything here is pure and free of the DOM, because the same rule has to run
 * in the Worker (to answer `overdue`), in the SPA (to sort the list into sections)
 * and in the tests. A second copy of this arithmetic would drift, and it would
 * drift silently: a task would appear under "Vencidas" in one place and "Hoy" in
 * another, with nothing failing.
 *
 * The convention is that `due_at` holds the **00:00 of the chosen day in `tz`**.
 * A task due today stays in today for the whole day, which is what the person
 * expects, instead of expiring at midnight.
 */

/** What `<input type="date">` gives and `epochMsToDueDate` gives back. */
const DUE_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Epoch ms of the first instant of the local day of `tz` that `now` falls in.
 *
 * This is the boundary `overdue` compares against: a task whose day has already
 * passed is overdue, and today's tasks never are, however late it is.
 */
export function zonedDayStart(now: Date, tz: string): number {
	return startOfDay(new TZDate(now.getTime(), tz)).getTime();
}

/**
 * The local day of `tz` as `yyyymmdd`, so two days can be compared with `>` and
 * the value survives being serialized. Comparing instants would drag the DST
 * arithmetic into every component that only wants to know the day.
 */
export function zonedDayNumber(ms: number, tz: string): number {
	const day = new TZDate(ms, tz);
	return Number(
		`${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, "0")}${String(day.getDate()).padStart(2, "0")}`,
	);
}

/**
 * `YYYY-MM-DD` → epoch ms of 00:00 of that day in `tz`.
 *
 * The calendar parts go straight into `TZDate` instead of through a `Date`
 * first: a `Date` built from local parts means "noon of this civil date wherever
 * the runtime happens to be", which lands on the wrong day in `tz` for every
 * offset far enough from the runtime's own.
 *
 * Returns `null` for anything that is not a plain calendar date, so a caller
 * never has to decide what a malformed value means.
 */
export function dueDateToEpochMs(value: string, tz: string): number | null {
	const parts = DUE_DATE_PATTERN.exec(value);
	if (!parts) {
		return null;
	}

	const [, year, month, day] = parts;
	return startOfDay(
		new TZDate(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0, tz),
	).getTime();
}

/**
 * The inverse of `dueDateToEpochMs`, for the native date input. `null` stays
 * `null` so "no due date" round-trips instead of becoming today's date.
 */
export function epochMsToDueDate(ms: number | null, tz: string): string | null {
	if (ms === null) {
		return null;
	}

	const day = new TZDate(ms, tz);
	const month = String(day.getMonth() + 1).padStart(2, "0");
	const date = String(day.getDate()).padStart(2, "0");
	return `${day.getFullYear()}-${month}-${date}`;
}
