import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/app/navigation";
import { TodayPage } from "./today-page";

/**
 * jsdom has no layout, so "no horizontal scroll at 360 px" cannot be measured
 * here; the Playwright suite measures it for real (docs/DESIGN.md §6). What this
 * test does check is the rule that would cause the scroll: nothing fixes a width
 * in pixels, and the containers holding text are allowed to shrink.
 */

afterEach(cleanup);

function renderToday() {
	return render(
		<MemoryRouter>
			<TodayPage />
		</MemoryRouter>,
	);
}

describe("TodayPage", () => {
	it("shows the title of the section as its h1", () => {
		renderToday();

		expect(screen.getByRole("heading", { level: 1, name: "Hoy" })).toBeInTheDocument();
	});

	it("shows the date in Madrid, as the rest of the app will", () => {
		renderToday();

		// The weekday comes out localised by Intl; asserting the shape keeps the
		// test from breaking on the day of the week it runs.
		expect(screen.getByText(/\d{1,2} de \w+/)).toBeInTheDocument();
	});

	it("shows an empty state that explains what will live here and invites the first item", () => {
		renderToday();

		expect(screen.getByRole("heading", { name: "Nada pendiente para hoy" })).toBeInTheDocument();
		expect(screen.getByText(/Añade lo primero con la barra de abajo/)).toBeInTheDocument();
	});

	it("marks 'now' with a marker that does not rely on colour alone", () => {
		renderToday();

		const marker = document.querySelector("[data-slot='now-marker']");
		expect(marker).not.toBeNull();
		expect(screen.getByText("Ahora")).toBeInTheDocument();
		expect(marker?.textContent).toMatch(/\d{1,2}:\d{2}/);
	});

	it("cannot force a sideways scroll at 360 px", () => {
		renderToday();

		// jsdom has no layout, so the measured version of this check is
		// Playwright's (docs/DESIGN.md §6). What can be checked here is the cause:
		// nothing fixes a width in pixels, and the containers that hold text are
		// allowed to shrink instead of pushing the page wide.
		for (const element of document.querySelectorAll<HTMLElement>("[style]")) {
			expect(element.style.width).toBe("");
			expect(element.style.minWidth).toBe("");
		}

		const emptyStateHeading = screen.getByRole("heading", { name: "Nada pendiente para hoy" });
		expect(emptyStateHeading.parentElement?.className).toContain("min-w-0");
	});

	it("names the section the same way the navigation does", () => {
		renderToday();

		const hoy = NAV_ITEMS.find((item) => item.to === "/");
		expect(hoy?.label).toBe(screen.getByRole("heading", { level: 1 }).textContent);
	});
});
