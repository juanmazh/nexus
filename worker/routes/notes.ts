import {
	createNoteSchema,
	listNotesQuerySchema,
	noteIdParamSchema,
	updateNoteSchema,
} from "@shared/notes";
import { Hono } from "hono";
import { createDb } from "../db/client";
import { errorBody } from "../middleware/errors";
import { type DataEnv, onlyMethods, validated } from "../middleware/validation";
import * as noteService from "../services/notes";

const NOT_FOUND = errorBody("not_found", "Esta nota ya no existe.");

/** `/api/notes` (add-notes design.md D3). */
export const notes = new Hono<DataEnv>()
	.use("/", onlyMethods(["GET", "POST"]))
	.use("/:id", onlyMethods(["GET", "PATCH", "DELETE"]))
	.get("/", validated("query", listNotesQuerySchema), async (c) => {
		const { q } = c.req.valid("query");
		return c.json(await noteService.listNotes(createDb(c.env), q || undefined), 200);
	})
	.post("/", validated("json", createNoteSchema), async (c) => {
		return c.json(await noteService.createNote(createDb(c.env), c.req.valid("json")), 201);
	})
	.get("/:id", validated("param", noteIdParamSchema), async (c) => {
		const note = await noteService.getNote(createDb(c.env), c.req.valid("param").id);
		return note ? c.json(note, 200) : c.json(NOT_FOUND, 404);
	})
	.patch(
		"/:id",
		validated("param", noteIdParamSchema),
		validated("json", updateNoteSchema),
		async (c) => {
			const note = await noteService.updateNote(
				createDb(c.env),
				c.req.valid("param").id,
				c.req.valid("json"),
			);
			return note ? c.json(note, 200) : c.json(NOT_FOUND, 404);
		},
	)
	.delete("/:id", validated("param", noteIdParamSchema), async (c) => {
		const deleted = await noteService.deleteNote(createDb(c.env), c.req.valid("param").id);
		return deleted ? c.body(null, 204) : c.json(NOT_FOUND, 404);
	});
