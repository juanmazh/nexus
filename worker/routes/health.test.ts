import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { apiRequest, setUpAccessKeys, signAccessToken, testEnv, testGetKey } from "../test-support";

// The app under test is the real one, so the assertions cover the routing chain,
// the /api basePath, the Access middleware and the error handlers together. Its
// `env` is always explicit and its host is never localhost, so no local
// `.dev.vars` can change the result (design.md §7).
const { app } = createApp({ getKey: testGetKey });

const NOT_FOUND = { error: { code: "not_found", message: "Esta ruta no existe." } };

beforeAll(setUpAccessKeys);

describe("GET /api/health", () => {
	it('responds 200 with { status: "ok" }', async () => {
		const res = await app.fetch(apiRequest("/api/health"), testEnv());

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toContain("application/json");
		expect(await res.json()).toEqual({ status: "ok" });
	});

	it("does not require an Access session, nor a configured Access", async () => {
		const res = await app.fetch(
			apiRequest("/api/health"),
			testEnv({ ACCESS_AUD: undefined, ACCESS_TEAM_DOMAIN: undefined }),
		);

		expect(res.status).toBe(200);
	});
});

describe("methods other than GET on /api/health", () => {
	it("rejects POST with 405, Allow: GET and the project's error shape", async () => {
		const res = await app.fetch(
			apiRequest("/api/health", { token: await signAccessToken(), method: "POST" }),
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

	it("rejects POST without a session, because only GET /api/health is open", async () => {
		const res = await app.fetch(apiRequest("/api/health", { method: "POST" }), testEnv());

		expect(res.status).toBe(401);
	});
});

describe("unknown API route", () => {
	it("answers 401 with the error shape when there is no session", async () => {
		const res = await app.fetch(apiRequest("/api/no-existe"), testEnv());
		const body = await res.text();

		expect(res.status).toBe(401);
		expect(res.headers.get("Content-Type")).toContain("application/json");
		expect(JSON.parse(body)).toEqual({
			error: { code: "unauthorized", message: "No hay una sesión válida." },
		});
		expect(body).not.toContain("<!DOCTYPE");
	});

	it("answers 401 when the session cannot be verified", async () => {
		const res = await app.fetch(apiRequest("/api/no-existe", { token: "no-es-un-jwt" }), testEnv());

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({
			error: { code: "unauthorized", message: "No hay una sesión válida." },
		});
	});

	it("answers 404 once the session is valid, and never HTML", async () => {
		const res = await app.fetch(
			apiRequest("/api/no-existe", { token: await signAccessToken() }),
			testEnv(),
		);
		const body = await res.text();

		expect(res.status).toBe(404);
		expect(res.headers.get("Content-Type")).toContain("application/json");
		expect(JSON.parse(body)).toEqual(NOT_FOUND);
		expect(body).not.toContain("<!DOCTYPE");
	});
});

describe("environment", () => {
	it("has the D1 binding available even though health does not use it", () => {
		expect(env.DB).toBeDefined();
	});
});
