import { Hono } from "hono";
import { beforeAll, describe, expect, it } from "vitest";
import { apiRequest, setUpAccessKeys, signAccessToken, testEnv, testGetKey } from "../test-support";
import type { AccessEnv } from "./access";
import { access } from "./access";

const DENIED = { error: { code: "unauthorized", message: "No hay una sesión válida." } };

beforeAll(setUpAccessKeys);

/**
 * The middleware on its own, with one route that echoes the principal. What the
 * real app adds on top (the open health check, the mounted routes) is covered by
 * `routes/health.test.ts`.
 */
function probeApp() {
	return new Hono<AccessEnv>()
		.basePath("/api")
		.use("*", access({ getKey: testGetKey }))
		.get("/probe", (c) => c.json({ email: c.get("user").email }, 200));
}

describe("a request with a valid session", () => {
	it("reaches the route with the email of the token", async () => {
		const res = await probeApp().fetch(
			apiRequest("/api/probe", { token: await signAccessToken() }),
			testEnv(),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ email: "persona@ejemplo.test" });
	});
});

describe("a request without a session", () => {
	it("denies a request with no Access header", async () => {
		const res = await probeApp().fetch(apiRequest("/api/probe"), testEnv());

		expect(res.status).toBe(401);
		expect(res.headers.get("Content-Type")).toContain("application/json");
		expect(await res.json()).toEqual(DENIED);
	});

	it("denies a header that is not a JWT", async () => {
		const res = await probeApp().fetch(
			apiRequest("/api/probe", { token: "esto-no-es-un-jwt" }),
			testEnv(),
		);

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual(DENIED);
	});

	it("denies an expired token", async () => {
		const nowInSeconds = Math.floor(Date.now() / 1000);
		const res = await probeApp().fetch(
			apiRequest("/api/probe", { token: await signAccessToken({ exp: nowInSeconds - 60 }) }),
			testEnv(),
		);

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual(DENIED);
	});

	it("denies a token issued for another application", async () => {
		const res = await probeApp().fetch(
			apiRequest("/api/probe", { token: await signAccessToken({ aud: "otra-aplicacion" }) }),
			testEnv(),
		);

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual(DENIED);
	});

	it("answers every denial with the same body, so the reason never leaks", async () => {
		const app = probeApp();
		const withoutHeader = await (await app.fetch(apiRequest("/api/probe"), testEnv())).text();
		const withForgedToken = await (
			await app.fetch(apiRequest("/api/probe", { token: "a.b.c" }), testEnv())
		).text();

		expect(withoutHeader).toBe(withForgedToken);
		expect(withoutHeader).not.toContain("signature");
		expect(withoutHeader).not.toContain("aud");
		expect(withoutHeader).not.toContain("expired");
	});
});

describe("the local shortcut", () => {
	it("serves a localhost request without a session and says it is a development one", async () => {
		const res = await probeApp().fetch(
			apiRequest("/api/probe", { origin: "http://localhost:5173" }),
			testEnv({ ACCESS_DEV_BYPASS: "1" }),
		);

		expect(res.status).toBe(200);
		expect(res.headers.get("X-Nexus-Session")).toBe("development");
		expect(await res.json()).toEqual({ email: "local@nexus.test" });
	});

	it("serves 127.0.0.1 too, since that is also the local machine", async () => {
		const res = await probeApp().fetch(
			apiRequest("/api/probe", { origin: "http://127.0.0.1:5173" }),
			testEnv({ ACCESS_DEV_BYPASS: "1" }),
		);

		expect(res.status).toBe(200);
	});

	it("denies when the shortcut is active but the host is not local", async () => {
		const res = await probeApp().fetch(
			apiRequest("/api/probe"),
			testEnv({ ACCESS_DEV_BYPASS: "1" }),
		);

		expect(res.status).toBe(401);
		expect(res.headers.get("X-Nexus-Session")).toBeNull();
		expect(await res.json()).toEqual(DENIED);
	});

	it("denies localhost when the shortcut is off", async () => {
		const res = await probeApp().fetch(
			apiRequest("/api/probe", { origin: "http://localhost:5173" }),
			testEnv(),
		);

		expect(res.status).toBe(401);
	});
});

describe("a Worker without its Access configuration", () => {
	it("denies when the audience is missing", async () => {
		const res = await probeApp().fetch(
			apiRequest("/api/probe", { token: await signAccessToken() }),
			testEnv({ ACCESS_AUD: undefined }),
		);

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual(DENIED);
	});

	it("denies when the team domain is missing", async () => {
		const res = await probeApp().fetch(
			apiRequest("/api/probe", { token: await signAccessToken() }),
			testEnv({ ACCESS_TEAM_DOMAIN: undefined }),
		);

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual(DENIED);
	});
});
