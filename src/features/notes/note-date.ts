import { zonedDayNumber } from "@shared/dates";
import { formatShortDate, formatTime } from "@shared/format";
import { APP_TIMEZONE } from "@/lib/datetime";

/** "14:05" today, "ayer" yesterday, "vie 9 oct" before that. */
export function noteDate(ms: number, now: number): string {
	const day = zonedDayNumber(ms, APP_TIMEZONE);
	if (day === zonedDayNumber(now, APP_TIMEZONE)) {
		return formatTime(ms, APP_TIMEZONE);
	}
	if (day === zonedDayNumber(now - 86_400_000, APP_TIMEZONE)) {
		return "ayer";
	}
	return formatShortDate(ms, APP_TIMEZONE);
}
