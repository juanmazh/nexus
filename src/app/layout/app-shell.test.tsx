import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/components/toast-host";
import { DESKTOP_QUERY } from "@/lib/use-media-query";
import { AppShell } from "./app-shell";

/**
 * The shell's whole job is geometry, and jsdom has no layout engine, so what can
 * be asserted here is the structure that produces it: the fixed-height root, the
 * scroll container, one navigation per viewport range, a single toast host, and
 * the scroll reset on a route change. The measured geometry is the Playwright
 * suite's job (docs/DESIGN.md §6).
 */

const originalMatchMedia = window.matchMedia;

let isDesktop = false;
let listeners: (() => void)[] = [];

/** jsdom implements neither `scrollTo` nor any layout, so it is recorded. */
const scrollToMock = vi.fn();

function setViewport(next: boolean) {
	isDesktop = next;
	act(() => {
		for (const listener of listeners) {
			listener();
		}
	});
}

beforeEach(() => {
	isDesktop = false;
	listeners = [];
	scrollToMock.mockClear();
	Element.prototype.scrollTo = scrollToMock;
	window.matchMedia = ((query: string) => {
		const media = {
			get matches() {
				return query === DESKTOP_QUERY && isDesktop;
			},
			media: query,
			addEventListener: (_: string, listener: () => void) => {
				listeners.push(listener);
			},
			removeEventListener: (_: string, listener: () => void) => {
				listeners = listeners.filter((registered) => registered !== listener);
			},
		};
		return media as unknown as MediaQueryList;
	}) as typeof window.matchMedia;
});

afterEach(() => {
	cleanup();
	window.matchMedia = originalMatchMedia;
});

function renderShell(path = "/") {
	return render(
		<MemoryRouter initialEntries={[path]}>
			<Routes>
				<Route element={<AppShell />}>
					<Route path="/" element={<p>Vista de Hoy</p>} />
					<Route path="/tasks" element={<p>Vista de Tareas</p>} />
					<Route path="/notes" element={<p>Vista de Notas</p>} />
					<Route path="/more" element={<p>Vista de Más</p>} />
					<Route path="*" element={<p>Página no encontrada</p>} />
				</Route>
			</Routes>
		</MemoryRouter>,
	);
}

function slot(name: string): Element | null {
	return document.querySelector(`[data-slot="${name}"]`);
}

describe("AppShell", () => {
	it("renders the page inside the shell", () => {
		renderShell("/");

		expect(screen.getByText("Vista de Hoy")).toBeInTheDocument();
		expect(slot("app-content")).not.toBeNull();
		expect(slot("tab-bar")).not.toBeNull();
	});

	it("never lets the document scroll: fixed height root, scroll inside", () => {
		renderShell();

		const root = slot("app-content")?.parentElement?.parentElement;
		expect(root?.className).toContain("h-dvh");
		expect(root?.className).toContain("overflow-hidden");

		const content = slot("app-content");
		expect(content?.className).toContain("flex-1");
		expect(content?.className).toContain("min-h-0");
		expect(content?.className).toContain("overflow-y-auto");
	});

	it("keeps the bars out of the flow so they cannot be scrolled away", () => {
		renderShell();

		expect(slot("app-content")?.className).toContain("flex-1");
		expect(slot("tab-bar")?.className).toContain("shrink-0");
		expect(slot("capture-bar")?.className).toContain("shrink-0");
	});

	it("shows the tab bar at 360 px and no sidebar", () => {
		renderShell();

		expect(slot("tab-bar")).not.toBeNull();
		expect(slot("sidebar")).toBeNull();
		expect(screen.getByRole("navigation", { name: "Secciones" })).toBeInTheDocument();
	});

	it("shows the sidebar at 1280 px and no tab bar", () => {
		renderShell();
		setViewport(true);

		expect(slot("sidebar")).not.toBeNull();
		expect(slot("tab-bar")).toBeNull();
	});

	it("swaps one navigation for the other, never showing both", () => {
		renderShell();
		expect(slot("tab-bar")).not.toBeNull();

		setViewport(true);
		expect(slot("tab-bar")).toBeNull();
		expect(slot("sidebar")).not.toBeNull();

		setViewport(false);
		expect(slot("sidebar")).toBeNull();
		expect(slot("tab-bar")).not.toBeNull();
	});

	it("moves the capture bar from the bottom to the header on desktop", () => {
		renderShell();
		expect(slot("capture-bar")?.tagName).toBe("FORM");

		setViewport(true);
		expect(slot("capture-bar")?.closest("[data-slot='app-header']")).not.toBeNull();
	});

	it("mounts exactly one toast host, whatever the number of notices", async () => {
		renderShell();

		act(() => {
			toast.add({ title: "Primero", timeout: 60_000 });
			toast.add({ title: "Segundo", timeout: 60_000 });
		});

		expect(await screen.findByText("Primero")).toBeInTheDocument();
		expect(screen.getByText("Segundo")).toBeInTheDocument();
		expect(document.querySelectorAll("[data-slot='toast-viewport']")).toHaveLength(1);
	});

	it("brings the content back to the top when the section changes", async () => {
		const user = userEvent.setup();
		renderShell("/tasks");

		// The section the person lands on already starts at the top.
		expect(scrollToMock).toHaveBeenCalledWith({ top: 0 });

		scrollToMock.mockClear();
		await user.click(screen.getByRole("link", { name: "Notas" }));

		expect(screen.getByText("Vista de Notas")).toBeInTheDocument();
		expect(scrollToMock).toHaveBeenCalledWith({ top: 0 });
	});
});

describe("AppNavigation swap", () => {
	it("never has both navigations in the DOM at once", () => {
		renderShell();

		expect(document.querySelectorAll("[data-slot='tab-bar'], [data-slot='sidebar']")).toHaveLength(
			1,
		);

		setViewport(true);

		expect(document.querySelectorAll("[data-slot='tab-bar'], [data-slot='sidebar']")).toHaveLength(
			1,
		);
		expect(slot("sidebar")).not.toBeNull();
	});
});
