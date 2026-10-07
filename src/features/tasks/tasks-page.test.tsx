import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TasksPage } from "./tasks-page";
import { failJson, makeTask, okJson, withQueryClient } from "./test-helpers";

const api = vi.hoisted(() => ({
	$get: vi.fn(),
	$post: vi.fn(),
	$patch: vi.fn(),
	$delete: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
	client: {
		api: {
			tasks: Object.assign(
				{ $get: api.$get, $post: api.$post },
				{
					":id": { $patch: api.$patch, $delete: api.$delete },
				},
			),
		},
	},
}));

/** Lists by the `status` query, like the API does. */
function serve(todo: unknown[], done: unknown[] = []) {
	api.$get.mockImplementation(async ({ query }: { query: { status: string } }) =>
		okJson(query.status === "done" ? done : todo),
	);
}

function renderPage() {
	const { wrapper } = withQueryClient();
	return render(<TasksPage />, { wrapper });
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(Date.UTC(2026, 9, 7, 16, 0));
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	for (const fn of Object.values(api)) {
		fn.mockReset();
	}
});

describe("TasksPage", () => {
	it("shows a skeleton while the list loads", () => {
		api.$get.mockReturnValue(new Promise(() => {}));

		renderPage();

		expect(screen.getByText("Cargando las tareas…")).toBeInTheDocument();
	});

	it("shows an error with a way to retry", async () => {
		api.$get.mockResolvedValue(failJson("caída"));

		renderPage();

		expect(await screen.findByText("No se han podido cargar las tareas.")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
	});

	it("shows the empty state only when there is nothing at all", async () => {
		serve([]);

		renderPage();

		expect(await screen.findByText("Sin tareas")).toBeInTheDocument();
		expect(screen.getByText("Nada pendiente")).toBeInTheDocument();
	});

	it("groups the pending tasks into sections, in order", async () => {
		const today = Date.UTC(2026, 9, 6, 22, 0);
		serve([
			makeTask({ title: "Vencida", due_at: today - 86_400_000 }),
			makeTask({ title: "De hoy", due_at: today }),
			makeTask({ title: "Más adelante", due_at: today + 3 * 86_400_000 }),
			makeTask({ title: "Cuando sea" }),
		]);

		renderPage();

		const headings = await screen.findAllByRole("heading", { level: 2 });
		expect(headings.map((heading) => heading.textContent)).toEqual([
			"Vencidas",
			"Hoy",
			"Próximas",
			"Sin fecha",
		]);
		expect(screen.getByText("4 pendientes")).toBeInTheDocument();
	});

	it("keeps the completed tasks behind Hechas (N) until it is pressed", async () => {
		serve(
			[makeTask({ title: "Pendiente" })],
			[makeTask({ title: "Ya hecha", status: "done", completed_at: 1 })],
		);
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

		renderPage();

		const toggle = await screen.findByRole("button", { name: "Hechas (1)" });
		expect(screen.queryByText("Ya hecha")).not.toBeInTheDocument();
		expect(toggle).toHaveAttribute("aria-pressed", "false");

		await user.click(toggle);

		expect(screen.getByText("Ya hecha")).toBeInTheDocument();
		expect(toggle).toHaveAttribute("aria-pressed", "true");
	});

	it("does not show the toggle when nothing is completed", async () => {
		serve([makeTask({ title: "Pendiente" })]);

		renderPage();

		await screen.findByText("Pendiente");
		expect(screen.queryByRole("button", { name: /Hechas/ })).not.toBeInTheDocument();
	});

	it("completes a task at once and puts it back if the API fails", async () => {
		const task = makeTask({ title: "Llamar" });
		serve([task]);
		api.$patch.mockResolvedValue(failJson("no"));
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

		renderPage();

		await user.click(await screen.findByRole("button", { name: "Completar Llamar" }));

		expect(api.$patch).toHaveBeenCalledWith({ param: { id: task.id }, json: { status: "done" } });
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Completar Llamar" })).toBeInTheDocument(),
		);
	});

	it("opens the detail of a task from its row", async () => {
		serve([makeTask({ title: "Revisar la factura" })]);
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

		renderPage();

		await user.click(await screen.findByRole("button", { name: /^Revisar la factura/ }));

		const dialog = await screen.findByRole("dialog");
		expect(within(dialog).getByLabelText("Título")).toHaveValue("Revisar la factura");
	});
});
