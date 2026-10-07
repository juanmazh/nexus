import { Hono } from "hono";
import { errorBody } from "../middleware/errors";

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
