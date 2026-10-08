import { zonedDayNumber } from "./dates";

/**
 * Formatting shared by the Worker (the Telegram message) and the SPA (the rows
 * and the detail), so a date reads the same in a notification and on screen.
 * Always in the app's timezone, never in the device's: a trip abroad must not
 * move a task to another day.
 */

/**
 * "vie 10 oct": short, unambiguous within a year and narrow enough for a row at
 * 320 px.
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

/** "18:00", with the 24-hour clock used in Spain. */
export function formatTime(ms: number, tz: string): string {
	return new Intl.DateTimeFormat("es-ES", {
		timeZone: tz,
		hour: "numeric",
		minute: "2-digit",
		hourCycle: "h23",
	}).format(ms);
}

/**
 * When a reminder goes off: only the time if it is today, the short date and the
 * time otherwise ("18:00", "vie 10 oct 9:00").
 */
export function formatReminderTime(ms: number, now: number, tz: string): string {
	const time = formatTime(ms, tz);
	return zonedDayNumber(ms, tz) === zonedDayNumber(now, tz)
		? time
		: `${formatShortDate(ms, tz)} ${time}`;
}
