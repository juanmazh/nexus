import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { createDb } from "../db/client";
import { notes } from "../db/schema";
import { apiRequest, setUpAccessKeys, signAccessToken, testEnv, testGetKey } from "../test-support";

/** The HTTP contract of the notes (add-notes design.md D3). */

const { app } = createApp({ getKey: testGetKey });
const db = createDb(env);
let token: string;

async function call(path: string, init: RequestInit & { session?: boolean } = {}) {
	const { session = true, ...rest } = init;
	return app.fetch(
		apiRequest(path, {
			...rest,
			...(session ? { token } : {}),
			headers: rest.body ? { "Content-Type": "application/json" } : undefined,
		}),
		{ ...testEnv(), DB: env.DB },
	);
}

const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

async function newNote(content: string): Promise<{ id: string }> {
	return (await call("/api/notes", json("POST", { content }))).json();
}

beforeAll(async () => {
	await setUpAccessKeys();
	token = await signAccessToken();
});

beforeEach(async () => {
	await db.delete(notes);
});

describe("/api/notes", () => {
	it("creates a note and answers 201 with its derived title", async () => {
		const res = await call("/api/notes", json("POST", { content: "# Ideas\n- una" }));

		expect(res.status).toBe(201);
		expect(await res.json()).toMatchObject({
			title: "Ideas",
			content: "# Ideas\n- una",
			pinned: false,
		});
	});

	it.each([
		[{ content: "  \n " }, "Escribe algo en la nota."],
		[{}, "Escribe algo en la nota."],
	])("answers 400 with the project's shape for %j", async (body, message) => {
		const res = await call("/api/notes", json("POST", body));

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: { code: "validation_error", message } });
	});

	it("rejects a title sent from outside", async () => {
		expect((await call("/api/notes", json("POST", { content: "a", title: "b" }))).status).toBe(400);
	});

	it("lists without the content and searches without accents", async () => {
		await newNote("Canción\nletra entera");
		await newNote("Otra");

		const all = (await (await call("/api/notes")).json()) as Record<string, unknown>[];
		const found = (await (await call("/api/notes?q=cancion")).json()) as { title: string }[];

		expect(all).toHaveLength(2);
		expect(all[0]).not.toHaveProperty("content");
		expect(found.map((note) => note.title)).toEqual(["Canción"]);
	});

	it("answers 400 for a search longer than 100 characters", async () => {
		expect((await call(`/api/notes?q=${"a".repeat(101)}`)).status).toBe(400);
	});

	it("reads, edits, pins and deletes a note", async () => {
		const { id } = await newNote("Primera");

		const read = await call(`/api/notes/${id}`);
		const edited = await call(`/api/notes/${id}`, json("PATCH", { content: "# Segunda" }));
		const pinned = await call(`/api/notes/${id}`, json("PATCH", { pinned: true }));
		const deleted = await call(`/api/notes/${id}`, { method: "DELETE" });

		expect(read.status).toBe(200);
		expect(await edited.json()).toMatchObject({ title: "Segunda" });
		expect(await pinned.json()).toMatchObject({ title: "Segunda", pinned: true });
		expect(deleted.status).toBe(204);
		expect((await call(`/api/notes/${id}`)).status).toBe(404);
	});

	it("answers 400 for an empty edit and for blank content", async () => {
		const { id } = await newNote("Algo");

		expect((await call(`/api/notes/${id}`, json("PATCH", {}))).status).toBe(400);
		expect((await call(`/api/notes/${id}`, json("PATCH", { content: " " }))).status).toBe(400);
	});

	it("answers 404 with its message for a note that does not exist", async () => {
		const res = await call(`/api/notes/${crypto.randomUUID()}`, json("PATCH", { pinned: true }));

		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({
			error: { code: "not_found", message: "Esta nota ya no existe." },
		});
	});

	it("answers 400 for an id that is not one", async () => {
		expect((await call("/api/notes/no-es-un-id")).status).toBe(400);
	});

	it("answers 405 with Allow for a method a path does not take", async () => {
		const list = await call("/api/notes", { method: "DELETE" });
		const one = await call(`/api/notes/${crypto.randomUUID()}`, { method: "POST" });

		expect(list.status).toBe(405);
		expect(list.headers.get("Allow")).toBe("GET, POST");
		expect(one.headers.get("Allow")).toBe("GET, PATCH, DELETE");
	});

	it("answers 401 without a session", async () => {
		expect((await call("/api/notes", { session: false })).status).toBe(401);
	});
});
