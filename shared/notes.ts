import { z } from "zod";

/**
 * The rules of a note shared by the Worker and the SPA (add-notes design.md D1,
 * D2): what its title is, how it reads in the list, and how it is searched.
 * The Worker stores what these functions return; the SPA uses the same ones to
 * show the title of a note while it is being written.
 */

export const NOTE_CONTENT_MAX = 50_000;
export const NOTE_TITLE_MAX = 120;
export const NOTE_EXCERPT_MAX = 140;
export const NOTE_SEARCH_MAX = 100;
/** A cap on the list, not a page size: one person will not get near it. */
export const NOTE_LIST_LIMIT = 500;

/** Block markers at the start of a line: heading, quote, list item, task box. */
const LINE_MARKERS = /^(?:#{1,6}\s+|>\s*|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)+/;
/** Inline emphasis and code markers, enough for a one-line preview. */
const INLINE_MARKERS = /\*+|`+|~~/g;
/** `_` only as emphasis, around words: `snake_case` keeps its underscore. */
const UNDERSCORE_EMPHASIS = /(^|[\s(])_+|_+(?=[\s).,;:!?]|$)/g;
/** `[text](url)` → `text`, for the preview. */
const LINK = /!?\[([^\]]*)\]\([^)]*\)/g;

function plainLine(line: string): string {
	return line
		.trim()
		.replace(LINE_MARKERS, "")
		.replace(LINK, "$1")
		.replace(INLINE_MARKERS, "")
		.replace(UNDERSCORE_EMPHASIS, "$1")
		.replace(/\s+/g, " ")
		.trim();
}

function cut(text: string, max: number): string {
	return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** The lines of `content` with something to say, already without markers. */
function meaningfulLines(content: string): string[] {
	return content
		.split(/\r?\n/)
		.map(plainLine)
		.filter((line) => line !== "");
}

/**
 * The first line with text, without its Markdown markers, at most 120
 * characters. A note made only of markers ("---") still needs a name.
 */
export function noteTitle(content: string): string {
	const [first] = meaningfulLines(content);
	return first === undefined ? "Nota sin título" : cut(first, NOTE_TITLE_MAX);
}

/**
 * The content without the line that gives the note its title, for the
 * formatted view: the title is already the heading of the page, and showing it
 * twice reads like a mistake.
 */
export function noteBody(content: string): string {
	const lines = content.split(/\r?\n/);
	const titleLine = lines.findIndex((line) => plainLine(line) !== "");
	return titleLine === -1
		? ""
		: lines
				.slice(titleLine + 1)
				.join("\n")
				.replace(/^\s*\n/, "");
}

/** What follows the title, flattened into one line of at most 140 characters. */
export function noteExcerpt(content: string): string {
	return cut(meaningfulLines(content).slice(1).join(" · "), NOTE_EXCERPT_MAX);
}

/** Lower case and without diacritics: "Canción" and "CANCION" are the same. */
export function normalizeForSearch(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

/** What is stored in `search_text` for a note with this content. */
export function noteSearchText(content: string): string {
	return normalizeForSearch(`${noteTitle(content)}\n${content}`);
}

/**
 * A search term as a `LIKE` pattern with `\` as the escape: `%` and `_` typed
 * by the person are text, not wildcards.
 */
export function likePattern(term: string): string {
	return `%${normalizeForSearch(term).replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

const contentSchema = z
	.string({ error: "Escribe algo en la nota." })
	.refine((value) => value.trim() !== "", "Escribe algo en la nota.")
	.refine(
		(value) => value.length <= NOTE_CONTENT_MAX,
		`Una nota no puede pasar de ${NOTE_CONTENT_MAX.toLocaleString("es-ES")} caracteres.`,
	);

export const createNoteSchema = z.strictObject({ content: contentSchema });

export const updateNoteSchema = z
	.strictObject({
		content: contentSchema.optional(),
		pinned: z.boolean({ error: "Fijada tiene que ser verdadero o falso." }).optional(),
	})
	.refine(
		(patch) => patch.content !== undefined || patch.pinned !== undefined,
		"Indica qué cambiar de la nota.",
	);

export const listNotesQuerySchema = z.strictObject({
	q: z
		.string()
		.trim()
		.max(NOTE_SEARCH_MAX, `La búsqueda no puede pasar de ${NOTE_SEARCH_MAX} caracteres.`)
		.optional(),
});

export const noteIdParamSchema = z.strictObject({
	id: z.uuid("Ese identificador de nota no es válido."),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
