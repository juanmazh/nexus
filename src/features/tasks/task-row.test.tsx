import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskRow } from "./task-row";
import { makeTask } from "./test-helpers";

afterEach(cleanup);

function renderRow(task = makeTask({ title: "Pagar el alquiler" })) {
	const onOpen = vi.fn();
	const onToggle = vi.fn();
	render(
		<ul>
			<TaskRow task={task} onOpen={onOpen} onToggle={onToggle} />
		</ul>,
	);
	return { onOpen, onToggle };
}

describe("TaskRow", () => {
	it("has two separate buttons: open and complete, never one inside the other", () => {
		renderRow();

		const open = screen.getByRole("button", { name: /^Pagar el alquiler/ });
		const check = screen.getByRole("button", { name: "Completar Pagar el alquiler" });
		expect(open.contains(check)).toBe(false);
	});

	it("gives the check a 44 × 44 px touch area", () => {
		renderRow();

		expect(screen.getByRole("button", { name: "Completar Pagar el alquiler" })).toHaveClass(
			"size-11",
		);
	});

	it("calls each action from its own button", async () => {
		const user = userEvent.setup();
		const { onOpen, onToggle } = renderRow();

		await user.click(screen.getByRole("button", { name: "Completar Pagar el alquiler" }));
		await user.click(screen.getByRole("button", { name: /^Pagar el alquiler/ }));

		expect(onToggle).toHaveBeenCalledTimes(1);
		expect(onOpen).toHaveBeenCalledTimes(1);
	});

	it("writes the high priority instead of colouring it", () => {
		renderRow(makeTask({ title: "Urgente", priority: "high" }));

		expect(screen.getByText("Alta")).toBeInTheDocument();
	});

	it("offers to undo a completed task and says when it was done", () => {
		renderRow(makeTask({ title: "Hecha", status: "done", completed_at: Date.UTC(2026, 9, 9, 10) }));

		expect(screen.getByRole("button", { name: "Deshacer Hecha" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(screen.getByText(/Hecha el vie 9 oct/)).toBeInTheDocument();
	});
});

describe("TaskRow and its next reminder", () => {
	/** Wednesday 2026-10-07 at 16:00 in Madrid. */
	const NOW = Date.UTC(2026, 9, 7, 14, 0);

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("shows only the time, on the oil fill, for a reminder of today", () => {
		renderRow(makeTask({ title: "Llamar", next_reminder_at: Date.UTC(2026, 9, 7, 16, 0) }));

		const reminder = screen.getByText("18:00");
		expect(reminder.textContent).toBe("Aviso: 18:00");
		expect(reminder.className).toContain("bg-accent");
	});

	it("adds the date for another day, without the fill", () => {
		renderRow(makeTask({ title: "Llamar", next_reminder_at: Date.UTC(2026, 9, 9, 7, 0) }));

		const reminder = screen.getByText("vie 9 oct 9:00");
		expect(reminder.className).not.toContain("bg-accent");
	});

	it("shows no bell without a pending reminder, nor on a completed task", () => {
		renderRow(makeTask({ title: "Sin aviso" }));
		renderRow(
			makeTask({
				title: "Hecha",
				status: "done",
				completed_at: NOW,
				next_reminder_at: Date.UTC(2026, 9, 9, 7, 0),
			}),
		);

		expect(screen.queryByText(/Aviso:/)).toBeNull();
	});
});
