/**
 * The RPC client resolves on 4xx and 5xx too. This turns any non-2xx into an
 * error carrying the message the API wrote for the person, so a hook can show it
 * as it is.
 */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export async function failure(response: Response): Promise<ApiError> {
	const body = (await response.json().catch(() => null)) as {
		error?: { message?: string };
	} | null;
	return new ApiError(
		response.status,
		body?.error?.message ?? "No se ha podido completar la acción.",
	);
}
