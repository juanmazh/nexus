import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { failJson, okJson, withQueryClient } from "@/features/tasks/test-helpers";
import { AppShell } from "./app-shell";

/**
 * In the list of Notas the capture bar writes notes and opens the new one in
 * the editor; inside a note there is no bar (add-notes design.md D4, D7).
 */

const api = vi.hoisted(() => ({ createNote: vi.fn(), createTask: vi.fn() }));

vi.mock("@/lib/api", () => ({
	client: { api: { notes: { $post: api.createNote }, tasks: { $post: api.createTask } } },
}));

function NoteRoute() {
	const location = useLocation();
	return (
		<p>
			Nota {location.pathname} {JSON.stringify(location.state)}
		</p>
	);
}

function renderShell(path: string) {
	const { wrapper: Wrapper } = withQueryClient();
	render(
		<Wrapper>
			<MemoryRouter initialEntries={[path]}>
				<Routes>
					<Route element={<AppShell />}>
						<Route path="/" element={<p>Hoy</p>} />
						<Route path="/notes" element={<p>Lista de notas</p>} />
						<Route path="/notes/:id" element={<NoteRoute />} />
					</Route>
				</Routes>
			</MemoryRouter>
		</Wrapper>,
	);
}

beforeEach(() => {
	Element.prototype.scrollTo = vi.fn();
});

afterEach(() => {
	cleanup();
	api.createNote.mockReset();
	api.createTask.mockReset();
});

describe("the capture bar in Notas", () => {
	it("creates a note and opens it in the editor", async () => {
		const user = userEvent.setup();
		api.createNote.mockResolvedValue(okJson({ id: "nota-1", content: "Ideas para el viaje" }, 201));
		renderShell("/notes");

		const field = screen.getByRole("textbox", { name: "Añadir algo" });
		expect(field).toHaveAttribute("placeholder", "Añade una nota…");
		await user.type(field, "Ideas para el viaje");
		await user.click(screen.getByRole("button", { name: "Guardar" }));

		expect(await screen.findByText('Nota /notes/nota-1 {"edit":true}')).toBeInTheDocument();
		expect(api.createNote).toHaveBeenCalledWith({ json: { content: "Ideas para el viaje" } });
		expect(api.createTask).not.toHaveBeenCalled();
	});

	it("gives the text back and opens nothing when the API fails", async () => {
		const user = userEvent.setup();
		api.createNote.mockResolvedValue(failJson("caída"));
		renderShell("/notes");

		const field = screen.getByRole("textbox", { name: "Añadir algo" });
		await user.type(field, "Algo");
		await user.click(screen.getByRole("button", { name: "Guardar" }));

		await vi.waitFor(() => expect(field).toHaveValue("Algo"));
		expect(screen.getByText("Lista de notas")).toBeInTheDocument();
	});

	it("is not shown inside a note, and keeps creating tasks elsewhere", () => {
		renderShell("/notes/nota-1");
		expect(screen.queryByRole("textbox", { name: "Añadir algo" })).toBeNull();
		cleanup();

		renderShell("/");
		expect(screen.getByRole("textbox", { name: "Añadir algo" })).toHaveAttribute(
			"placeholder",
			"Añade una tarea…",
		);
	});
});
