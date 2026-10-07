import { zonedDayNumber } from "@shared/dates";

/** The shape `groupTasks` needs, so it works with the API row and with a fixture alike. */
type Groupable = { due_at: number | null; status?: string };

export type TaskSections<T> = {
	overdue: T[];
	today: T[];
	upcoming: T[];
	noDate: T[];
};

/**
 * Splits the pending list into Vencidas / Hoy / Próximas / Sin fecha.
 *
 * Pure and with `now` injected, so "today" in a test is a fixed day and not the
 * day the test happens to run. It never reorders: the API already decided the
 * order, and a second ordering here would be a second truth (design.md D12).
 * The day is the one of `tz`, through the same `zonedDayNumber` the Worker uses
 * to answer `overdue`, so the list and the API cannot disagree.
 */
export function groupTasks<T extends Groupable>(
	tasks: T[],
	now: number,
	tz: string,
): TaskSections<T> {
	const today = zonedDayNumber(now, tz);
	const sections: TaskSections<T> = { overdue: [], today: [], upcoming: [], noDate: [] };

	for (const task of tasks) {
		// The sections are for what is pending. A completed task that slips in
		// (a cache mid-update, say) belongs to "Hechas", never to "Vencidas".
		if (task.status === "done") {
			continue;
		}
		if (task.due_at === null) {
			sections.noDate.push(task);
			continue;
		}
		const day = zonedDayNumber(task.due_at, tz);
		if (day < today) {
			sections.overdue.push(task);
		} else if (day === today) {
			sections.today.push(task);
		} else {
			sections.upcoming.push(task);
		}
	}

	return sections;
}
