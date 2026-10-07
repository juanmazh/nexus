import { zValidator } from "@hono/zod-validator";
import {
	createTaskSchema,
	listTasksQuerySchema,
	taskIdParamSchema,
	updateTaskSchema,
} from "@shared/tasks";
import type { AnyD1Database } from "drizzle-orm/d1";
import type { MiddlewareHandler } from "hono";
import { Hono } from "hono";
import type { z } from "zod";
import { createDb } from "../db/client";
import type { AccessEnv } from "../middleware/access";
import { errorBody } from "../middleware/errors";
import * as taskService from "../services/tasks";

/**
 * The bindings this route reads on top of the session ones. Declared
 * structurally, like `AccessBindings`, because the SPA type-checks this module
 * through `AppType` and the workerd globals do not exist there.
 */
type TasksEnv = {
	Bindings: AccessEnv["Bindings"] & { DB: AnyD1Database; APP_TIMEZONE?: string };
	Variables: AccessEnv["Variables"];
};

/** `wrangler.jsonc` sets it; the fallback only matters if a deployment forgets it. */
const DEFAULT_TIMEZONE = "Europe/Madrid";

/**
 * `@hono/zod-validator` answers a failed validation with its own body, which is
 * not the project's error shape. The hook turns it into the single shape, with
 * the first message, which every schema in `shared/tasks.ts` writes in Spanish
 * and naming the field (design.md D5).
 */
function validated<Target extends "json" | "query" | "param", Schema extends z.ZodType>(
	target: Target,
	schema: Schema,
) {
	return zValidator(target, schema, (result, c) => {
		if (!result.success) {
			const message = result.error.issues[0]?.message ?? "La petición no es válida.";
			return c.json(errorBody("validation_error", message), 400);
		}
	});
}

/** `405` with the `Allow` header, as `health.ts` does, for the methods a path does not take. */
function onlyMethods(allowed: readonly string[]): MiddlewareHandler {
	return async (c, next) => {
		if (!allowed.includes(c.req.method)) {
			return c.json(
				errorBody("method_not_allowed", `Este endpoint solo admite ${allowed.join(", ")}.`),
				405,
				{ Allow: allowed.join(", ") },
			);
		}
		await next();
	};
}

const NOT_FOUND = errorBody("not_found", "Esta tarea ya no existe.");

export const tasks = new Hono<TasksEnv>()
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
