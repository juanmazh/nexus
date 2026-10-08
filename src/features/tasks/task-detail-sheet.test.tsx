import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskDetailSheet } from "./task-detail-sheet";
import { makeTask, okJson, withQueryClient } from "./test-helpers";

const api = vi.hoisted(() => ({ $patch: vi.fn(), $delete: vi.fn(), reminders: vi.fn() }));

vi.mock("@/lib/api", () => ({
	client: {
		api: {
			tasks: {
				":id": {
					$patch: api.$patch,
					$delete: api.$delete,
					// The reminders section of the detail; its own tests are in
					// features/reminders. Here it only has to load quietly.
					reminders: { $get: api.reminders },
				},
			},
		},
	},
}));

beforeEach(() => {
	api.reminders.mockResolvedValue(okJson([]));
});

afterEach(() => {
	cleanup();
	api.$patch.mockReset();
	api.$delete.mockReset();
	api.reminders.mockReset();
});

function renderSheet(task = makeTask({ title: "Original", notes: "Notas" })) {
	const onClose = vi.fn();
	const { wrapper } = withQueryClient();
	render(<TaskDetailSheet task={task} onClose={onClose} />, { wrapper });
	return { task, onClose };
}

describe("TaskDetailSheet", () => {
	it("sends only the fields that changed", async () => {
		const user = userEvent.setup();
		const { task, onClose } = renderSheet();
		api.$patch.mockResolvedValue(okJson({ ...task, title: "Nuevo" }));

		await user.clear(screen.getByLabelText("Título"));
		await user.type(screen.getByLabelText("Título"), "Nuevo");
		await user.click(screen.getByRole("button", { name: "Guardar tarea" }));

		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(api.$patch).toHaveBeenCalledWith({ param: { id: task.id }, json: { title: "Nuevo" } });
	});

	it("closes without a request when nothing changed", async () => {
		const user = userEvent.setup();
		const { onClose } = renderSheet();

		await user.click(screen.getByRole("button", { name: "Guardar tarea" }));

		expect(onClose).toHaveBeenCalled();
		expect(api.$patch).not.toHaveBeenCalled();
	});

	it("shows the schema's message next to the field and sends nothing", async () => {
		const user = userEvent.setup();
		renderSheet();

		await user.clear(screen.getByLabelText("Título"));
		await user.click(screen.getByRole("button", { name: "Guardar tarea" }));

		const field = screen.getByLabelText("Título");
		expect(field).toHaveAttribute("aria-invalid", "true");
		expect(field).toHaveAccessibleDescription("Escribe un título para la tarea.");
		expect(api.$patch).not.toHaveBeenCalled();
	});

	it("asks before deleting, and cancelling keeps the task", async () => {
		const user = userEvent.setup();
		renderSheet();

		await user.click(screen.getByRole("button", { name: "Borrar" }));
		expect(screen.getByText("¿Borrar «Original»? No se puede deshacer.")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Cancelar" }));

		expect(api.$delete).not.toHaveBeenCalled();
		expect(screen.getByLabelText("Título")).toBeInTheDocument();
	});

	it("deletes after the explicit confirmation", async () => {
		const user = userEvent.setup();
		const { task } = renderSheet();
		api.$delete.mockResolvedValue({ ok: true, status: 204, json: async () => null });

		await user.click(screen.getByRole("button", { name: "Borrar" }));
		await user.click(screen.getByRole("button", { name: "Borrar tarea" }));

		await waitFor(() => expect(api.$delete).toHaveBeenCalledWith({ param: { id: task.id } }));
	});

	it("uses a native date input for the due date", () => {
		renderSheet(makeTask({ title: "Con fecha", due_at: Date.UTC(2026, 9, 9, 22) }));

		const date = screen.getByLabelText("Vence");
		expect(date).toHaveAttribute("type", "date");
		expect(date).toHaveValue("2026-10-10");
	});
});
