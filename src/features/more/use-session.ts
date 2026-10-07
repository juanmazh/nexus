import { useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { client } from "@/lib/api";

/**
 * Body of `GET /api/me`, derived from the Worker's own route handler so it can
 * never drift from the real contract.
 */
export type Me = InferResponseType<typeof client.api.me.$get>;

async function fetchMe(): Promise<Me> {
	const response = await client.api.me.$get();
	return response.json();
}

export const sessionQueryKey = ["me"] as const;

/**
 * Only mounted by the "Más" view, so opening the application does not spend a
 * Worker invocation to display a detail almost nobody looks at (design.md D11).
 * The free plan's budget is 100.000 requests a day and the project is built not
 * to waste them.
 */
export function useSession() {
	return useQuery({
		queryKey: sessionQueryKey,
		queryFn: fetchMe,
	});
}
