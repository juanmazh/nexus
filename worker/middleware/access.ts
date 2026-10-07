import type { MiddlewareHandler } from "hono";
import type { JWTVerifyGetKey } from "jose";
import { verifyAccessToken } from "../services/access-token";
import { errorBody } from "./errors";

/** Header Cloudflare Access adds to every request it forwards. */
export const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";

/**
 * Only used while the local shortcut is on, and fictional on purpose: no real
 * email belongs in this repository (AGENTS.md §6.5).
 */
const LOCAL_EMAIL = "local@nexus.test";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * One message for every denial. It is the only thing a visitor learns, so it
 * cannot say whether the token was missing, expired, forged or meant for another
 * application.
 */
const NO_SESSION_MESSAGE = "No hay una sesión válida.";

/**
 * The `env` values the API reads, all optional because the middleware has to
 * survive their absence: a missing secret denies, it does not crash.
 *
 * Declared here instead of reusing `Cloudflare.Env` for two reasons. `wrangler
 * types` narrows `vars` to string literals, which would stop the tests from
 * using their own team domain; and `src/lib/api.ts` derives the client's routes
 * from the Worker, so anything in this graph is also type-checked by the SPA
 * project, where the workerd globals are not loaded.
 */
export interface AccessBindings {
	/** AUD tag of the Access application. A secret: `wrangler secret put ACCESS_AUD`. */
	ACCESS_AUD?: string;
	/** Zero Trust team domain **without** scheme, e.g. `team.cloudflareaccess.com`. */
	ACCESS_TEAM_DOMAIN?: string;
	/** Local-only shortcut, set in `.dev.vars`. Absent in every deployment. */
	ACCESS_DEV_BYPASS?: string;
}

export interface SessionUser {
	email: string;
}

export type AccessEnv = {
	Bindings: AccessBindings;
	Variables: { user: SessionUser };
};

export interface AccessOptions {
	/** Where the public keys of the team come from; injected so tests stay offline. */
	getKey: (teamDomain: string) => JWTVerifyGetKey;
}

function isLocalHostname(url: string): boolean {
	return LOCAL_HOSTNAMES.has(new URL(url).hostname);
}

/**
 * Fails closed: unless a valid Access session can be verified, the request stops
 * here and the route handler never runs. This is deliberately thin — it is the
 * HTTP layer; the token itself is checked in `services/access-token.ts`.
 */
export function access({ getKey }: AccessOptions): MiddlewareHandler<AccessEnv> {
	return async (c, next) => {
		if (c.env.ACCESS_DEV_BYPASS === "1") {
			// Two conditions, never one: this variable only ever exists in
			// `.dev.vars`, and the hostname is only ever local. Getting past the
			// authentication would take a mistake *and* a non-local environment.
			if (!isLocalHostname(c.req.url)) {
				console.warn(
					"ACCESS_DEV_BYPASS is active but the request does not come from localhost; denying it.",
				);
				return c.json(errorBody("unauthorized", NO_SESSION_MESSAGE), 401);
			}

			console.warn("ACCESS_DEV_BYPASS: serving this request without verifying an Access session.");
			c.header("X-Nexus-Session", "development");
			c.set("user", { email: LOCAL_EMAIL });
			return next();
		}

		const { ACCESS_AUD, ACCESS_TEAM_DOMAIN } = c.env;
		if (!ACCESS_AUD || !ACCESS_TEAM_DOMAIN) {
			// Misconfiguration denies like anything else; it never opens the door.
			return c.json(errorBody("unauthorized", NO_SESSION_MESSAGE), 401);
		}

		const token = c.req.header(ACCESS_JWT_HEADER);
		const email = token
			? await verifyAccessToken(token, {
					getKey: getKey(ACCESS_TEAM_DOMAIN),
					issuer: `https://${ACCESS_TEAM_DOMAIN}`,
					audience: ACCESS_AUD,
				})
			: null;

		if (!email) {
			return c.json(errorBody("unauthorized", NO_SESSION_MESSAGE), 401);
		}

		c.set("user", { email });
		await next();
	};
}
