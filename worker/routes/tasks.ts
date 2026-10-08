import {
	createTaskSchema,
	listTasksQuerySchema,
	taskIdParamSchema,
	updateTaskSchema,
} from "@shared/tasks";
import { Hono } from "hono";
import { createDb } from "../db/client";
import { errorBody } from "../middleware/errors";
import { type DataEnv, DEFAULT_TIMEZONE, onlyMethods, validated } from "../middleware/validation";
import * as taskService from "../services/tasks";

const NOT_FOUND = errorBody("not_found", "Esta tarea ya no existe.");

export const tasks = new Hono<DataEnv>()
	.use("/", onlyMethods(["GET", "POST"]))
	.use("/:id", onlyMethods(["PATCH", "DELETE"]))
	.get("/", validated("query", listTasksQuerySchema), async (c) => {
		const { status, overdue } = c.req.valid("query");
		const list = await taskService.listTasks(createDb(c.env), {
			status,
			overdue,
			timezone: c.env.APP_TIMEZONE ?? DEFAULT_TIMEZONE,
		});
		return c.json(list, 200);
	})
	.post("/", validated("json", createTaskSchema), async (c) => {
		const created = await taskService.createTask(
			createDb(c.env),
			c.req.valid("json"),
			c.env.APP_TIMEZONE ?? DEFAULT_TIMEZONE,
		);
		return c.json(created, 201);
	})
	.patch(
		"/:id",
		validated("param", taskIdParamSchema),
		validated("json", updateTaskSchema),
		async (c) => {
			const { id } = c.req.valid("param");
			const { status, ...fields } = c.req.valid("json");
			const db = createDb(c.env);
			const timezone = c.env.APP_TIMEZONE ?? DEFAULT_TIMEZONE;

			// The state goes through its own function, the only writer of
			// `completed_at`; the other fields through the generic edit. The check
			// of the list sends only `status` and the detail only the fields, so the
			// usual cost is one write.
			let task = status === undefined ? null : await taskService.updateTaskStatus(db, id, status);
			if (status === undefined || Object.keys(fields).length > 0) {
				task = await taskService.updateTask(db, id, fields, timezone);
			}

			return task ? c.json(task, 200) : c.json(NOT_FOUND, 404);
		},
	)
	.delete("/:id", validated("param", taskIdParamSchema), async (c) => {
		const deleted = await taskService.deleteTask(createDb(c.env), c.req.valid("param").id);
		return deleted ? c.body(null, 204) : c.json(NOT_FOUND, 404);
	});
