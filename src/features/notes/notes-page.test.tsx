import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { failJson, okJson, withQueryClient } from "../tasks/test-helpers";
import { NotesPage, SEARCH_DELAY_MS } from "./notes-page";

const api = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock("@/lib/api", () => ({ client: { api: { notes: { $get: api.list } } } }));

/** Friday 2026-10-09, 14:00 in Madrid. */
const NOW = Date.UTC(2026, 9, 9, 12, 0);

function listed(title: string, overrides: Record<string, unknown> = {}) {
	return {
		id: crypto.randomUUID(),
		title,
		excerpt: "",
		pinned: false,
		updated_at: NOW - 60_000,
		...overrides,
	};
}

function renderPage() {
	const { wrapper: Wrapper } = withQueryClient();
	render(
		<Wrapper>
			<MemoryRouter>
				<NotesPage />
			</MemoryRouter>
		</Wrapper>,
	);
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"], shouldAdvanceTime: true });
	vi.setSystemTime(NOW);
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	api.list.mockReset();
});

describe("NotesPage", () => {
	it("lists pinned notes under Fijadas, then the rest, as links with excerpt and date", async () => {
		api.list.mockResolvedValue(
			okJson([
				listed("Contraseña del wifi", { pinned: true, excerpt: "en la nevera" }),
				listed("Ideas", { updated_at: Date.UTC(2026, 9, 8, 12, 0) }),
				listed("Viaje", { updated_at: Date.UTC(2026, 9, 1, 12, 0) }),
			]),
		);
		renderPage();

		const pinned = await screen.findByRole("list", { name: "Fijadas" });
		const link = within(pinned).getByRole("link", { name: /Contraseña del wifi/ });
		expect(link).toHaveAttribute("href", expect.stringMatching(/^\/notes\//));
		expect(link).toHaveTextContent("en la nevera");
		expect(link).toHaveTextContent("13:59");
		expect(link.className).toContain("min-h-11");

		const others = screen.getByRole("list", { name: "Notas" });
		expect(within(others).getByRole("link", { name: /Ideas/ })).toHaveTextContent("ayer");
		expect(within(others).getByRole("link", { name: /Viaje/ })).toHaveTextContent("jue 1 oct");
	});

	it("shows the empty state when there are no notes", async () => {
		api.list.mockResolvedValue(okJson([]));
		renderPage();

		expect(await screen.findByText("Sin notas")).toBeInTheDocument();
	});

	it("searches once the typing stops, and says when nothing matches", async () => {
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		api.list.mockResolvedValue(okJson([listed("Canción")]));
		renderPage();
		await screen.findByText("Canción");

		api.list.mockResolvedValue(okJson([]));
		await user.type(screen.getByRole("searchbox", { name: "Buscar en las notas" }), "xyz");
		expect(api.list).toHaveBeenCalledTimes(1);

		await act(() => vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS));

		expect(api.list).toHaveBeenCalledTimes(2);
		expect(api.list).toHaveBeenLastCalledWith({ query: { q: "xyz" } });
		expect(await screen.findByText("Ninguna nota contiene «xyz».")).toBeInTheDocument();
	});

	it("offers to retry when the list cannot be read", async () => {
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		api.list.mockResolvedValueOnce(failJson("caída")).mockResolvedValueOnce(okJson([]));
		renderPage();

		await user.click(await screen.findByRole("button", { name: "Reintentar" }));

		expect(await screen.findByText("Sin notas")).toBeInTheDocument();
	});
});
