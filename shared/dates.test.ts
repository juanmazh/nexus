import { describe, expect, it } from "vitest";
import { dueDateToEpochMs, epochMsToDueDate, zonedDayNumber, zonedDayStart } from "./dates";

/**
 * Fixed cases, never "today": the whole point of this module is that the answer
 * depends on the timezone and on the day of the year, so a test that used the
 * current date would only prove that the suite ran on a day the author expected.
 * 2026 is the interesting year in Europe/Madrid: the clocks go forward on
 * 29 March and back on 25 October.
 */

const TZ = "Europe/Madrid";

/** 2026-03-29T12:00:00Z, the afternoon of the day the clocks jump forward. */
const DST_SPRING_FORWARD = Date.UTC(2026, 2, 29, 12, 0, 0);
/** 2026-10-25T12:00:00Z, the afternoon of the day they go back. */
const DST_FALL_BACK = Date.UTC(2026, 9, 25, 12, 0, 0);
/** A plain day: 2026-10-07T16:00:00Z is 18:00 in Madrid (CEST). */
const ORDINARY_DAY = Date.UTC(2026, 9, 7, 16, 0, 0);

describe("zonedDayStart", () => {
	it("returns 00:00 of the local day, which is an instant before it in UTC", () => {
		const start = zonedDayStart(new Date(ORDINARY_DAY), TZ);

		// Madrid is UTC+2 in October, so its midnight is 22:00 UTC of the day before.
		expect(new Date(start).toISOString()).toBe("2026-10-06T22:00:00.000Z");
	});

	it("still points at the day itself on the morning the clocks go forward", () => {
		const start = zonedDayStart(new Date(DST_SPRING_FORWARD), TZ);

		expect(new Date(start).toISOString()).toBe("2026-03-28T23:00:00.000Z");
		expect(zonedDayNumber(start, TZ)).toBe(20260329);
	});

	it("still points at the day itself on the morning the clocks go back", () => {
		const start = zonedDayStart(new Date(DST_FALL_BACK), TZ);

		expect(new Date(start).toISOString()).toBe("2026-10-24T22:00:00.000Z");
		expect(zonedDayNumber(start, TZ)).toBe(20261025);
	});

	it("returns the same start for every instant of the same day", () => {
		expect(zonedDayStart(new Date(Date.UTC(2026, 9, 7, 5, 0, 0)), TZ)).toBe(
			zonedDayStart(new Date(Date.UTC(2026, 9, 7, 20, 0, 0)), TZ),
		);
	});
});

describe("zonedDayNumber", () => {
	it("reads the local day, not the UTC one", () => {
		// 23:30 UTC is already the next day in Madrid.
		expect(zonedDayNumber(Date.UTC(2026, 9, 7, 23, 30, 0), TZ)).toBe(20261008);
	});

	it("keeps 29 March as a single day even though it lasts 23 hours", () => {
		const first = Date.UTC(2026, 2, 29, 5, 0, 0); // 06:00 CET, before the jump
		const second = Date.UTC(2026, 2, 29, 12, 0, 0); // 14:00 CEST, after the jump

		expect(zonedDayNumber(first, TZ)).toBe(20260329);
		expect(zonedDayNumber(second, TZ)).toBe(20260329);
		expect(second - first).toBe(7 * 60 * 60 * 1000);
	});

	it("orders the days of a DST change chronologically", () => {
		const before = zonedDayNumber(zonedDayStart(new Date(Date.UTC(2026, 2, 28, 12)), TZ), TZ);
		const during = zonedDayNumber(zonedDayStart(new Date(DST_SPRING_FORWARD), TZ), TZ);
		const after = zonedDayNumber(zonedDayStart(new Date(Date.UTC(2026, 2, 30, 12)), TZ), TZ);

		expect(before).toBeLessThan(during);
		expect(during).toBeLessThan(after);
	});
});

describe("dueDateToEpochMs", () => {
	it("puts a plain day at its local midnight", () => {
		expect(new Date(dueDateToEpochMs("2026-10-10", TZ) ?? 0).toISOString()).toBe(
			"2026-10-09T22:00:00.000Z",
		);
	});

	it("reads the DST day as that day, one hour earlier in UTC", () => {
		// Madrid switched to CEST at 02:00, so this midnight is still CET (UTC+1).
		expect(new Date(dueDateToEpochMs("2026-03-29", TZ) ?? 0).toISOString()).toBe(
			"2026-03-28T23:00:00.000Z",
		);
		// And in October the same date is UTC+2 until the clocks go back on the 25th.
		expect(new Date(dueDateToEpochMs("2026-10-25", TZ) ?? 0).toISOString()).toBe(
			"2026-10-24T22:00:00.000Z",
		);
	});

	it("agrees with zonedDayStart on every day it is given", () => {
		for (const value of ["2026-01-01", "2026-03-29", "2026-10-25", "2026-12-31"]) {
			expect(dueDateToEpochMs(value, TZ)).toBe(zonedDayStart(new Date(`${value}T12:00:00Z`), TZ));
		}
	});

	it("returns null for anything that is not a plain date", () => {
		for (const value of ["", "2026-10", "10/10/2026", "2026-10-10T00:00:00Z", "ayer"]) {
			expect(dueDateToEpochMs(value, TZ)).toBeNull();
		}
	});
});

describe("epochMsToDueDate", () => {
	it("is the exact inverse of dueDateToEpochMs", () => {
		for (const value of ["2026-01-01", "2026-03-29", "2026-07-15", "2026-10-25", "2026-12-31"]) {
			const ms = dueDateToEpochMs(value, TZ);
			expect(epochMsToDueDate(ms, TZ)).toBe(value);
		}
	});

	it("keeps null as null, so a task without a date does not become today", () => {
		expect(epochMsToDueDate(null, TZ)).toBeNull();
	});

	it("reports the local day of an instant, not its UTC day", () => {
		expect(epochMsToDueDate(Date.UTC(2026, 9, 7, 23, 30, 0), TZ)).toBe("2026-10-08");
	});
});

describe("a task due today at 09:00 is still today's at 18:00", () => {
	// The scenario the spec pins: the hour a task is due is never what decides
	// its section, the day is.
	const dueAtNine = dueDateToEpochMs("2026-10-07", TZ) ?? 0;
	const eighteenInMadrid = Date.UTC(2026, 9, 7, 16, 0, 0);

	it("belongs to today at both hours", () => {
		const today = zonedDayNumber(zonedDayStart(new Date(eighteenInMadrid), TZ), TZ);

		expect(zonedDayNumber(dueAtNine, TZ)).toBe(today);
		expect(zonedDayNumber(eighteenInMadrid, TZ)).toBe(today);
	});

	it("and is not before the start of today, which is what makes it not overdue", () => {
		expect(dueAtNine < zonedDayStart(new Date(eighteenInMadrid), TZ)).toBe(false);
	});
});
