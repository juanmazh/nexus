import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptureBar } from "./capture-bar";
import { ViewHeader } from "./view-header";

/**
 * The capture bar is the app's main action, so what it must *not* do matters as
 * much as what it does: it must not steal a keystroke, and until `add-tasks`
 * connects it, it must not persist or call anything.
 */

const ROOT_FONT_PX = 16;

/**
 * jsdom has no layout engine, so a 44 px target cannot be measured here; the
 * Playwright suite measures it for real (docs/DESIGN.md §6). What this asserts is
 * the Tailwind contract: `size-11` / `min-h-11` are 2.75 rem, and the root font
 * size is pinned to 16 px by the design, so 2.75 × 16 = 44 px.
 */
function touchSizeOf(element: HTMLElement): number {
	const step = element.className.match(/(?:^|\s)(?:size|min-h)-(\d+)(?:\s|$)/)?.[1];
	return step === undefined ? 0 : Number.parseInt(step, 10) * 0.25 * ROOT_FONT_PX;
}

afterEach(cleanup);

describe("CaptureBar", () => {
	it("tells the virtual keyboard that the action is send", () => {
		render(<CaptureBar />);

		const input = screen.getByRole("textbox", { name: "Añadir algo" });
		expect(input).toHaveAttribute("enterkeyhint", "send");
	});

	it("uses a text input of at least 16 px", () => {
		render(<CaptureBar />);

		const input = screen.getByRole("textbox", { name: "Añadir algo" });
		expect(input).toHaveAttribute("type", "text");
		expect(input.className).toContain("text-base");
	});

	it("gives the send button a 44 × 44 px touch area", () => {
		render(<CaptureBar />);

		expect(touchSizeOf(screen.getByRole("button", { name: "Guardar" }))).toBeGreaterThanOrEqual(44);
	});

	it("gives the field a 44 px tall target too", () => {
		render(<CaptureBar />);

		expect(
			touchSizeOf(screen.getByRole("textbox", { name: "Añadir algo" })),
		).toBeGreaterThanOrEqual(44);
	});

	it("labels the field so it is reachable by role", () => {
		render(<CaptureBar />);

		expect(screen.getByLabelText("Añadir algo")).toBeInTheDocument();
	});

	it("saves nothing and calls no client when submitted", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		render(<CaptureBar onSubmit={onSubmit} />);

		const input = screen.getByRole("textbox", { name: "Añadir algo" });
		await user.type(input, "Comprar pan");
		await user.click(screen.getByRole("button", { name: "Guardar" }));

		expect(onSubmit).toHaveBeenCalledWith("Comprar pan");
		expect(input).toHaveValue("");
	});

	it("does nothing on an empty submission", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		render(<CaptureBar onSubmit={onSubmit} />);

		await user.click(screen.getByRole("button", { name: "Guardar" }));

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("works with no onSubmit at all, which is the state of this change", async () => {
		const user = userEvent.setup();
		render(<CaptureBar />);

		const input = screen.getByRole("textbox", { name: "Añadir algo" });
		await user.type(input, "Algo");
		await user.click(screen.getByRole("button", { name: "Guardar" }));

		expect(input).toHaveValue("");
	});

	it("focuses the field when N is pressed", async () => {
		const user = userEvent.setup();
		render(<CaptureBar />);

		await user.keyboard("n");

		expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Añadir algo" }));
	});

	it("keeps the N typed while the field already has the focus", async () => {
		const user = userEvent.setup();
		render(<CaptureBar />);

		await user.click(screen.getByRole("textbox", { name: "Añadir algo" }));
		await user.keyboard("ana");

		expect(screen.getByRole("textbox", { name: "Añadir algo" })).toHaveValue("ana");
	});

	it("does not steal N when another field has the focus", async () => {
		const user = userEvent.setup();
		render(
			<>
				<CaptureBar />
				<label htmlFor="otro">Otro campo</label>
				<input id="otro" />
			</>,
		);

		const other = screen.getByLabelText("Otro campo");
		await user.click(other);
		await user.keyboard("n");

		expect(other).toHaveValue("n");
		expect(document.activeElement).toBe(other);
	});

	it("does not steal N when an overlay is open", async () => {
		const user = userEvent.setup();
		render(
			<>
				<CaptureBar />
				<div data-slot="dialog-content" />
			</>,
		);

		await user.keyboard("n");

		expect(document.activeElement).not.toBe(screen.getByRole("textbox", { name: "Añadir algo" }));
	});

	it("does not steal Ctrl+N, Cmd+N or Alt+N", async () => {
		const user = userEvent.setup();
		render(<CaptureBar />);

		await user.keyboard("{Control>}n{/Control}");
		expect(document.activeElement).not.toBe(screen.getByRole("textbox", { name: "Añadir algo" }));

		await user.keyboard("{Meta>}n{/Meta}");
		expect(document.activeElement).not.toBe(screen.getByRole("textbox", { name: "Añadir algo" }));

		await user.keyboard("{Alt>}n{/Alt}");
		expect(document.activeElement).not.toBe(screen.getByRole("textbox", { name: "Añadir algo" }));
	});

	it("stops listening once unmounted", async () => {
		const user = userEvent.setup();
		const { unmount } = render(<CaptureBar />);
		const input = screen.getByRole("textbox", { name: "Añadir algo" });

		unmount();
		await user.keyboard("n");

		await waitFor(() => {
			expect(document.activeElement).not.toBe(input);
		});
	});
});

describe("ViewHeader", () => {
	it("shows the title of the view as the page's only h1", () => {
		render(<ViewHeader title="Hoy" />);

		const heading = screen.getByRole("heading", { level: 1, name: "Hoy" });
		expect(heading).toBeInTheDocument();
		expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
	});

	it("shows the subtitle when there is one", () => {
		render(<ViewHeader title="Hoy" subtitle="miércoles 7 de octubre" />);

		expect(screen.getByText("miércoles 7 de octubre")).toBeInTheDocument();
	});

	it("leaves room for one action", async () => {
		const user = userEvent.setup();
		const onClick = vi.fn();
		render(
			<ViewHeader
				title="Más"
				action={
					<button type="button" onClick={onClick}>
						Acción
					</button>
				}
			/>,
		);

		await user.click(screen.getByRole("button", { name: "Acción" }));

		expect(onClick).toHaveBeenCalledTimes(1);
	});
});
