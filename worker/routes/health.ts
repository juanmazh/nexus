import { Hono } from "hono";
import { errorBody } from "../middleware/errors";

/**
 * The only route of the API that answers without a session: it returns nothing
 * about the app, and it is what a monitor can check without credentials.
 */
export const HEALTH_PATH = "/api/health";

export const health = new Hono()
	.use("*", async (c, next) => {
		if (c.req.method !== "GET") {
			return c.json(errorBody("method_not_allowed", "Este endpoint solo admite GET."), 405, {
				Allow: "GET",
			});
		}
		await next();
	})
	.get("/", (c) => c.json({ status: "ok" as const }, 200));
