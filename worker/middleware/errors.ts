import type { Context, ErrorHandler, NotFoundHandler } from "hono";

/**
 * Every error the API returns has the same shape, so the front only has to
 * learn one error contract. Messages are written for the person using the app
 * and never carry a stack trace.
 */
export function errorBody(
	code: string,
	message: string,
): { error: { code: string; message: string } } {
	return { error: { code, message } };
}

export const onError: ErrorHandler = (err: Error, c: Context) => {
	// Anything reaching here is a bug we did not anticipate: log it on the Worker
	// (never in the body) and answer with a generic 500.
	console.error("Unhandled error in the API:", err);
	return c.json(errorBody("internal_error", "Se ha producido un error inesperado."), 500);
};

export const notFound: NotFoundHandler = (c: Context) =>
	c.json(errorBody("not_found", "Esta ruta no existe."), 404);
