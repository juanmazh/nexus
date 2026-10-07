import { Hono } from "hono";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { apiRequest, setUpAccessKeys, signAccessToken, testEnv, testGetKey } from "../test-support";
import type { AccessEnv } from "./access";
import { onError } from "./errors";
import { securityHeaders } from "./security-headers";

const { app } = createApp({ getKey: testGetKey });

beforeAll(setUpAccessKeys);

function expectSecurityHeaders(res: Response) {
	expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
	expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
	expect(res.headers.get("X-Frame-Options")).toBe("DENY");
	expect(res.headers.get("Content-Security-Policy")).toBe(
		"default-src 'none'; frame-ancestors 'none'",
	);
}

describe("the security headers of /api/*", () => {
	it("are present in a 200", async () => {
		expectSecurityHeaders(await app.fetch(apiRequest("/api/health"), testEnv()));
	});

	it("are present in a 401", async () => {
		expectSecurityHeaders(await app.fetch(apiRequest("/api/me"), testEnv()));
	});

	it("are present in a 404", async () => {
		const token = await signAccessToken();
		expectSecurityHeaders(await app.fetch(apiRequest("/api/no-existe", { token }), testEnv()));
	});

	it("are present in a 405", async () => {
		const token = await signAccessToken();
		expectSecurityHeaders(
			await app.fetch(apiRequest("/api/me", { token, method: "POST" }), testEnv()),
		);
	});

	it("are present in a 500, even though the handler threw", async () => {
		// The real app has no route that fails on purpose, so the middleware is
		// exercised on a minimal app that does.
		const failingApp = new Hono<AccessEnv>()
			.basePath("/api")
			.onError(onError)
			.use("*", securityHeaders)
			.get("/boom", () => {
				throw new Error("boom");
			});

		expectSecurityHeaders(await failingApp.fetch(apiRequest("/api/boom"), testEnv()));
	});
});

describe("the API content security policy", () => {
	it("loads no resource at all and cannot be framed", async () => {
		const res = await app.fetch(apiRequest("/api/health"), testEnv());
		const policy = res.headers.get("Content-Security-Policy") ?? "";

		expect(policy).toContain("default-src 'none'");
		expect(policy).toContain("frame-ancestors 'none'");
	});
});
