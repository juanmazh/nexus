import { z } from "zod";

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

export const createReminderSchema = z.strictObject({
	remind_at: z
		.string({ error: "Indica la fecha y la hora del aviso." })
		.regex(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
			"La hora del aviso tiene que tener el formato AAAA-MM-DDTHH:mm.",
		),
});

export const reminderIdParamSchema = z.strictObject({
	id: z.uuid("Ese identificador de recordatorio no es válido."),
});

export type ReminderStatus = (typeof REMINDER_STATUSES)[number];
export type CreateReminderInput = z.infer<typeof createReminderSchema>;
