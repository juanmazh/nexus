import { describe, expect, it } from "vitest";
import { reminderShortcuts } from "./shortcuts";

const TZ = "Europe/Madrid";
/** Wednesday 2026-10-07 at a given wall-clock time of Madrid (UTC+2). */
const at = (hour: number, minute = 0) => Date.UTC(2026, 9, 7, hour - 2, minute);
/** 00:00 in Madrid of a day of October 2026. */
const dueOn = (day: number) => Date.UTC(2026, 9, day - 1, 22, 0);

describe("reminderShortcuts", () => {
	it("offers the three fixed ones in the afternoon", () => {
		expect(reminderShortcuts(at(16), null, TZ)).toEqual([
			{ label: "En 1 h", value: "2026-10-07T17:00" },
			{ label: "Esta tarde 18:00", value: "2026-10-07T18:00" },
			{ label: "Mañana 9:00", value: "2026-10-08T09:00" },
		]);
	});

	it("rounds 'En 1 h' up to the next five minutes", () => {
		expect(reminderShortcuts(at(16, 33), null, TZ)[0]?.value).toBe("2026-10-07T17:35");
		expect(reminderShortcuts(at(16, 35), null, TZ)[0]?.value).toBe("2026-10-07T17:35");
	});

	it("drops this afternoon once 18:00 is five minutes away or less", () => {
		const labels = (now: number) => reminderShortcuts(now, null, TZ).map((s) => s.label);

		expect(labels(at(17, 54))).toContain("Esta tarde 18:00");
		expect(labels(at(17, 55))).not.toContain("Esta tarde 18:00");
		expect(labels(at(18, 30))).not.toContain("Esta tarde 18:00");
	});

	it("adds the due day at 9:00 when the task has a date ahead", () => {
		expect(reminderShortcuts(at(16), dueOn(9), TZ).at(-1)).toEqual({
			label: "El día que vence 9:00",
			value: "2026-10-09T09:00",
		});
	});

	it("does not repeat it when the task is due tomorrow, or offer it when it has passed", () => {
		const labels = (dueAt: number) => reminderShortcuts(at(16), dueAt, TZ).map((s) => s.label);

		expect(labels(dueOn(8))).toEqual(["En 1 h", "Esta tarde 18:00", "Mañana 9:00"]);
		expect(labels(dueOn(7))).not.toContain("El día que vence 9:00");
		expect(labels(dueOn(5))).not.toContain("El día que vence 9:00");
	});

	it("crosses the end of the month for tomorrow", () => {
		const lastOfOctober = Date.UTC(2026, 9, 31, 15, 0);

		expect(reminderShortcuts(lastOfOctober, null, TZ).at(-1)?.value).toBe("2026-11-01T09:00");
	});
});
