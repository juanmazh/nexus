import { Hono } from "hono";
import type { JWTVerifyGetKey } from "jose";
import type { AccessEnv } from "./middleware/access";
import { access } from "./middleware/access";
import { notFound, onError } from "./middleware/errors";
import { securityHeaders } from "./middleware/security-headers";
import { HEALTH_PATH, health } from "./routes/health";
import { me } from "./routes/me";
import { reminders } from "./routes/reminders";
import { tasks } from "./routes/tasks";
import { getAccessJwks } from "./services/access-jwks";

export interface AppDeps {
	/**
	 * Where the public keys of the Access team come from. Tests inject a local
	 * JWKS so the suite never touches the network; production uses the remote one
	 * (design.md §7).
	 */
	getKey?: (teamDomain: string) => JWTVerifyGetKey;
}

export function createApp(deps: AppDeps = {}) {
	const app = new Hono<AccessEnv>().basePath("/api");

	app.onError(onError);
	// `onError` alone does not catch unmatched routes (Hono would answer 404 in
	// text/plain), so the not-found handler is registered too.
	app.notFound(notFound);

	// First, so it also covers the responses built by `onError` and `notFound`.
	app.use("*", securityHeaders);

	// Registered before the routes so a denial happens before any handler, and
	// also before the not-found handler: a sessionless visitor must not be able to
	// tell which routes exist.
	const requireSession = access({ getKey: deps.getKey ?? getAccessJwks });
	app.use("*", (c, next) => {
		const isOpenHealthCheck = c.req.method === "GET" && c.req.path === HEALTH_PATH;
		return isOpenHealthCheck ? next() : requireSession(c, next);
	});

	const routes = app
		.route("/health", health)
		.route("/me", me)
		.route("/tasks", tasks)
		.route("/", reminders);

	return { app, routes };
}

const { app, routes } = createApp();

export { app };

/**
 * The type of the chained routes is what `hc` needs to type the client's calls.
 * Because the `/api` basePath lives on the server and is part of this type, the
 * front calls `client.api.health.$get()`.
 */
export type AppType = typeof routes;
