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

/** What `<input type="datetime-local">` gives (minutes precision, no zone). */
const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export type LocalDateTimeResult =
	| { ok: true; ms: number }
	| { ok: false; reason: "invalid" | "nonexistent" };

/**
 * `YYYY-MM-DDTHH:mm` read as a wall-clock time of `tz` → epoch ms.
 *
 * The two DST edges get an explicit answer (add-reminders design.md D2):
 * - a time that does not exist (the hour skipped in March) is reported as
 *   `nonexistent`. `TZDate` would silently move it an hour later, so the result
 *   is formatted back and compared with what came in: any difference means the
 *   wall clock never showed that time.
 * - a time that happens twice (the hour repeated in October) resolves to its
 *   **first** occurrence, still in summer time, which is what `TZDate` does and
 *   what anyone asking for "2:30" means.
 */
export function localDateTimeToEpochMs(value: string, tz: string): LocalDateTimeResult {
	const parts = LOCAL_DATE_TIME_PATTERN.exec(value);
	if (!parts) {
		return { ok: false, reason: "invalid" };
	}

	const [, year, month, day, hour, minute] = parts.map(Number);
	if (
		year === undefined ||
		month === undefined ||
		day === undefined ||
		hour === undefined ||
		minute === undefined ||
		month < 1 ||
		month > 12 ||
		hour > 23 ||
		minute > 59
	) {
		return { ok: false, reason: "invalid" };
	}

	const zoned = new TZDate(year, month - 1, day, hour, minute, 0, 0, tz);
	// A day that does not exist in the calendar (31 February) rolls over into the
	// next month: a malformed value, not a DST gap, which never changes the day.
	if (zoned.getFullYear() !== year || zoned.getMonth() !== month - 1 || zoned.getDate() !== day) {
		return { ok: false, reason: "invalid" };
	}
	if (zoned.getHours() !== hour || zoned.getMinutes() !== minute) {
		return { ok: false, reason: "nonexistent" };
	}
	return { ok: true, ms: zoned.getTime() };
}

/** The inverse, for the `min` of the native input and for the shortcuts. */
export function epochMsToLocalDateTime(ms: number, tz: string): string {
	const zoned = new TZDate(ms, tz);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${zoned.getFullYear()}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}T${pad(zoned.getHours())}:${pad(zoned.getMinutes())}`;
}
