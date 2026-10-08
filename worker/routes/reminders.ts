import { createReminderSchema, reminderIdParamSchema } from "@shared/reminders";
import { taskIdParamSchema } from "@shared/tasks";
import { Hono } from "hono";
import { createDb } from "../db/client";
import { errorBody } from "../middleware/errors";
import { type DataEnv, DEFAULT_TIMEZONE, onlyMethods, validated } from "../middleware/validation";
import * as reminderService from "../services/reminders";

/**
 * `GET`/`POST /api/tasks/:id/reminders` and `DELETE /api/reminders/:id`.
 *
 * Mounted at the root of `/api` because the two paths hang from different
 * resources. Every outcome of the service is a value, so each `switch` below is
 * the whole mapping from rule to status code (add-reminders design.md D3, D4).
 */

const TASK_NOT_FOUND = errorBody("not_found", "Esta tarea ya no existe.");

const CREATE_ERRORS = {
	invalid: [400, errorBody("validation_error", "Esa fecha u hora no existe en el calendario.")],
	nonexistent: [
		400,
		errorBody("validation_error", "Esa hora no existe ese día por el cambio de hora."),
	],
	past: [400, errorBody("validation_error", "Esa hora ya ha pasado.")],
	task_not_found: [404, TASK_NOT_FOUND],
	task_completed: [
		409,
		errorBody("task_completed", "La tarea ya está hecha: no se le pueden poner avisos."),
	],
	too_many: [
		409,
		errorBody("too_many_reminders", "Esta tarea ya tiene 10 avisos pendientes, que es el máximo."),
	],
} as const;

export const reminders = new Hono<DataEnv>()
	.use("/tasks/:id/reminders", onlyMethods(["GET", "POST"]))
	.use("/reminders/:id", onlyMethods(["DELETE"]))
	.get("/tasks/:id/reminders", validated("param", taskIdParamSchema), async (c) => {
		const list = await reminderService.listPendingReminders(
			createDb(c.env),
			c.req.valid("param").id,
		);
		return list ? c.json(list, 200) : c.json(TASK_NOT_FOUND, 404);
	})
	.post(
		"/tasks/:id/reminders",
		validated("param", taskIdParamSchema),
		validated("json", createReminderSchema),
		async (c) => {
			const result = await reminderService.createReminder(
				createDb(c.env),
				c.req.valid("param").id,
				c.req.valid("json").remind_at,
				c.env.APP_TIMEZONE ?? DEFAULT_TIMEZONE,
			);
			if (result.ok) {
				return c.json(result.reminder, 201);
			}
			const [status, body] = CREATE_ERRORS[result.reason];
			return c.json(body, status);
		},
	)
	.delete("/reminders/:id", validated("param", reminderIdParamSchema), async (c) => {
		const result = await reminderService.cancelReminder(createDb(c.env), c.req.valid("param").id);
		switch (result) {
			case "cancelled":
				return c.body(null, 204);
			case "not_pending":
				return c.json(
					errorBody("reminder_not_pending", "Este aviso ya se ha enviado o ha fallado."),
					409,
				);
			case "not_found":
				return c.json(errorBody("not_found", "Este aviso ya no existe."), 404);
		}
	});
