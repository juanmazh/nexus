import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * One Drizzle instance per request, built from the request's `env`. Services
 * receive it instead of reaching for globals, which keeps them testable.
 */
export function createDb(env: Env) {
	return drizzle(env.DB, { schema });
}

export type NexusDb = ReturnType<typeof createDb>;
