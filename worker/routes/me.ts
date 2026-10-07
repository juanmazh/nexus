import { Hono } from "hono";
import type { AccessEnv } from "../middleware/access";
import { errorBody } from "../middleware/errors";

/**
 * Who is inside. The email comes from the verified Access token, never from the
 * database: this is the single origin of "who is calling" for the shell
 * (`add-app-shell`), so it needs no schema and no extra query.
 */
export const me = new Hono<AccessEnv>()
	.use("*", async (c, next) => {
		if (c.req.method !== "GET") {
			return c.json(errorBody("method_not_allowed", "Este endpoint solo admite GET."), 405, {
				Allow: "GET",
			});
		}
		await next();
	})
	.get("/", (c) => {
		const { email } = c.get("user");
		return c.json({ user: { email } }, 200);
	});
