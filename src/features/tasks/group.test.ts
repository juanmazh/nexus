import { describe, expect, it } from "vitest";
import { groupTasks } from "./group";

const TZ = "Europe/Madrid";
/** Wednesday 2026-10-07 at 18:00 in Madrid. */
const NOW = Date.UTC(2026, 9, 7, 16, 0);
/** 00:00 in Madrid of 2026-10-07, the convention for `due_at`. */
const TODAY = Date.UTC(2026, 9, 6, 22, 0);
const DAY = 86_400_000;

function task(title: string, due_at: number | null) {
	return { title, due_at };
}

describe("groupTasks", () => {
	it("splits the list into overdue, today, upcoming and no date", () => {
		const sections = groupTasks(
			[
				task("Ayer", TODAY - DAY),
				task("Hoy", TODAY),
				task("Mañana", TODAY + DAY),
				task("Nunca", null),
			],
			NOW,
			TZ,
		);

		expect(sections.overdue.map((t) => t.title)).toEqual(["Ayer"]);
		expect(sections.today.map((t) => t.title)).toEqual(["Hoy"]);
		expect(sections.upcoming.map((t) => t.title)).toEqual(["Mañana"]);
		expect(sections.noDate.map((t) => t.title)).toEqual(["Nunca"]);
	});

	it("keeps a task of today in today late in the evening", () => {
		const lateEvening = Date.UTC(2026, 9, 7, 21, 59);

		expect(groupTasks([task("Hoy", TODAY)], lateEvening, TZ).today).toHaveLength(1);
	});

	it("moves it to overdue as soon as the day changes in Madrid, not in UTC", () => {
		// 22:30 UTC is already 00:30 of Thursday in Madrid.
		const pastMidnight = Date.UTC(2026, 9, 7, 22, 30);

		expect(groupTasks([task("Ayer ya", TODAY)], pastMidnight, TZ).overdue).toHaveLength(1);
	});

	it("handles the day the clocks go back, which has 25 hours", () => {
		// 2026-10-25 starts at 22:00 UTC of the 24th (CEST) and ends at 23:00 UTC (CET).
		const startOfThatDay = Date.UTC(2026, 9, 24, 22, 0);
		const lastMinute = Date.UTC(2026, 9, 25, 22, 59);

		expect(groupTasks([task("Domingo", startOfThatDay)], lastMinute, TZ).today).toHaveLength(1);
	});

	it("never reorders: each section keeps the order it was given", () => {
		const sections = groupTasks([task("B", null), task("A", null)], NOW, TZ);

		expect(sections.noDate.map((t) => t.title)).toEqual(["B", "A"]);
	});

	it("leaves a completed task out of every section", () => {
		const sections = groupTasks(
			[
				{ title: "Hecha ayer", due_at: TODAY - DAY, status: "done" },
				{ title: "Hecha sin fecha", due_at: null, status: "done" },
				{ title: "Pendiente", due_at: TODAY, status: "todo" },
			],
			NOW,
			TZ,
		);

		expect(
			Object.values(sections)
				.flat()
				.map((t) => t.title),
		).toEqual(["Pendiente"]);
	});
});
