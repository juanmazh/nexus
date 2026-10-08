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

/** Half a day: wide enough to reach both sides of any clock change around a time. */
const HALF_DAY_MS = 12 * 60 * 60 * 1000;

/**
 * How far ahead of UTC the wall clock of `tz` is at the instant `ms`, read from
 * the clock itself. It only reads an instant in a zone, which does not depend on
 * the zone the process runs in.
 */
function offsetAt(ms: number, tz: string): number {
	const zoned = new TZDate(ms, tz);
	const wall = Date.UTC(
		zoned.getFullYear(),
		zoned.getMonth(),
		zoned.getDate(),
		zoned.getHours(),
		zoned.getMinutes(),
		zoned.getSeconds(),
	);
	return wall - Math.floor(ms / 1000) * 1000;
}

/**
 * `YYYY-MM-DDTHH:mm` read as a wall-clock time of `tz` → epoch ms.
 *
 * The two DST edges get an explicit answer (add-reminders design.md D2):
 * - a time that does not exist (the hour skipped in March) is `nonexistent`;
 * - a time that happens twice (the hour repeated in October) resolves to its
 *   **first** occurrence, still in summer time.
 *
 * It does **not** build the date with `new TZDate(y, m, d, h, min, tz)`: how
 * that constructor settles a repeated hour depends on the timezone of the
 * **process**. In Madrid it took the first 02:30 and in UTC — where the CI and
 * Cloudflare's Workers run — the second, so the tests passed on one machine
 * and production stored the reminder an hour late. Instead, the offsets on
 * both sides of the day give the only possible instants, each is kept if the
 * wall clock of `tz` really shows that time then, and the earliest wins.
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

	// The wall clock as if it were UTC. `Date.UTC` rolls 31 February over into
	// March, which is a malformed value, not a DST gap.
	const wall = Date.UTC(year, month - 1, day, hour, minute);
	const calendar = new Date(wall);
	if (
		calendar.getUTCFullYear() !== year ||
		calendar.getUTCMonth() !== month - 1 ||
		calendar.getUTCDate() !== day
	) {
		return { ok: false, reason: "invalid" };
	}

	const offsets = new Set([offsetAt(wall - HALF_DAY_MS, tz), offsetAt(wall + HALF_DAY_MS, tz)]);
	const instants = [...offsets]
		.map((offset) => wall - offset)
		.filter((instant) => offsetAt(instant, tz) === wall - instant)
		.sort((a, b) => a - b);

	const [first] = instants;
	return first === undefined ? { ok: false, reason: "nonexistent" } : { ok: true, ms: first };
}

/** The inverse, for the `min` of the native input and for the shortcuts. */
export function epochMsToLocalDateTime(ms: number, tz: string): string {
	const zoned = new TZDate(ms, tz);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${zoned.getFullYear()}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}T${pad(zoned.getHours())}:${pad(zoned.getMinutes())}`;
}
