import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HealthPage } from "./health-page";

// The RPC client is mocked, so these tests cover the page's three states and the
// retry button without needing a running Worker.
const { $get } = vi.hoisted(() => ({ $get: vi.fn() }));

vi.mock("@/lib/api", () => ({
	client: { api: { health: { $get } } },
}));

function okResponse() {
	return { json: async () => ({ status: "ok" }) };
}

function renderPage() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});

	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);

	return render(<HealthPage />, { wrapper });
}

afterEach(() => {
	cleanup();
	$get.mockReset();
});

describe("HealthPage", () => {
	it("shows the loading state while the request is in flight", () => {
		$get.mockReturnValue(new Promise(() => {}));

		renderPage();

		expect(screen.getByText("Comprobando la API…")).toBeInTheDocument();
	});

	it("shows the status returned by the API", async () => {
		$get.mockResolvedValue(okResponse());

		renderPage();

		expect(await screen.findByText("ok")).toBeInTheDocument();
		expect(screen.queryByText(/No se ha podido comprobar la API/)).not.toBeInTheDocument();
	});

	it("shows an error that says what failed and no success state", async () => {
		$get.mockRejectedValue(new Error("network down"));

		renderPage();

		expect(await screen.findByText("No se ha podido comprobar la API.")).toBeInTheDocument();
		expect(screen.getByText(/No se ha podido contactar con la API/)).toBeInTheDocument();
		expect(screen.queryByText("ok")).not.toBeInTheDocument();
	});

	it("queries the API again when the retry button is pressed", async () => {
		const user = userEvent.setup();
		$get.mockRejectedValueOnce(new Error("network down")).mockResolvedValueOnce(okResponse());

		renderPage();

		const button = await screen.findByRole("button", { name: "Comprobar de nuevo" });
		expect($get).toHaveBeenCalledTimes(1);

		await user.click(button);

		expect(await screen.findByText("ok")).toBeInTheDocument();
		expect($get).toHaveBeenCalledTimes(2);
	});
});
