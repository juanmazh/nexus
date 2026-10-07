import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmptyState } from "./empty-state";
import { Skeleton, SkeletonList } from "./skeleton";

/**
 * The empty state is reached by role, not by CSS class: if the invitation to act
 * cannot be found by a screen reader or by a Playwright check, it does not exist.
 */

afterEach(cleanup);

describe("EmptyState", () => {
	it("shows the title and the invitation as text", () => {
		render(
			<EmptyState
				title="Nada pendiente para hoy"
				description="Añade una tarea abajo y aparecerá en esta lista."
			/>,
		);

		expect(screen.getByRole("heading", { name: "Nada pendiente para hoy" })).toBeInTheDocument();
		expect(
			screen.getByText("Añade una tarea abajo y aparecerá en esta lista."),
		).toBeInTheDocument();
	});

	it("exposes the action by role and runs it", async () => {
		const user = userEvent.setup();
		const onClick = vi.fn();

		render(
			<EmptyState
				title="Sin tareas"
				description="Todavía no hay nada guardado."
				action={
					<button type="button" onClick={onClick}>
						Añadir la primera
					</button>
				}
			/>,
		);

		const action = screen.getByRole("button", { name: "Añadir la primera" });
		await user.click(action);

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("works without an action", () => {
		render(<EmptyState title="Sin notas" description="Todavía no hay nada guardado." />);

		expect(screen.queryByRole("button")).not.toBeInTheDocument();
	});
});

describe("Skeleton", () => {
	it("stays out of the accessibility tree, since it carries no information", () => {
		render(<Skeleton className="h-4 w-32" />);

		const skeleton = document.querySelector("[data-slot='skeleton']");
		expect(skeleton).not.toBeNull();
		expect(skeleton).toHaveAttribute("aria-hidden", "true");
	});

	it("draws as many rows as it is asked for", () => {
		render(<SkeletonList rows={4} />);

		expect(document.querySelectorAll("[data-slot='skeleton']")).toHaveLength(4);
	});
});
