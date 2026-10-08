import { describe, expect, it } from "vitest";
import { describeInterval, isQuiet, nextOccurrence } from "./recurrence";

/**
 * Fixed instants in Madrid. 2026 has the clocks going forward on 29 March and
 * back on 25 October. These run in UTC (vitest.web.config.ts), like the Worker.
 */
const TZ = "Europe/Madrid";
const HOUR = 3_600_000;
const QUIET = { start: "23:00", end: "08:00" };

/** An instant from a wall-clock time of Madrid, written as the person reads it. */
function madrid(date: string, time: string): number {
	const offset = date >= "2026-10-25" || date < "2026-03-29" ? 1 : 2;
	const [h, m] = time.split(":").map(Number);
	const [y, mo, d] = date.split("-").map(Number);
	return Date.UTC(y ?? 0, (mo ?? 1) - 1, d ?? 1, (h ?? 0) - offset, m ?? 0);
}

describe("nextOccurrence", () => {
	it("adds real hours for an hourly series", () => {
		const from = madrid("2026-10-07", "18:00");

		expect(nextOccurrence({ from, every: 2, unit: "hours", now: from, tz: TZ, quiet: null })).toBe(
			madrid("2026-10-07", "20:00"),
		);
	});

	it("keeps the wall-clock time of a daily series across the October change", () => {
		const from = madrid("2026-10-24", "09:00");

		expect(nextOccurrence({ from, every: 1, unit: "days", now: from, tz: TZ, quiet: null })).toBe(
			madrid("2026-10-25", "09:00"),
		);
		// That day lasts 25 hours: 9:00 to 9:00 is 25 real hours.
		expect(madrid("2026-10-25", "09:00") - from).toBe(25 * HOUR);
	});

	it("keeps it across the March change too, a 23-hour day", () => {
		const from = madrid("2026-03-28", "09:00");

		expect(nextOccurrence({ from, every: 1, unit: "days", now: from, tz: TZ, quiet: null })).toBe(
			madrid("2026-03-29", "09:00"),
		);
	});

	it("moves a daily 02:30 to 03:30 on the day the clocks skip it", () => {
		const from = madrid("2026-03-28", "02:30");

		expect(nextOccurrence({ from, every: 1, unit: "days", now: from, tz: TZ, quiet: null })).toBe(
			madrid("2026-03-29", "03:30"),
		);
	});

	it("skips the occurrences already missed instead of sending a burst", () => {
		const from = madrid("2026-10-07", "10:00");
		const now = madrid("2026-10-07", "15:20");

		expect(nextOccurrence({ from, every: 1, unit: "hours", now, tz: TZ, quiet: null })).toBe(
			madrid("2026-10-07", "16:00"),
		);
	});

	it("moves an occurrence inside the quiet hours to their end, the next morning", () => {
		const from = madrid("2026-10-07", "22:00");

		expect(nextOccurrence({ from, every: 2, unit: "hours", now: from, tz: TZ, quiet: QUIET })).toBe(
			madrid("2026-10-08", "08:00"),
		);
	});

	it("moves one just after midnight to the same morning", () => {
		const from = madrid("2026-10-07", "23:30");

		expect(nextOccurrence({ from, every: 1, unit: "hours", now: from, tz: TZ, quiet: QUIET })).toBe(
			madrid("2026-10-08", "08:00"),
		);
	});

	it("rings at night when the quiet hours are off", () => {
		const from = madrid("2026-10-07", "22:00");

		expect(nextOccurrence({ from, every: 2, unit: "hours", now: from, tz: TZ, quiet: null })).toBe(
			madrid("2026-10-08", "00:00"),
		);
	});

	it("handles quiet hours that do not cross midnight", () => {
		const from = madrid("2026-10-07", "13:30");
		const siesta = { start: "14:00", end: "16:00" };

		expect(
			nextOccurrence({ from, every: 1, unit: "hours", now: from, tz: TZ, quiet: siesta }),
		).toBe(madrid("2026-10-07", "16:00"));
	});
});

describe("isQuiet", () => {
	it("is true inside a window that crosses midnight and false at its end", () => {
		expect(isQuiet(madrid("2026-10-07", "23:00"), QUIET, TZ)).toBe(true);
		expect(isQuiet(madrid("2026-10-08", "03:00"), QUIET, TZ)).toBe(true);
		expect(isQuiet(madrid("2026-10-08", "08:00"), QUIET, TZ)).toBe(false);
		expect(isQuiet(madrid("2026-10-07", "22:59"), QUIET, TZ)).toBe(false);
		expect(isQuiet(madrid("2026-10-07", "03:00"), null, TZ)).toBe(false);
	});
});

describe("describeInterval", () => {
	it("reads naturally in Spanish", () => {
		expect(describeInterval(1, "hours")).toBe("cada hora");
		expect(describeInterval(2, "hours")).toBe("cada 2 h");
		expect(describeInterval(1, "days")).toBe("cada día");
		expect(describeInterval(3, "days")).toBe("cada 3 días");
	});
});
