import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "../db/client";
import { notes } from "../db/schema";
import { createNote, deleteNote, getNote, listNotes, updateNote } from "./notes";

/** The rules of a note against the real D1 of the pool, with a fixed clock. */

const db = createDb(env);
const T0 = Date.UTC(2026, 9, 9, 10, 0);
const HOUR = 3_600_000;

beforeEach(async () => {
	await db.delete(notes);
});

describe("notes service", () => {
	it("derives the title and the search text from the content", async () => {
		const note = await createNote(db, { content: "# Canción\nde cumpleaños" }, T0);
		const [row] = await db.select().from(notes);

		expect(note).toMatchObject({ title: "Canción", pinned: false, created_at: T0, updated_at: T0 });
		expect(note).not.toHaveProperty("search_text");
		expect(row?.search_text).toBe("cancion\n# cancion\nde cumpleanos");
	});

	it("lists pinned first, then the most recently changed, with an excerpt and no content", async () => {
		const old = await createNote(db, { content: "Antigua\nfijada" }, T0);
		const recent = await createNote(db, { content: "Reciente" }, T0 + HOUR);
		const middle = await createNote(db, { content: "Intermedia" }, T0 + HOUR / 2);
		await updateNote(db, old.id, { pinned: true }, T0 + 2 * HOUR);

		const list = await listNotes(db);

		expect(list.map((note) => note.id)).toEqual([old.id, recent.id, middle.id]);
		expect(list[0]).toEqual({
			id: old.id,
			title: "Antigua",
			excerpt: "fijada",
			pinned: true,
			updated_at: T0,
		});
	});

	it("pinning does not change the modification date; editing the content does", async () => {
		const note = await createNote(db, { content: "Una" }, T0);

		const pinned = await updateNote(db, note.id, { pinned: true }, T0 + HOUR);
		const edited = await updateNote(db, note.id, { content: "# Otra\nmás" }, T0 + 2 * HOUR);

		expect(pinned).toMatchObject({ pinned: true, updated_at: T0 });
		expect(edited).toMatchObject({ title: "Otra", pinned: true, updated_at: T0 + 2 * HOUR });
	});

	it("searches title and content without case or accents", async () => {
		await createNote(db, { content: "Canción de cumpleaños" }, T0);
		await createNote(db, { content: "Lista\nPINGÜINO de peluche" }, T0);
		await createNote(db, { content: "Otra cosa" }, T0);

		expect((await listNotes(db, "CANCION")).map((note) => note.title)).toEqual([
			"Canción de cumpleaños",
		]);
		expect((await listNotes(db, "pingüino")).map((note) => note.title)).toEqual(["Lista"]);
	});

	it("treats % and _ in the search as text", async () => {
		await createNote(db, { content: "Descuento del 50% en todo" }, T0);
		await createNote(db, { content: "Descuento del 50 en todo" }, T0);
		await createNote(db, { content: "variable_global" }, T0);
		await createNote(db, { content: "variablexglobal" }, T0);

		expect((await listNotes(db, "50%")).map((note) => note.title)).toEqual([
			"Descuento del 50% en todo",
		]);
		expect((await listNotes(db, "e_g")).map((note) => note.title)).toEqual(["variable_global"]);
	});

	it("answers null or false for a note that does not exist", async () => {
		const missing = crypto.randomUUID();

		expect(await getNote(db, missing)).toBeNull();
		expect(await updateNote(db, missing, { pinned: true })).toBeNull();
		expect(await deleteNote(db, missing)).toBe(false);
	});

	it("deletes a note", async () => {
		const note = await createNote(db, { content: "Borrar" }, T0);

		expect(await deleteNote(db, note.id)).toBe(true);
		expect(await getNote(db, note.id)).toBeNull();
	});
});
