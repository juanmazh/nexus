import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DESKTOP_QUERY } from "@/lib/use-media-query";
import { ResponsiveDialog } from "./responsive-dialog";

/**
 * The single-overlay rule only holds if the component really mounts one or the
 * other, so these tests assert on which primitive is in the DOM rather than on
 * classes: `Drawer` and `Dialog` leave different `data-slot` values behind.
 */

const originalMatchMedia = window.matchMedia;

let matches = false;
let listeners: (() => void)[] = [];

function setViewport(isDesktop: boolean) {
	matches = isDesktop;
	for (const listener of listeners) {
		listener();
	}
}

function stubMatchMedia() {
	matches = false;
	listeners = [];

	window.matchMedia = (query: string) => {
		const media = {
			get matches() {
				return query === DESKTOP_QUERY && matches;
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
	};
}

function Harness({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<button
				type="button"
				onClick={() => {
					setOpen(true);
				}}
			>
				Abrir
			</button>
			<ResponsiveDialog
				open={open}
				onOpenChange={(next) => {
					setOpen(next);
					onOpenChange?.(next);
				}}
				title="Detalles"
				description="Lo que hace falta saber"
				actions={<button type="button">Guardar</button>}
			>
				<p>Contenido</p>
			</ResponsiveDialog>
		</>
	);
}

function currentShape(): "drawer" | "dialog" | null {
	if (document.querySelector('[data-slot="drawer-popup"]')) {
		return "drawer";
	}
	if (document.querySelector('[data-slot="dialog-content"]')) {
		return "dialog";
	}
	return null;
}

afterEach(() => {
	cleanup();
	window.matchMedia = originalMatchMedia;
});

describe("ResponsiveDialog", () => {
	it("mounts a bottom sheet at 360 px", async () => {
		stubMatchMedia();
		const user = userEvent.setup();
		render(<Harness />);

		await user.click(screen.getByRole("button", { name: "Abrir" }));

		expect(await screen.findByText("Detalles")).toBeInTheDocument();
		expect(currentShape()).toBe("drawer");
	});

	it("mounts a centred dialog at 1280 px", async () => {
		stubMatchMedia();
		const user = userEvent.setup();
		render(<Harness />);

		setViewport(true);
		await user.click(screen.getByRole("button", { name: "Abrir" }));

		expect(await screen.findByText("Detalles")).toBeInTheDocument();
		expect(currentShape()).toBe("dialog");
		expect(document.querySelector('[data-slot="drawer-popup"]')).toBeNull();
	});

	it("closes with Escape", async () => {
		stubMatchMedia();
		const onOpenChange = vi.fn();
		const user = userEvent.setup();
		render(<Harness onOpenChange={onOpenChange} />);

		await user.click(screen.getByRole("button", { name: "Abrir" }));
		await screen.findByText("Detalles");

		await user.keyboard("{Escape}");

		await waitFor(() => {
			expect(screen.queryByText("Detalles")).not.toBeInTheDocument();
		});
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
	});

	it("returns the focus to the control that opened it", async () => {
		stubMatchMedia();
		const user = userEvent.setup();
		render(<Harness />);

		const opener = screen.getByRole("button", { name: "Abrir" });
		await user.click(opener);
		await screen.findByText("Detalles");

		await user.keyboard("{Escape}");

		await waitFor(() => {
			expect(document.activeElement).toBe(opener);
		});
	});

	it("keeps the same title, description, content and actions in both shapes", async () => {
		stubMatchMedia();
		const user = userEvent.setup();
		const { unmount } = render(<Harness />);

		await user.click(screen.getByRole("button", { name: "Abrir" }));
		expect(await screen.findByText("Detalles")).toBeInTheDocument();
		expect(screen.getByText("Lo que hace falta saber")).toBeInTheDocument();
		expect(screen.getByText("Contenido")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
		unmount();

		setViewport(true);
		render(<Harness />);
		await user.click(screen.getByRole("button", { name: "Abrir" }));

		expect(await screen.findByText("Detalles")).toBeInTheDocument();
		expect(screen.getByText("Lo que hace falta saber")).toBeInTheDocument();
		expect(screen.getByText("Contenido")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
	});
});
