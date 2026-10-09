import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastHost } from "@/components/toast-host";
import { failJson, okJson, withQueryClient } from "../tasks/test-helpers";
import { NotePage } from "./note-page";
import { AUTOSAVE_DELAY_MS } from "./use-autosave";

const api = vi.hoisted(() => ({ read: vi.fn(), patch: vi.fn(), remove: vi.fn() }));

vi.mock("@/lib/api", () => ({
	client: {
		api: { notes: { ":id": { $get: api.read, $patch: api.patch, $delete: api.remove } } },
	},
}));

const ID = "4f0c1f7e-6c1a-4c4f-9c55-3f1b2a0d9e11";

function note(overrides: Record<string, unknown> = {}) {
	return {
		id: ID,
		title: "Compra",
		content: "# Compra\n- pan\n- [leche](https://example.test)",
		pinned: false,
		created_at: 0,
		updated_at: 0,
		...overrides,
	};
}

function renderNote(state?: { edit?: boolean }) {
	const { wrapper: Wrapper } = withQueryClient();
	render(
		<Wrapper>
			<MemoryRouter initialEntries={[{ pathname: `/notes/${ID}`, state }]}>
				<Routes>
					<Route path="/notes" element={<p>Lista de notas</p>} />
					<Route path="/notes/:id" element={<NotePage />} />
				</Routes>
			</MemoryRouter>
			<ToastHost />
		</Wrapper>,
	);
}

const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldAdvanceTime: true });
	api.read.mockResolvedValue(okJson(note()));
	api.patch.mockImplementation(async ({ json }: { json: { content?: string } }) =>
		okJson(note({ ...json, title: "Compra" })),
	);
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	for (const fn of Object.values(api)) {
		fn.mockReset();
	}
});

describe("NotePage", () => {
	it("shows the note with format, its title as the heading and a way back", async () => {
		renderNote();

		expect(await screen.findByRole("heading", { level: 1, name: "Compra" })).toBeInTheDocument();
		// The title line is the heading of the page, not repeated in the body.
		expect(screen.getAllByRole("heading", { name: "Compra" })).toHaveLength(1);
		expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("pan");
		expect(screen.getByRole("link", { name: "leche" })).toHaveAttribute("target", "_blank");
		expect(screen.getByRole("link", { name: /Notas/ })).toHaveAttribute("href", "/notes");
		expect(screen.queryByRole("textbox")).toBeNull();
	});

	it("saves a second after the last keystroke, and says so", async () => {
		const u = user();
		renderNote();
		await u.click(await screen.findByRole("button", { name: "Editar" }));

		await u.type(screen.getByRole("textbox", { name: "Contenido de la nota" }), "\n- huevos");
		expect(api.patch).not.toHaveBeenCalled();
		expect(screen.getByText("Cambios sin guardar")).toBeInTheDocument();

		await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));

		expect(api.patch).toHaveBeenCalledTimes(1);
		expect(api.patch).toHaveBeenCalledWith({
			param: { id: ID },
			json: { content: `${note().content}\n- huevos` },
		});
		expect(await screen.findByText("Guardado")).toBeInTheDocument();
	});

	it("saves right away when going back to the formatted view", async () => {
		const u = user();
		renderNote();
		await u.click(await screen.findByRole("button", { name: "Editar" }));
		await u.type(screen.getByRole("textbox"), " más");

		await u.click(screen.getByRole("button", { name: "Ver" }));

		expect(api.patch).toHaveBeenCalledTimes(1);
		expect(await screen.findByText("Guardado")).toBeInTheDocument();
	});

	it("keeps the text and offers to retry when the save fails", async () => {
		const u = user();
		api.patch.mockResolvedValueOnce(failJson("caída"));
		renderNote({ edit: true });
		const field = await screen.findByRole("textbox");

		await u.type(field, "!");
		await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));

		expect(await screen.findByRole("alert")).toHaveTextContent("No se ha podido guardar");
		expect(field).toHaveValue(`${note().content}!`);
		await u.click(screen.getByRole("button", { name: "Reintentar" }));
		expect(await screen.findByText("Guardado")).toBeInTheDocument();
		expect(api.patch).toHaveBeenCalledTimes(2);
	});

	it("opens in the editor with the cursor at the end when asked to", async () => {
		renderNote({ edit: true });

		const field = await screen.findByRole("textbox");
		expect(field).toHaveFocus();
		expect((field as HTMLTextAreaElement).selectionStart).toBe(note().content.length);
	});

	it("pins the note and says it is pinned", async () => {
		const u = user();
		api.patch.mockResolvedValueOnce(okJson(note({ pinned: true })));
		renderNote();

		await u.click(await screen.findByRole("button", { name: "Fijar" }));

		expect(api.patch).toHaveBeenCalledWith({ param: { id: ID }, json: { pinned: true } });
		expect(await screen.findByRole("button", { name: "Fijada" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});

	it("deletes only after the confirmation and goes back to the list", async () => {
		const u = user();
		api.remove.mockResolvedValue({ ok: true, status: 204, json: async () => null });
		renderNote();

		await u.click(await screen.findByRole("button", { name: "Eliminar" }));
		await u.click(screen.getByRole("button", { name: "Cancelar" }));
		expect(api.remove).not.toHaveBeenCalled();

		await u.click(screen.getByRole("button", { name: "Eliminar" }));
		await u.click(screen.getByRole("button", { name: "Eliminar nota" }));

		expect(await screen.findByText("Lista de notas")).toBeInTheDocument();
		expect(api.remove).toHaveBeenCalledWith({ param: { id: ID } });
		expect(screen.getByText("Nota eliminada")).toBeInTheDocument();
		expect(api.patch).not.toHaveBeenCalled();
	});

	it("deletes a note left empty when leaving it", async () => {
		const u = user();
		api.remove.mockResolvedValue({ ok: true, status: 204, json: async () => null });
		renderNote({ edit: true });

		await u.clear(await screen.findByRole("textbox"));
		await u.click(screen.getByRole("link", { name: /Notas/ }));

		expect(await screen.findByText("Nota vacía eliminada")).toBeInTheDocument();
		expect(api.remove).toHaveBeenCalledWith({ param: { id: ID } });
		expect(api.patch).not.toHaveBeenCalled();
	});

	it("saves what is pending when leaving the note", async () => {
		const u = user();
		renderNote({ edit: true });

		await u.type(await screen.findByRole("textbox"), "?");
		await u.click(screen.getByRole("link", { name: /Notas/ }));

		expect(await screen.findByText("Lista de notas")).toBeInTheDocument();
		expect(api.patch).toHaveBeenCalledWith({
			param: { id: ID },
			json: { content: `${note().content}?` },
		});
	});

	it("says the note does not exist for a 404", async () => {
		api.read.mockResolvedValue(failJson("Esta nota ya no existe.", 404));
		renderNote();

		expect(await screen.findByText("Esta nota no existe")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Volver a Notas" })).toHaveAttribute("href", "/notes");
	});
});
