import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import app from "../index";

// The app under test is the real Worker entry point, so the assertions cover the
// routing, the error handlers and the /api basePath together.
describe("GET /api/health", () => {
	it('responds 200 with { status: "ok" }', async () => {
		const res = await app.fetch(new Request("http://localhost/api/health"));

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toContain("application/json");
		expect(await res.json()).toEqual({ status: "ok" });
	});

	it("does not require an Access session", async () => {
		const res = await app.fetch(new Request("http://localhost/api/health"));

		expect(res.status).toBe(200);
	});
});

describe("methods other than GET on /api/health", () => {
	it("rejects POST with 405, Allow: GET and the project's error shape", async () => {
		const res = await app.fetch(new Request("http://localhost/api/health", { method: "POST" }));

		expect(res.status).toBe(405);
		expect(res.headers.get("Allow")).toBe("GET");
		expect(await res.json()).toEqual({
			error: {
				code: "method_not_allowed",
				message: "Este endpoint solo admite GET.",
			},
		});
	});
});

describe("unknown API route", () => {
	it("answers 404 with the error shape and never HTML", async () => {
		const res = await app.fetch(new Request("http://localhost/api/no-existe"));
		const body = await res.text();

		expect(res.status).toBe(404);
		expect(res.headers.get("Content-Type")).toContain("application/json");
		expect(JSON.parse(body)).toEqual({
			error: { code: "not_found", message: "Esta ruta no existe." },
		});
		expect(body).not.toContain("<!DOCTYPE");
	});
});

describe("environment", () => {
	it("has the D1 binding available even though health does not use it", () => {
		expect(env.DB).toBeDefined();
	});
});
