import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { createDb } from "../db/client";
import { settings } from "../db/schema";
import { apiRequest, setUpAccessKeys, signAccessToken, testEnv, testGetKey } from "../test-support";

/** The HTTP contract of the quiet hours (add-recurring-reminders design.md D3). */

const { app } = createApp({ getKey: testGetKey });
const db = createDb(env);
const PATH = "/api/settings/quiet-hours";

let token: string;

async function call(init: RequestInit & { session?: boolean } = {}) {
	const { session = true, ...rest } = init;
	return app.fetch(
		apiRequest(PATH, {
			...rest,
			...(session ? { token } : {}),
			headers: rest.body ? { "Content-Type": "application/json" } : undefined,
		}),
		{ ...testEnv(), DB: env.DB },
	);
}

const put = (body: unknown) => call({ method: "PUT", body: JSON.stringify(body) });

beforeAll(async () => {
	await setUpAccessKeys();
	token = await signAccessToken();
});

beforeEach(async () => {
	await db.delete(settings);
});

describe("GET /api/settings/quiet-hours", () => {
	it("answers the default, 23:00 to 08:00, before anything was saved", async () => {
		const res = await call();

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ start: "23:00", end: "08:00" });
	});

	it("answers 401 without a session", async () => {
		expect((await call({ session: false })).status).toBe(401);
	});
});

describe("PUT /api/settings/quiet-hours", () => {
	it("saves a window and answers it back, also when it is saved again", async () => {
		await put({ start: "22:00", end: "07:30" });
		const res = await put({ start: "00:30", end: "06:00" });

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ start: "00:30", end: "06:00" });
		expect(await (await call()).json()).toEqual({ start: "00:30", end: "06:00" });
	});

	it("turns the quiet hours off with null, which is not the default", async () => {
		const res = await put(null);

		expect(res.status).toBe(200);
		expect(await (await call()).json()).toBeNull();
	});

	it.each([
		[{ start: "23:00", end: "23:00" }, "El inicio y el fin no pueden ser la misma hora."],
		[{ start: "7:00", end: "08:00" }, "Las horas tienen que tener el formato HH:mm."],
		[{ start: "24:00", end: "08:00" }, "Las horas tienen que tener el formato HH:mm."],
	])("answers 400 with the project's shape for %j", async (body, message) => {
		const res = await put(body);

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: { code: "validation_error", message } });
	});

	it("answers 400 for an unknown property", async () => {
		expect((await put({ start: "23:00", end: "08:00", tz: "UTC" })).status).toBe(400);
	});

	it("answers 405 with Allow for a method it does not take", async () => {
		const res = await call({ method: "DELETE" });

		expect(res.status).toBe(405);
		expect(res.headers.get("Allow")).toBe("GET, PUT");
	});
});
