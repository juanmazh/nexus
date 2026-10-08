import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastHost } from "@/components/toast-host";
import { failJson, makeTask, okJson, withQueryClient } from "../tasks/test-helpers";
import { RemindersSection } from "./reminders-section";

/**
 * The reminders of the detail with the RPC client mocked, like the task tests.
 * The clock is fixed at Wednesday 2026-10-07, 16:00 in Madrid, so the
 * shortcuts on offer are known.
 */

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), cancel: vi.fn() }));

vi.mock("@/lib/api", () => ({
	client: {
		api: {
			tasks: { ":id": { reminders: { $get: api.list, $post: api.create } } },
			reminders: { ":id": { $delete: api.cancel } },
		},
	},
}));

const NOW = Date.UTC(2026, 9, 7, 14, 0);

function reminder(remindAt: number, id: string = crypto.randomUUID()) {
	return {
		id,
		task_id: "t",
		remind_at: remindAt,
		channel: "telegram",
		status: "pending",
		attempts: 0,
		last_error: null,
		sent_at: null,
		created_at: NOW,
	};
}

function renderSection(task = makeTask({ title: "Llamar al taller" })) {
	const { wrapper } = withQueryClient();
	render(
		<>
			<RemindersSection task={task} />
			<ToastHost />
		</>,
		{ wrapper },
	);
	return task;
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
	api.list.mockResolvedValue(okJson([]));
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	for (const fn of Object.values(api)) {
		fn.mockReset();
	}
});

describe("RemindersSection", () => {
	it("offers the shortcuts of the afternoon as 44 px buttons and says how precise it is", async () => {
		renderSection();

		const group = screen.getByRole("group", { name: "Atajos de aviso" });
		const buttons = within(group).getAllByRole("button");
		expect(buttons.map((button) => button.textContent)).toEqual([
			"En 1 h",
			"Esta tarde 18:00",
			"Mañana 9:00",
		]);
		for (const button of buttons) {
			expect(button.className).toContain("min-h-11");
		}
		expect(screen.getByText(/en los 5 minutos siguientes/)).toBeInTheDocument();
		expect(await screen.findByText("Sin avisos.")).toBeInTheDocument();
	});

	it("adds the due day when the task has a date ahead", () => {
		renderSection(makeTask({ due_at: Date.UTC(2026, 9, 9, 22, 0) }));

		expect(screen.getByRole("button", { name: "El día que vence 9:00" })).toBeInTheDocument();
	});

	it("creates a reminder with a shortcut and shows it in the list", async () => {
		const user = userEvent.setup();
		const created = reminder(Date.UTC(2026, 9, 8, 7, 0));
		api.create.mockResolvedValue(okJson(created, 201));
		renderSection();
		await screen.findByText("Sin avisos.");
		api.list.mockResolvedValue(okJson([created]));

		await user.click(screen.getByRole("button", { name: "Mañana 9:00" }));

		expect(api.create).toHaveBeenCalledWith({
			param: { id: expect.any(String) },
			json: { remind_at: "2026-10-08T09:00" },
		});
		const list = await screen.findByRole("list", { name: "Avisos pendientes" });
		expect(within(list).getByText("jue 8 oct, 9:00")).toBeInTheDocument();
		expect(await screen.findByText("Aviso añadido")).toBeInTheDocument();
	});

	it("shows the API's rejection next to the time field and adds nothing", async () => {
		const user = userEvent.setup();
		api.create.mockResolvedValue(
			failJson("Esa hora no existe ese día por el cambio de hora.", 400),
		);
		renderSection();

		const field = screen.getByLabelText("Otra hora");
		await user.type(field, "2027-03-28T02:30");
		await user.click(screen.getByRole("button", { name: "Añadir aviso" }));

		const message = await screen.findByText("Esa hora no existe ese día por el cambio de hora.");
		expect(field).toHaveAttribute("aria-invalid", "true");
		expect(field).toHaveAttribute("aria-describedby", message.id);
	});

	it("reports a refused shortcut on its own, without marking the time field", async () => {
		const user = userEvent.setup();
		api.create.mockResolvedValue(
			failJson("Esta tarea ya tiene 10 avisos pendientes, que es el máximo.", 409),
		);
		renderSection();

		await user.click(screen.getByRole("button", { name: "Mañana 9:00" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Esta tarea ya tiene 10 avisos pendientes, que es el máximo.",
		);
		expect(screen.getByLabelText("Otra hora")).not.toHaveAttribute("aria-invalid");
	});

	it("asks for a time instead of sending an empty one", async () => {
		const user = userEvent.setup();
		renderSection();

		await user.click(screen.getByRole("button", { name: "Añadir aviso" }));

		expect(screen.getByText("Elige la fecha y la hora del aviso.")).toBeInTheDocument();
		expect(api.create).not.toHaveBeenCalled();
	});

	it("does not let the native picker go back in time", () => {
		renderSection();

		expect(screen.getByLabelText("Otra hora")).toHaveAttribute("min", "2026-10-07T16:00");
	});

	it("asks before cancelling, and keeping it sends nothing", async () => {
		const user = userEvent.setup();
		api.list.mockResolvedValue(okJson([reminder(Date.UTC(2026, 9, 7, 16, 0))]));
		renderSection();

		await user.click(
			await screen.findByRole("button", { name: "Cancelar el aviso de hoy a las 18:00" }),
		);
		expect(screen.getByText("¿Cancelar el aviso de hoy a las 18:00?")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Mantener" }));

		expect(api.cancel).not.toHaveBeenCalled();
		expect(screen.getByText("Hoy, 18:00")).toBeInTheDocument();
	});

	it("cancels after the confirmation and says so", async () => {
		const user = userEvent.setup();
		const pending = reminder(Date.UTC(2026, 9, 9, 7, 0), "aviso-1");
		api.list.mockResolvedValue(okJson([pending]));
		api.cancel.mockResolvedValue({ ok: true, status: 204, json: async () => null });
		renderSection();

		await user.click(
			await screen.findByRole("button", { name: "Cancelar el aviso del vie 9 oct a las 9:00" }),
		);
		api.list.mockResolvedValue(okJson([]));
		await user.click(screen.getByRole("button", { name: "Cancelar aviso" }));

		expect(api.cancel).toHaveBeenCalledWith({ param: { id: "aviso-1" } });
		expect(await screen.findByText("Recordatorio cancelado")).toBeInTheDocument();
		await waitFor(() => expect(screen.getByText("Sin avisos.")).toBeInTheDocument());
	});

	it("offers nothing and asks for nothing on a completed task", () => {
		renderSection(makeTask({ status: "done", completed_at: NOW }));

		expect(screen.queryByRole("group", { name: "Atajos de aviso" })).toBeNull();
		expect(screen.queryByLabelText("Otra hora")).toBeNull();
		expect(screen.getByText(/ya no tiene avisos pendientes/)).toBeInTheDocument();
		expect(api.list).not.toHaveBeenCalled();
	});

	it("shows an error with a way to retry when the list cannot be read", async () => {
		const user = userEvent.setup();
		api.list.mockResolvedValueOnce(failJson("caída")).mockResolvedValueOnce(okJson([]));
		renderSection();

		await user.click(await screen.findByRole("button", { name: "Reintentar" }));

		expect(await screen.findByText("Sin avisos.")).toBeInTheDocument();
	});
});
