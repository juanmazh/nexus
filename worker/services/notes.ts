import {
	type CreateNoteInput,
	likePattern,
	NOTE_LIST_LIMIT,
	noteExcerpt,
	noteSearchText,
	noteTitle,
	type UpdateNoteInput,
} from "@shared/notes";
import { desc, eq, type InferSelectModel, sql } from "drizzle-orm";
import type { NexusDb } from "../db/client";
import { notes } from "../db/schema";

/**
 * The rules of a note, with no HTTP (add-notes design.md D1–D3): one query per
 * read and one write per mutation, as everywhere else in the Worker.
 */

type NoteRow = InferSelectModel<typeof notes>;

/** What the API answers for one note: everything but the search column. */
export type Note = Omit<NoteRow, "search_text">;

/** What the list answers: no content, an excerpt instead. */
export type ListedNote = Pick<NoteRow, "id" | "title" | "pinned" | "updated_at"> & {
	excerpt: string;
};

const noteColumns = {
	id: notes.id,
	title: notes.title,
	content: notes.content,
	pinned: notes.pinned,
	created_at: notes.created_at,
	updated_at: notes.updated_at,
};

/** `title` and `search_text` always come from the content, never from outside. */
function derived(content: string) {
	return { content, title: noteTitle(content), search_text: noteSearchText(content) };
}

/**
 * Pinned first, then the most recently changed. The search is a `LIKE` on the
 * normalized column (design.md D2); the content is read to cut the excerpt
 * here, so the list never carries whole notes over the network.
 */
export async function listNotes(db: NexusDb, query?: string): Promise<ListedNote[]> {
	const rows = await db
		.select({
			id: notes.id,
			title: notes.title,
			content: notes.content,
			pinned: notes.pinned,
			updated_at: notes.updated_at,
		})
		.from(notes)
		.where(query ? sql`${notes.search_text} LIKE ${likePattern(query)} ESCAPE '\\'` : undefined)
		.orderBy(desc(notes.pinned), desc(notes.updated_at))
		.limit(NOTE_LIST_LIMIT)
		.all();

	return rows.map(({ content, ...row }) => ({ ...row, excerpt: noteExcerpt(content) }));
}

export async function getNote(db: NexusDb, id: string): Promise<Note | null> {
	const [row] = await db.select(noteColumns).from(notes).where(eq(notes.id, id)).limit(1);
	return row ?? null;
}

export async function createNote(
	db: NexusDb,
	input: CreateNoteInput,
	now: number = Date.now(),
): Promise<Note> {
	const [created] = await db
		.insert(notes)
		.values({
			id: crypto.randomUUID(),
			...derived(input.content),
			pinned: false,
			created_at: now,
			updated_at: now,
		})
		.returning(noteColumns);
	if (!created) {
		throw new Error("La nota no se ha podido crear.");
	}
	return created;
}

/**
 * Pinning alone does not touch `updated_at`: pinning is not editing, and the
 * list must not reorder a note as if it had just been written (design.md D3).
 */
export async function updateNote(
	db: NexusDb,
	id: string,
	patch: UpdateNoteInput,
	now: number = Date.now(),
): Promise<Note | null> {
	const [updated] = await db
		.update(notes)
		.set({
			...(patch.content === undefined ? {} : { ...derived(patch.content), updated_at: now }),
			...(patch.pinned === undefined ? {} : { pinned: patch.pinned }),
		})
		.where(eq(notes.id, id))
		.returning(noteColumns);
	return updated ?? null;
}

export async function deleteNote(db: NexusDb, id: string): Promise<boolean> {
	const deleted = await db.delete(notes).where(eq(notes.id, id)).returning({ id: notes.id });
	return deleted.length > 0;
}
