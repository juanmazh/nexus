import type { hc, InferResponseType } from "hono/client";
import { beforeAll, describe, expect, it } from "vitest";
import type { AppType } from "../app";
import { createApp } from "../app";
import {
	apiRequest,
	setUpAccessKeys,
	signAccessToken,
	TEST_EMAIL,
	testEnv,
	testGetKey,
} from "../test-support";

const { app } = createApp({ getKey: testGetKey });

const DENIED = { error: { code: "unauthorized", message: "No hay una sesión válida." } };

/** Exactly what `src/lib/api.ts` exposes as `client.api.me.$get()`, derived from `AppType`. */
type MeGet = ReturnType<typeof hc<AppType, "/">>["api"]["me"]["$get"];

type MeResponse = InferResponseType<MeGet>;

beforeAll(setUpAccessKeys);

describe("the typed contract", () => {
	it("derives { user: { email } } from AppType instead of a hand-written type", () => {
		// Fails to compile — not just to run — if `AppType` stops exposing the call
		// or the route stops answering that shape (ADR-007).
		const derivedFromTheRouteChain: MeResponse extends { user: { email: string } } ? true : never =
			true;

		expect(derivedFromTheRouteChain).toBe(true);
	});
});

describe("GET /api/me", () => {
	it("answers 200 with the email of the verified token", async () => {
		const res = await app.fetch(
			apiRequest("/api/me", { token: await signAccessToken() }),
			testEnv(),
		);

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toContain("application/json");
		expect(await res.json()).toEqual({ user: { email: TEST_EMAIL } });
	});

	it("answers 401 and no email at all without a session", async () => {
		const res = await app.fetch(apiRequest("/api/me"), testEnv());

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual(DENIED);
	});

	it("answers 401 when the session cannot be verified", async () => {
		const res = await app.fetch(
			apiRequest("/api/me", { token: await signAccessToken({ aud: "otra-aplicacion" }) }),
			testEnv(),
		);

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual(DENIED);
	});

	it("answers 401 when a valid token carries no email, because nobody can be identified", async () => {
		const res = await app.fetch(
			apiRequest("/api/me", { token: await signAccessToken({ email: undefined }) }),
			testEnv(),
		);

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual(DENIED);
	});

	it("rejects POST with 405, Allow: GET and the project's error shape", async () => {
		const res = await app.fetch(
			apiRequest("/api/me", { token: await signAccessToken(), method: "POST" }),
			testEnv(),
		);

		expect(res.status).toBe(405);
		expect(res.headers.get("Allow")).toBe("GET");
		expect(await res.json()).toEqual({
			error: {
				code: "method_not_allowed",
				message: "Este endpoint solo admite GET.",
			},
		});
	});

	it("answers the development session when the local shortcut is on", async () => {
		const res = await app.fetch(
			apiRequest("/api/me", { origin: "http://localhost:5173" }),
			testEnv({ ACCESS_DEV_BYPASS: "1" }),
		);

		expect(res.status).toBe(200);
		expect(res.headers.get("X-Nexus-Session")).toBe("development");
		expect(await res.json()).toEqual({ user: { email: "local@nexus.test" } });
	});
});
