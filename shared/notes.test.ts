import { describe, expect, it } from "vitest";
import {
	createNoteSchema,
	likePattern,
	listNotesQuerySchema,
	NOTE_CONTENT_MAX,
	normalizeForSearch,
	noteBody,
	noteExcerpt,
	noteSearchText,
	noteTitle,
	updateNoteSchema,
} from "./notes";

describe("noteTitle", () => {
	it.each([
		["# Lista de la compra\n- pan", "Lista de la compra"],
		["\n\n   \nPrimera línea con texto", "Primera línea con texto"],
		["- [ ] Llamar al taller", "Llamar al taller"],
		["> **Cita** importante", "Cita importante"],
		["1. Paso uno", "Paso uno"],
		["Ver [la web](https://example.test) mañana", "Ver la web mañana"],
		["__Importante__: *revisar* `config`", "Importante: revisar config"],
		["variable_global y otra_más", "variable_global y otra_más"],
		["   ", "Nota sin título"],
	])("%j → %j", (content, title) => {
		expect(noteTitle(content)).toBe(title);
	});

	it("cuts a long first line to 120 characters with an ellipsis", () => {
		const title = noteTitle("a".repeat(300));

		expect(title).toHaveLength(120);
		expect(title.endsWith("…")).toBe(true);
	});
});

describe("noteBody", () => {
	it("is the content after the title line, keeping its Markdown", () => {
		expect(noteBody("\n# Compra\n\n- pan\n- **leche**")).toBe("- pan\n- **leche**");
	});

	it("is empty for a note with only a title", () => {
		expect(noteBody("Solo el título")).toBe("");
	});
});

describe("noteExcerpt", () => {
	it("is what follows the title, in one line, without markers", () => {
		expect(noteExcerpt("# Compra\n- pan\n- **leche**\n\n- huevos")).toBe("pan · leche · huevos");
	});

	it("is empty for a note with only a title", () => {
		expect(noteExcerpt("Solo el título")).toBe("");
	});

	it("is at most 140 characters", () => {
		expect(noteExcerpt(`T\n${"palabra ".repeat(60)}`).length).toBeLessThanOrEqual(140);
	});
});

describe("search", () => {
	it("ignores case and diacritics", () => {
		expect(normalizeForSearch("Canción PINGÜINO Año")).toBe("cancion pinguino ano");
	});

	it("stores the title and the content normalized", () => {
		expect(noteSearchText("# Canción\nde Ávila")).toBe("cancion\n# cancion\nde avila");
	});

	it("turns % and _ typed by the person into text", () => {
		expect(likePattern("50%_off\\x")).toBe("%50\\%\\_off\\\\x%");
	});
});

describe("schemas", () => {
	it("rejects a note that is only blank", () => {
		const result = createNoteSchema.safeParse({ content: " \n\t " });

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.message).toBe("Escribe algo en la nota.");
	});

	it("rejects more than 50.000 characters and unknown fields", () => {
		expect(createNoteSchema.safeParse({ content: "a".repeat(NOTE_CONTENT_MAX + 1) }).success).toBe(
			false,
		);
		expect(createNoteSchema.safeParse({ content: "a", title: "b" }).success).toBe(false);
	});

	it("asks for something to change in an edit", () => {
		expect(updateNoteSchema.safeParse({}).success).toBe(false);
		expect(updateNoteSchema.safeParse({ pinned: true }).success).toBe(true);
	});

	it("trims the search and caps it at 100 characters", () => {
		expect(listNotesQuerySchema.parse({ q: "  pan  " })).toEqual({ q: "pan" });
		expect(listNotesQuerySchema.safeParse({ q: "a".repeat(101) }).success).toBe(false);
	});
});
