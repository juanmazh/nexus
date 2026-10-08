import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastHost } from "@/components/toast-host";
import { failJson, okJson, withQueryClient } from "../tasks/test-helpers";
import { QuietHoursPanel } from "./quiet-hours-panel";

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));

vi.mock("@/lib/api", () => ({
	client: { api: { settings: { "quiet-hours": { $get: api.get, $put: api.put } } } },
}));

function renderPanel() {
	const { wrapper } = withQueryClient();
	render(
		<>
			<QuietHoursPanel />
			<ToastHost />
		</>,
		{ wrapper },
	);
}

afterEach(() => {
	cleanup();
	api.get.mockReset();
	api.put.mockReset();
});

describe("QuietHoursPanel", () => {
	it("shows the saved window, turned on", async () => {
		api.get.mockResolvedValue(okJson({ start: "23:00", end: "08:00" }));
		renderPanel();

		const toggle = await screen.findByRole("switch", { name: "Activar el silencio nocturno" });
		expect(toggle).toBeChecked();
		expect(screen.getByLabelText("Desde")).toHaveValue("23:00");
		expect(screen.getByLabelText("Hasta")).toHaveValue("08:00");
	});

	it("saves new hours and says so", async () => {
		const user = userEvent.setup();
		api.get.mockResolvedValue(okJson({ start: "23:00", end: "08:00" }));
		api.put.mockResolvedValue(okJson({ start: "22:30", end: "07:00" }));
		renderPanel();

		const from = await screen.findByLabelText("Desde");
		await user.clear(from);
		await user.type(from, "22:30");
		const to = screen.getByLabelText("Hasta");
		await user.clear(to);
		await user.type(to, "07:00");
		await user.click(screen.getByRole("button", { name: "Guardar" }));

		expect(api.put).toHaveBeenCalledWith({ json: { start: "22:30", end: "07:00" } });
		expect(await screen.findByText("Silencio nocturno guardado")).toBeInTheDocument();
	});

	it("turns it off with null, keeping the hours on screen", async () => {
		const user = userEvent.setup();
		api.get.mockResolvedValue(okJson({ start: "23:00", end: "08:00" }));
		api.put.mockResolvedValue(okJson(null));
		renderPanel();

		await user.click(await screen.findByRole("switch", { name: "Activar el silencio nocturno" }));
		expect(screen.getByLabelText("Desde")).toBeDisabled();
		await user.click(screen.getByRole("button", { name: "Guardar" }));

		expect(api.put).toHaveBeenCalledWith({ json: null });
		expect(await screen.findByText("Silencio nocturno desactivado")).toBeInTheDocument();
		expect(screen.getByLabelText("Desde")).toHaveValue("23:00");
	});

	it("starts off with the default hours when it was turned off", async () => {
		api.get.mockResolvedValue(okJson(null));
		renderPanel();

		expect(
			await screen.findByRole("switch", { name: "Activar el silencio nocturno" }),
		).not.toBeChecked();
		expect(screen.getByLabelText("Desde")).toHaveValue("23:00");
	});

	it("rejects the same hour at both ends next to the fields, without sending", async () => {
		const user = userEvent.setup();
		api.get.mockResolvedValue(okJson({ start: "23:00", end: "08:00" }));
		renderPanel();

		const to = await screen.findByLabelText("Hasta");
		await user.clear(to);
		await user.type(to, "23:00");
		await user.click(screen.getByRole("button", { name: "Guardar" }));

		const error = screen.getByText("El inicio y el fin no pueden ser la misma hora.");
		expect(to).toHaveAttribute("aria-invalid", "true");
		expect(to).toHaveAttribute("aria-describedby", error.id);
		expect(api.put).not.toHaveBeenCalled();
	});

	it("shows an error with a way to retry when it cannot be read", async () => {
		const user = userEvent.setup();
		api.get
			.mockResolvedValueOnce(failJson("caída"))
			.mockResolvedValueOnce(okJson({ start: "23:00", end: "08:00" }));
		renderPanel();

		await user.click(await screen.findByRole("button", { name: "Reintentar" }));

		expect(
			await screen.findByRole("switch", { name: "Activar el silencio nocturno" }),
		).toBeChecked();
	});
});
