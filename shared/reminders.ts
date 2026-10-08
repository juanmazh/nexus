import { z } from "zod";
import { MAX_REPEAT_EVERY, REPEAT_UNITS } from "./recurrence";

/**
 * The validation of the reminder API, shared by the Worker and the SPA like
 * `shared/tasks.ts`.
 *
 * Only the **shape** of `remind_at` is checked here. Whether that wall-clock
 * time exists and whether it has already passed depend on the timezone and on
 * the clock, which only the Worker knows; it answers those with its own messages
 * (add-reminders design.md D2, D3).
 */

export const REMINDER_STATUSES = ["pending", "sent", "failed", "cancelled"] as const;

/** A guard against a loop or a double submit, not a business rule (design.md D3). */
export const MAX_PENDING_REMINDERS_PER_TASK = 10;

/**
 * Every N hours (1–720) or N days (1–30): at least an hour apart, at most a
 * month (add-recurring-reminders design.md D1). The bound depends on the unit,
 * so it is checked on the pair.
 */
export const repeatSchema = z
	.strictObject({
		every: z
			.number({ error: "Indica cada cuánto se repite." })
			.int("El intervalo tiene que ser un número entero.")
			.min(1, "El intervalo mínimo es 1."),
		unit: z.enum(REPEAT_UNITS, { error: "La unidad solo puede ser horas o días." }),
	})
	.refine(
		(repeat) => repeat.every <= MAX_REPEAT_EVERY[repeat.unit],
		"Como mucho cada 720 horas o cada 30 días.",
	);

export const createReminderSchema = z.strictObject({
	remind_at: z
		.string({ error: "Indica la fecha y la hora del aviso." })
		.regex(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
			"La hora del aviso tiene que tener el formato AAAA-MM-DDTHH:mm.",
		),
	/** Absent for a one-off reminder; present makes `remind_at` the first occurrence. */
	repeat: repeatSchema.optional(),
});

const timeOfDay = z
	.string()
	.regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Las horas tienen que tener el formato HH:mm.");

/** `null` turns the quiet hours off; otherwise a window, which may cross midnight. */
export const quietHoursSchema = z
	.strictObject({ start: timeOfDay, end: timeOfDay })
	.refine(
		(window) => window.start !== window.end,
		"El inicio y el fin no pueden ser la misma hora.",
	)
	.nullable();

export const reminderIdParamSchema = z.strictObject({
	id: z.uuid("Ese identificador de recordatorio no es válido."),
});

export type ReminderStatus = (typeof REMINDER_STATUSES)[number];
export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type QuietHoursInput = z.infer<typeof quietHoursSchema>;
