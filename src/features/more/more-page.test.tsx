import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/app/layout/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { MorePage } from "./more-page";

/**
 * The free plan pays for 100.000 Worker invocations a day and the project is
 * built not to spend them, so the most important assertion in this file is the
 * negative one: opening any other section must not call `/api/me`.
 */

const { meGet, healthGet } = vi.hoisted(() => ({ meGet: vi.fn(), healthGet: vi.fn() }));

vi.mock("@/lib/api", () => ({
	client: { api: { me: { $get: meGet }, health: { $get: healthGet } } },
}));

function meResponse() {
	return { json: async () => ({ user: { email: "owner@nexus.test" } }) };
}

function okResponse() {
	return { json: async () => ({ status: "ok" }) };
}

function Wrapper({ children }: { children: ReactNode }) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});

	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider>{children}</ThemeProvider>
		</QueryClientProvider>
	);
}

function renderPage() {
	return render(<MorePage />, { wrapper: Wrapper });
}

afterEach(() => {
	cleanup();
	meGet.mockReset();
	healthGet.mockReset();
});

beforeEach(() => {
	// jsdom implements neither `scrollTo` nor any layout.
	Element.prototype.scrollTo = vi.fn();
});

describe("MorePage", () => {
	it("shows the session's loading state while GET /api/me is in flight", () => {
		meGet.mockReturnValue(new Promise(() => {}));
		healthGet.mockReturnValue(new Promise(() => {}));

		renderPage();

		expect(screen.getByText("Comprobando la sesión…")).toBeInTheDocument();
	});

	it("shows the email of the session", async () => {
		meGet.mockResolvedValue(meResponse());
		healthGet.mockReturnValue(new Promise(() => {}));

		renderPage();

		expect(await screen.findByText("owner@nexus.test")).toBeInTheDocument();
	});

	it("shows an error with a way to retry when the session cannot be checked", async () => {
		const user = userEvent.setup();
		meGet.mockRejectedValueOnce(new Error("no answer")).mockResolvedValueOnce(meResponse());
		healthGet.mockReturnValue(new Promise(() => {}));

		renderPage();

		expect(await screen.findByText("No se ha podido comprobar la sesión.")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Reintentar" }));

		expect(await screen.findByText("owner@nexus.test")).toBeInTheDocument();
		expect(meGet).toHaveBeenCalledTimes(2);
	});

	it("shows the health panel, which moved here from the root", async () => {
		meGet.mockReturnValue(new Promise(() => {}));
		healthGet.mockResolvedValue(okResponse());

		renderPage();

		// While the request is in flight the button reads "Comprobando…".
		expect(await screen.findByText("ok")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Comprobar de nuevo" })).toBeInTheDocument();
	});

	it("mounts the theme switcher in the view bar", () => {
		meGet.mockReturnValue(new Promise(() => {}));
		healthGet.mockReturnValue(new Promise(() => {}));

		renderPage();

		expect(screen.getByRole("button", { name: "Sistema" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Claro" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Oscuro" })).toBeInTheDocument();
	});

	it("does not query the session from another section", async () => {
		meGet.mockResolvedValue(meResponse());
		healthGet.mockReturnValue(new Promise(() => {}));

		render(
			<Wrapper>
				<MemoryRouter initialEntries={["/"]}>
					<Routes>
						<Route element={<AppShell />}>
							<Route path="/" element={<p>Vista de Hoy</p>} />
							<Route path="/more" element={<MorePage />} />
						</Route>
					</Routes>
				</MemoryRouter>
			</Wrapper>,
		);

		expect(screen.getByText("Vista de Hoy")).toBeInTheDocument();
		expect(meGet).not.toHaveBeenCalled();
	});
});

describe("MorePage at 360 px", () => {
	it("fits the capture bar, the tab bar and the switcher without a sideways scroll", () => {
		meGet.mockReturnValue(new Promise(() => {}));
		healthGet.mockReturnValue(new Promise(() => {}));

		render(
			<Wrapper>
				<MemoryRouter initialEntries={["/more"]}>
					<Routes>
						<Route element={<AppShell />}>
							<Route path="/more" element={<MorePage />} />
						</Route>
					</Routes>
				</MemoryRouter>
			</Wrapper>,
		);

		// Same reasoning as in today-page.test.tsx: nothing may fix a width in
		// pixels, and the bars may only be as wide as the space they are given.
		for (const element of document.querySelectorAll<HTMLElement>("[style]")) {
			expect(element.style.width).toBe("");
			expect(element.style.minWidth).toBe("");
		}

		const appContent = document.querySelector("[data-slot='app-content']");
		expect(appContent?.className).toContain("min-w-0");
		expect(appContent?.className).toContain("overflow-y-auto");

		expect(document.querySelector("[data-slot='tab-bar']")).not.toBeNull();
		expect(document.querySelector("[data-slot='capture-bar']")).not.toBeNull();
	});
});
