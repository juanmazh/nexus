import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ToastHost, toast } from "./toast-host";

/**
 * A notice has to reach assistive technology and get out of the way on its own,
 * otherwise every confirmation asks the person to dismiss it (the "the notice is
 * announced and withdraws itself" scenario of `responsive-overlays`).
 */

function Emitter() {
	return (
		<button
			type="button"
			onClick={() => {
				toast.add({ title: "Tarea guardada", timeout: 200 });
			}}
		>
			Guardar tarea
		</button>
	);
}

afterEach(cleanup);

describe("ToastHost", () => {
	it("announces a notice emitted by a consumer", async () => {
		const user = userEvent.setup();
		render(
			<>
				<ToastHost />
				<Emitter />
			</>,
		);

		await user.click(screen.getByRole("button", { name: "Guardar tarea" }));

		const notice = await screen.findByText("Tarea guardada");
		expect(notice).toBeInTheDocument();
		expect(notice.closest("[data-slot='toast']")).not.toBeNull();
	});

	it("removes the notice on its own", async () => {
		const user = userEvent.setup();
		render(
			<>
				<ToastHost />
				<Emitter />
			</>,
		);

		await user.click(screen.getByRole("button", { name: "Guardar tarea" }));
		await screen.findByText("Tarea guardada");

		await waitFor(
			() => {
				expect(screen.queryByText("Tarea guardada")).not.toBeInTheDocument();
			},
			{ timeout: 5000 },
		);
	});

	it("renders the host inside the toast viewport, so it has one position", async () => {
		const user = userEvent.setup();
		render(
			<>
				<ToastHost />
				<Emitter />
			</>,
		);

		await user.click(screen.getByRole("button", { name: "Guardar tarea" }));
		await screen.findByText("Tarea guardada");

		expect(document.querySelectorAll("[data-slot='toast-viewport']")).toHaveLength(1);
	});
});
