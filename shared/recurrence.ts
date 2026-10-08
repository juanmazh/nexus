import { epochMsToLocalDateTime, localDateTimeToEpochMs } from "./dates";

/**
 * When a recurring reminder goes off next (add-recurring-reminders design.md
 * D2), pure and shared: the Worker uses it after every send, and the tests pin
 * every edge without a clock or a database.
 */

export const REPEAT_UNITS = ["hours", "days"] as const;
export type RepeatUnit = (typeof REPEAT_UNITS)[number];

/** Upper bounds: every hour at most, every 30 days at least (design.md D1). */
export const MAX_REPEAT_EVERY: Record<RepeatUnit, number> = { hours: 720, days: 30 };

/** Wall-clock `HH:mm` in the app's timezone; `null` means "no quiet hours". */
export type QuietHours = { start: string; end: string } | null;

export const DEFAULT_QUIET_HOURS: Exclude<QuietHours, null> = { start: "23:00", end: "08:00" };

const HOUR_MS = 60 * 60 * 1000;

function minutesOfDay(hhmm: string): number {
	const [hours, minutes] = hhmm.split(":").map(Number);
	return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** `YYYY-MM-DD` plus `days` on the calendar. */
function addDays(date: string, days: number): string {
	const [year, month, day] = date.split("-").map(Number);
	return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days))
		.toISOString()
		.slice(0, 10);
}

/**
 * A wall-clock time of `tz` as an instant. If the clocks skip it (02:xx on the
 * last Sunday of March) the first valid minute after the gap is used: a daily
 * reminder at 02:30 goes off at 03:30 that one day instead of not at all.
 */
function wallClockToMs(date: string, time: string, tz: string): number {
	const exact = localDateTimeToEpochMs(`${date}T${time}`, tz);
	if (exact.ok) {
		return exact.ms;
	}
	const [hours, minutes] = time.split(":");
	const later = `${String(Number(hours) + 1).padStart(2, "0")}:${minutes}`;
	const shifted = localDateTimeToEpochMs(`${date}T${later}`, tz);
	if (!shifted.ok) {
		throw new Error(`No valid instant for ${date}T${time} in ${tz}.`);
	}
	return shifted.ms;
}

/** Hours are real hours; days keep the wall-clock time across DST changes. */
function addInterval(ms: number, every: number, unit: RepeatUnit, tz: string): number {
	if (unit === "hours") {
		return ms + every * HOUR_MS;
	}
	const [date = "", time = ""] = epochMsToLocalDateTime(ms, tz).split("T");
	return wallClockToMs(addDays(date, every), time, tz);
}

/** Whether `ms` falls inside the quiet hours, which may cross midnight. */
export function isQuiet(ms: number, quiet: QuietHours, tz: string): boolean {
	if (quiet === null) {
		return false;
	}
	const [, time = ""] = epochMsToLocalDateTime(ms, tz).split("T");
	const now = minutesOfDay(time);
	const start = minutesOfDay(quiet.start);
	const end = minutesOfDay(quiet.end);
	return start < end ? now >= start && now < end : now >= start || now < end;
}

/** The first instant after `ms` at which the quiet hours end. */
function endOfQuiet(ms: number, quiet: Exclude<QuietHours, null>, tz: string): number {
	const [date = ""] = epochMsToLocalDateTime(ms, tz).split("T");
	const sameDay = wallClockToMs(date, quiet.end, tz);
	return sameDay > ms ? sameDay : wallClockToMs(addDays(date, 1), quiet.end, tz);
}

export type NextOccurrenceInput = {
	/** The occurrence that has just gone off (its `remind_at`). */
	from: number;
	every: number;
	unit: RepeatUnit;
	now: number;
	tz: string;
	quiet: QuietHours;
};

/**
 * The next occurrence strictly after `now`:
 * 1. one interval after `from` (real hours, or calendar days at the same time);
 * 2. skipping every occurrence already in the past, so a job that was stopped
 *    for hours sends once instead of a burst;
 * 3. moved to the end of the quiet hours if it falls inside them. The series
 *    then continues from there.
 */
export function nextOccurrence({ from, every, unit, now, tz, quiet }: NextOccurrenceInput): number {
	let next = addInterval(from, every, unit, tz);
	while (next <= now) {
		next = addInterval(next, every, unit, tz);
	}
	return quiet !== null && isQuiet(next, quiet, tz) ? endOfQuiet(next, quiet, tz) : next;
}

/** "cada hora", "cada 2 h", "cada día", "cada 3 días". */
export function describeInterval(every: number, unit: RepeatUnit): string {
	if (unit === "hours") {
		return every === 1 ? "cada hora" : `cada ${every} h`;
	}
	return every === 1 ? "cada día" : `cada ${every} días`;
}
