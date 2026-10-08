import { zValidator } from "@hono/zod-validator";
import type { AnyD1Database } from "drizzle-orm/d1";
import type { MiddlewareHandler } from "hono";
import type { z } from "zod";
import type { AccessEnv } from "./access";
import { errorBody } from "./errors";

/**
 * What every data route shares: the bindings it reads, the `400` with the
 * project's error shape and the `405` with `Allow`. They lived in
 * `routes/tasks.ts` until a second and a third route needed them
 * (add-reminders design.md D13); the behaviour did not change in the move.
 */

/**
 * The bindings a data route reads on top of the session ones. Declared
 * structurally, like `AccessBindings`, because the SPA type-checks the routes
 * through `AppType` and the workerd globals do not exist there.
 */
export type DataEnv = {
	Bindings: AccessEnv["Bindings"] & { DB: AnyD1Database; APP_TIMEZONE?: string };
	Variables: AccessEnv["Variables"];
};

/** `wrangler.jsonc` sets it; the fallback only matters if a deployment forgets it. */
export const DEFAULT_TIMEZONE = "Europe/Madrid";

/**
 * `@hono/zod-validator` answers a failed validation with its own body, which is
 * not the project's error shape. The hook turns it into the single shape, with
 * the first message, which every schema in `shared/` writes in Spanish and
 * naming the field.
 */
export function validated<Target extends "json" | "query" | "param", Schema extends z.ZodType>(
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
export function onlyMethods(allowed: readonly string[]): MiddlewareHandler {
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
