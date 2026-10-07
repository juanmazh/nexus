import type { AnyD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * One Drizzle instance per request, built from the request's `env`. Services
 * receive it instead of reaching for globals, which keeps them testable.
 *
 * The binding is declared structurally, with the type Drizzle exports for it,
 * instead of with `Cloudflare.Env`: `src/lib/api.ts` derives the client's routes
 * from the Worker, so every module a route imports is also type-checked by the
 * SPA project, where the workerd globals are not loaded. The same reasoning is
 * behind `AccessBindings` in `middleware/access.ts`.
 */
export function createDb(env: { DB: AnyD1Database }) {
	return drizzle(env.DB, { schema });
}

export type NexusDb = ReturnType<typeof createDb>;
