import { z } from "zod";

/**
 * The validation of the task API, in one place, used by both sides
 * (`AGENTS.md §3`): the Worker imports it to answer `400`, and the detail form
 * imports the very same object to show its messages. Two copies would be two
 * truths about what a task is, and the front would accept things the API
 * rejects.
 *
 * Messages are written for the person using the application, never for whoever
 * debugs it, and every one of them names the field that is wrong: the spec asks
 * that a bad status or priority says *which* of the two is invalid.
 */

export const TASK_STATUSES = ["todo", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;

/** "todo o done", "low, medium o high": the allowed values, spelled in Spanish. */
function asDisjunction(values: readonly string[]): string {
	return new Intl.ListFormat("es", { style: "long", type: "disjunction" }).format(values);
}

export const taskStatusSchema = z.enum(TASK_STATUSES, {
	error: `El estado solo puede ser ${asDisjunction(TASK_STATUSES)}.`,
});

export const taskPrioritySchema = z.enum(TASK_PRIORITIES, {
	error: `La prioridad solo puede ser ${asDisjunction(TASK_PRIORITIES)}.`,
});

/** 1–200 characters after trimming, so a blank title can never reach the table. */
const titleSchema = z
	.string()
	.trim()
	.min(1, "Escribe un título para la tarea.")
	.max(200, "El título no puede pasar de 200 caracteres.");

/** Optional: absent leaves the current value alone, `null` or "" clears it. */
const notesSchema = z.string().trim().nullish();

/**
 * A civil date chosen with a native date input, so it arrives as `YYYY-MM-DD`
 * and not as an instant. Turning it into an instant is the Worker's job
 * (`shared/dates.ts`), because only there is the timezone known.
 */
const dueDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de vencimiento tiene que tener el formato AAAA-MM-DD.")
	// The pattern alone accepts 2026-02-31, which a date library would silently
	// roll over to March. A real calendar date survives the round trip unchanged.
	.refine(isCalendarDate, "Esa fecha no existe en el calendario.")
	.nullish();

function isCalendarDate(value: string): boolean {
	const [year, month, day] = value.split("-").map(Number);
	if (year === undefined || month === undefined || day === undefined) {
		return false;
	}
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
	);
}

/**
 * Creation takes only what a new task can have. The state and the completion
 * instant are never asked for here: `status` is `todo` and `completed_at` is
 * empty by definition, and the only writer of that instant is the service's
 * `updateTaskStatus`.
 */
export const createTaskSchema = z.strictObject({
	title: titleSchema,
	notes: notesSchema,
	priority: taskPrioritySchema.optional(),
	due_date: dueDateSchema,
});

/**
 * Editing takes only the fields that are present. A key that is absent leaves
 * its column untouched, which is what keeps the notes when the title is edited;
 * to clear a field it has to be sent explicitly as `null`.
 */
export const updateTaskSchema = z.strictObject({
	title: titleSchema.optional(),
	notes: notesSchema,
	priority: taskPrioritySchema.optional(),
	due_date: dueDateSchema,
});

/**
 * The list's filters, closed on purpose: `status` is one of the two states and
 * `overdue` is literally `true` or `false`.
 *
 * `overdue` is **not** coerced. `z.coerce.boolean()` reads every string that is
 * not `""` as `true`, so `?overdue=no` would come back as "show me the overdue
 * ones" — the kind of mistake that only shows up as "why isn't it showing me
 * what I asked for?".
 */
export const listTasksQuerySchema = z.strictObject({
	status: taskStatusSchema.optional(),
	overdue: z
		.enum(["true", "false"], { error: 'El filtro "overdue" solo admite true o false.' })
		.transform((value) => value === "true")
		.optional(),
});

export const taskIdParamSchema = z.strictObject({
	id: z.uuid("Ese identificador de tarea no es válido."),
});

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
