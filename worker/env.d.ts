/**
 * `ACCESS_DEV_BYPASS` cannot come from `wrangler types`: that command reads each
 * team's `.dev.vars`, so the type would change from machine to machine. It is
 * declared by hand and as **optional** because that is the truth — in a deployed
 * Worker it does not exist (design.md §3).
 */
declare global {
	namespace Cloudflare {
		interface Env {
			/** `"1"` lets `/api/*` be called from localhost without a session. Never deployed. */
			ACCESS_DEV_BYPASS?: string;
		}
	}
}

export {};
