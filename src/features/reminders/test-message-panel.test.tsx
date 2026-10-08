import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastHost } from "@/components/toast-host";
import { failJson, withQueryClient } from "../tasks/test-helpers";
import { TestMessagePanel } from "./test-message-panel";

const send = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
	client: { api: { telegram: { test: { $post: send } } } },
}));

function renderPanel() {
	const { wrapper } = withQueryClient();
	render(
		<>
			<TestMessagePanel />
			<ToastHost />
		</>,
		{ wrapper },
	);
}

afterEach(() => {
	cleanup();
	send.mockReset();
});

describe("TestMessagePanel", () => {
	it("sends the test message and says where to look", async () => {
		const user = userEvent.setup();
		send.mockResolvedValue({ ok: true, status: 204, json: async () => null });
		renderPanel();

		const button = screen.getByRole("button", { name: "Enviar aviso de prueba" });
		expect(button.className).toContain("min-h-11");
		await user.click(button);

		expect(send).toHaveBeenCalledTimes(1);
		expect(await screen.findByText("Aviso enviado. Revisa Telegram.")).toBeInTheDocument();
	});

	it("shows the API's message when Telegram is not configured", async () => {
		const user = userEvent.setup();
		send.mockResolvedValue(failJson("Falta configurar TELEGRAM_CHAT_ID en el Worker.", 503));
		renderPanel();

		await user.click(screen.getByRole("button", { name: "Enviar aviso de prueba" }));

		expect(
			await screen.findByText("No se ha podido enviar el aviso de prueba"),
		).toBeInTheDocument();
		expect(screen.getByText("Falta configurar TELEGRAM_CHAT_ID en el Worker.")).toBeInTheDocument();
	});
});
