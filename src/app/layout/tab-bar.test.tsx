import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/app/navigation";
import { Sidebar } from "./sidebar";
import { TabBar } from "./tab-bar";

/**
 * Both navigations walk `NAV_ITEMS`, so these tests cover what could go wrong in
 * each of them separately: a section missing, the active section not marked for
 * assistive technology, and a target under 44 px.
 *
 * Which of the two exists at a given width is decided by `AppShell`, so that
 * swap is asserted in `app-shell.test.tsx` against the real shell.
 */

afterEach(() => {
	document.body.innerHTML = "";
});

function renderAt(path: string, element: React.ReactElement) {
	return render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);
}

function expectEverySection(element: HTMLElement) {
	for (const item of NAV_ITEMS) {
		expect(element.querySelector(`a[href="${item.to}"]`), `${item.label} falta`).not.toBeNull();
	}
}

describe("TabBar", () => {
	it("shows the four sections", () => {
		renderAt("/", <TabBar />);

		const nav = screen.getByRole("navigation", { name: "Secciones" });
		expectEverySection(nav);
		for (const item of NAV_ITEMS) {
			expect(screen.getByRole("link", { name: item.label })).toBeInTheDocument();
		}
	});

	it("gives every tab a 44 px minimum target", () => {
		renderAt("/", <TabBar />);

		for (const item of NAV_ITEMS) {
			expect(screen.getByRole("link", { name: item.label }).className).toContain("min-h-11");
		}
	});

	it("marks the active section with aria-current, not only with colour", () => {
		renderAt("/tasks", <TabBar />);

		expect(screen.getByRole("link", { name: "Tareas" })).toHaveAttribute("aria-current", "page");
		expect(screen.getByRole("link", { name: "Hoy" })).not.toHaveAttribute("aria-current");
	});

	it("marks Hoy as active on the root", () => {
		renderAt("/", <TabBar />);

		expect(screen.getByRole("link", { name: "Hoy" })).toHaveAttribute("aria-current", "page");
		expect(screen.getByRole("link", { name: "Notas" })).not.toHaveAttribute("aria-current");
	});

	it("respects the bottom safe area", () => {
		renderAt("/", <TabBar />);

		expect(document.querySelector("[data-slot='tab-bar']")?.innerHTML).toContain(
			"env(safe-area-inset-bottom)",
		);
	});
});

describe("Sidebar", () => {
	it("shows the same four sections as the tab bar", () => {
		renderAt("/", <Sidebar />);

		const nav = screen.getByRole("navigation", { name: "Secciones" });
		expectEverySection(nav);
		expect(screen.queryByRole("link", { name: "Hoy" })).not.toBeNull();
	});

	it("marks the active section with aria-current", () => {
		renderAt("/more", <Sidebar />);

		expect(screen.getByRole("link", { name: "Más" })).toHaveAttribute("aria-current", "page");
		expect(screen.getByRole("link", { name: "Hoy" })).not.toHaveAttribute("aria-current");
	});

	it("gives every entry a 44 px minimum target", () => {
		renderAt("/", <Sidebar />);

		for (const item of NAV_ITEMS) {
			expect(screen.getByRole("link", { name: item.label }).className).toContain("min-h-11");
		}
	});

	it("respects the top safe area", () => {
		renderAt("/", <Sidebar />);

		expect(document.querySelector("[data-slot='sidebar']")?.innerHTML).toContain(
			"env(safe-area-inset-top)",
		);
	});
});
