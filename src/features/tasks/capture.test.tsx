import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/app/layout/app-shell";
import { TasksPage } from "./tasks-page";
import { failJson, makeTask, okJson, withQueryClient } from "./test-helpers";

/**
 * The capture bar lives in the shell and the list in the page, so the only
 * honest test of "capture a task" mounts both (design.md D10). The API is a stub
 * whose answers the test releases by hand: that is what lets it look at the list
 * *before* the API answers, which is the whole point of the optimistic update.
 */

const api = vi.hoisted(() => ({
	$get: vi.fn(),
	$post: vi.fn(),
	$patch: vi.fn(),
	$delete: vi.fn(),
	reminders: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
	client: {
		api: {
			tasks: Object.assign(
				{ $get: api.$get, $post: api.$post },
				{
					":id": {
						$patch: api.$patch,
						$delete: api.$delete,
						reminders: { $get: api.reminders },
					},
				},
			),
		},
	},
}));

/** A promise the test resolves when it decides the API has answered. */
function deferred<T>() {
	let resolve: (value: T) => void = () => {};
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

function renderAt(path: string) {
	const { wrapper: Wrapper } = withQueryClient();
	return render(
		<Wrapper>
			<MemoryRouter initialEntries={[path]}>
				<Routes>
					<Route element={<AppShell />}>
						<Route path="/" element={<p>Vista de Hoy</p>} />
						<Route path="/tasks" element={<TasksPage />} />
					</Route>
				</Routes>
			</MemoryRouter>
		</Wrapper>,
	);
}

const renderTasks = () => renderAt("/tasks");

async function capture(text: string) {
	const user = userEvent.setup();
	const input = screen.getByRole("textbox", { name: "Añadir algo" });
	await user.type(input, text);
	await user.click(screen.getByRole("button", { name: "Guardar" }));
	return { user, input };
}

beforeEach(() => {
	Element.prototype.scrollTo = vi.fn();
	api.$get.mockResolvedValue(okJson([]));
	api.reminders.mockResolvedValue(okJson([]));
});

afterEach(() => {
	cleanup();
	for (const fn of Object.values(api)) {
		fn.mockReset();
	}
});

describe("Capturing a task from the bar", () => {
	it("shows the task before the API answers, and the real one after", async () => {
		renderTasks();
		await screen.findByText("Sin tareas");

		const answer = deferred<ReturnType<typeof okJson>>();
		api.$post.mockReturnValue(answer.promise);

		const { input } = await capture("Comprar pan");

		expect(input).toHaveValue("");
		expect(await screen.findByText("Comprar pan")).toBeInTheDocument();
		expect(api.$post).toHaveBeenCalledWith({ json: { title: "Comprar pan" } });

		// While unsaved, the row cannot be acted on: its id is not the API's yet.
		expect(screen.getByRole("button", { name: "Completar Comprar pan" })).toBeDisabled();

		const saved = makeTask({ title: "Comprar pan" });
		api.$get.mockResolvedValue(okJson([saved]));
		answer.resolve(okJson(saved, 201));

		// Once the API answers, the detail of the real task opens on top
		// (open-detail-on-capture).
		const dialog = await screen.findByRole("dialog", { name: "Detalle de la tarea" });
		expect(within(dialog).getByLabelText("Título")).toHaveValue("Comprar pan");

		await userEvent.setup().keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "Detalle de la tarea" })).toBeNull(),
		);
		expect(screen.getByRole("button", { name: "Completar Comprar pan" })).toBeEnabled();
	});

	it("opens the detail over another section, without leaving it", async () => {
		const saved = makeTask({ title: "Llamar al taller" });
		api.$post.mockResolvedValue(okJson(saved, 201));
		renderAt("/");

		await capture("Llamar al taller");

		const dialog = await screen.findByRole("dialog", { name: "Detalle de la tarea" });
		expect(within(dialog).getByLabelText("Título")).toHaveValue("Llamar al taller");
		expect(screen.getByText("Vista de Hoy")).toBeInTheDocument();
	});

	it("takes the task away, says so and gives the text back when the API fails", async () => {
		renderTasks();
		await screen.findByText("Sin tareas");

		const answer = deferred<ReturnType<typeof failJson>>();
		api.$post.mockReturnValue(answer.promise);

		const { input } = await capture("Comprar pan");
		expect(await screen.findByText("Comprar pan")).toBeInTheDocument();

		answer.resolve(failJson("Algo ha fallado"));

		expect(await screen.findByText("No se ha podido guardar la tarea")).toBeInTheDocument();
		await waitFor(() => expect(input).toHaveValue("Comprar pan"));
		expect(screen.queryByRole("dialog", { name: "Detalle de la tarea" })).toBeNull();
		const list = screen.queryByRole("list");
		expect(list === null || within(list).queryByText("Comprar pan") === null).toBe(true);
	});

	it("sends nothing and says nothing for a blank capture", async () => {
		renderTasks();
		await screen.findByText("Sin tareas");

		await capture("    ");

		expect(api.$post).not.toHaveBeenCalled();
		expect(screen.queryByRole("status", { name: /guardar/i })).toBeNull();
		expect(screen.getByText("Sin tareas")).toBeInTheDocument();
	});
});
