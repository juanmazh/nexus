import { describe, expect, it } from "vitest";
import { formatReminderTime, formatShortDate, formatTime } from "./format";

const TZ = "Europe/Madrid";
/** Wednesday 2026-10-07 at 18:00 in Madrid. */
const NOW = Date.UTC(2026, 9, 7, 16, 0);

describe("formatShortDate", () => {
	it("writes the day of Madrid without dots or commas", () => {
		expect(formatShortDate(Date.UTC(2026, 9, 9, 22, 0), TZ)).toBe("sáb 10 oct");
	});
});

describe("formatTime", () => {
	it("uses the 24-hour clock of Madrid", () => {
		expect(formatTime(NOW, TZ)).toBe("18:00");
		expect(formatTime(Date.UTC(2026, 9, 8, 7, 0), TZ)).toBe("9:00");
	});
});

describe("formatReminderTime", () => {
	it("shows only the time for a reminder of today", () => {
		expect(formatReminderTime(Date.UTC(2026, 9, 7, 19, 30), NOW, TZ)).toBe("21:30");
	});

	it("adds the short date for any other day, by the day of Madrid", () => {
		// 22:30 UTC is already Thursday 00:30 in Madrid.
		expect(formatReminderTime(Date.UTC(2026, 9, 7, 22, 30), NOW, TZ)).toBe("jue 8 oct 0:30");
	});
});
