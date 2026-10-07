import type { InferResponseType } from "hono/client";
import { client } from "@/lib/api";

/**
 * Body of `GET /api/health`, derived from the Worker's own route handler so it
 * can never drift from the real contract.
 */
export type Health = InferResponseType<typeof client.api.health.$get>;

/**
 * The only way the SPA reaches the API: the typed RPC client, never a bare
 * `fetch`. `client.api.health.$get()` exists because the `/api` basePath lives
 * on the server and is part of `AppType`.
 */
export async function fetchHealth(): Promise<Health> {
	const response = await client.api.health.$get();
	return response.json();
}
