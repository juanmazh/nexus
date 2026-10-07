import type { MiddlewareHandler } from "hono";

/**
 * The API answers JSON and nothing else, so it needs no external resource at
 * all and must never be framed. `default-src 'none'` is the strongest statement
 * of that; `frame-ancestors` covers browsers that ignore `X-Frame-Options`.
 */
const API_CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'";

/**
 * Headers of every response the Worker serves. The Worker never sees the HTML of
 * the SPA — `run_worker_first` hands the assets to Cloudflare's asset manager —
 * so the app and its assets get their own policy in `public/_headers` instead.
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
	c.header("X-Content-Type-Options", "nosniff");
	c.header("Referrer-Policy", "no-referrer");
	c.header("X-Frame-Options", "DENY");
	c.header("Content-Security-Policy", API_CONTENT_SECURITY_POLICY);

	await next();
};
