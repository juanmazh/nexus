import { Hono } from "hono";
import { notFound, onError } from "./middleware/errors";
import { health } from "./routes/health";

export const app = new Hono().basePath("/api");

app.onError(onError);
// `onError` alone does not catch unmatched routes (Hono would answer 404 in
// text/plain), so the not-found handler is registered too.
app.notFound(notFound);

const routes = app.route("/health", health);

/**
 * The type of the chained routes is what `hc` needs to type the client's calls.
 * Because the `/api` basePath lives on the server and is part of this type, the
 * front calls `client.api.health.$get()`.
 */
export type AppType = typeof routes;
