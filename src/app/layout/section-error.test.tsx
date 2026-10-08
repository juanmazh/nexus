import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SectionError } from "./section-error";

/**
 * The same shape as `router.tsx`: a layout route, then a pathless route with
 * the error element around the sections. A section that throws must leave the
 * layout on screen.
 */

function Broken(): never {
	throw new Error("Failed to fetch dynamically imported module");
}

function renderBrokenSection() {
	const router = createMemoryRouter(
		[
			{
				element: (
					<>
						<nav aria-label="Secciones">Hoy · Tareas</nav>
						<Outlet />
					</>
				),
				children: [
					{ errorElement: <SectionError />, children: [{ path: "/", element: <Broken /> }] },
				],
			},
		],
		{ initialEntries: ["/"] },
	);
	render(<RouterProvider router={router} />);
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("SectionError", () => {
	it("explains the failure inside the shell and offers to reload", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const reload = vi.fn();
		vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload });
		renderBrokenSection();

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("No se ha podido cargar esta sección");
		expect(screen.getByRole("navigation", { name: "Secciones" })).toBeInTheDocument();

		const button = screen.getByRole("button", { name: "Recargar" });
		expect(button.className).toContain("min-h-11");
		await userEvent.setup().click(button);
		expect(reload).toHaveBeenCalledTimes(1);
	});
});
