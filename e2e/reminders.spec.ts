import {
	expect,
	expectNoHorizontalScroll,
	expectTactileTargets,
	gotoRoute,
	stubReminder,
	stubTask,
	test,
} from "./fixtures";

/**
 * Reminders with a real layout, in both viewports: add one with a shortcut, see
 * the bell in the row, cancel with confirmation, lose the bell on completing,
 * and send the test message from Más. Against the in-memory stub of
 * `fixtures.ts`, so each step sees what the previous one did.
 */

function overlaySlot(isMobile: boolean) {
	return isMobile ? "[data-slot='drawer-popup']" : "[data-slot='dialog-content']";
}

const IN_TWO_DAYS = Date.now() + 2 * 86_400_000;

test.describe("reminders", () => {
	test("adds a reminder with a shortcut and shows the bell in the row", async ({
		page,
		tasks,
		reminders,
		isMobile,
	}) => {
		tasks.push(stubTask({ title: "Llamar al taller" }));
		await gotoRoute(page, "/tasks");

		await page.getByRole("button", { name: /^Llamar al taller/ }).click();
		const overlay = page.locator(overlaySlot(isMobile));
		await expect(overlay.getByText("Sin avisos.")).toBeVisible();

		await expectNoHorizontalScroll(page);
		await expectTactileTargets(
			overlay.getByRole("button", { name: /^(En 1 h|Mañana 9:00|Añadir aviso)$/ }),
		);

		await overlay.getByRole("button", { name: "Mañana 9:00" }).click();

		const list = overlay.getByRole("list", { name: "Avisos pendientes" });
		await expect(list.getByText(/, 9:00$/)).toBeVisible();
		expect(reminders).toHaveLength(1);

		await page.keyboard.press("Escape");
		await expect(overlay).toHaveCount(0);
		await expect(page.getByText(/Aviso: .* 9:00$/)).toBeVisible();
		await expectNoHorizontalScroll(page);
	});

	test("cancels a reminder only after the confirmation", async ({
		page,
		tasks,
		reminders,
		isMobile,
	}) => {
		const task = stubTask({ title: "Pagar el alquiler" });
		tasks.push(task);
		reminders.push(stubReminder(task.id, IN_TWO_DAYS));
		await gotoRoute(page, "/tasks");
		await expect(page.getByText(/Aviso:/)).toBeVisible();

		await page.getByRole("button", { name: /^Pagar el alquiler/ }).click();
		const overlay = page.locator(overlaySlot(isMobile));
		const cancel = overlay.getByRole("button", { name: /^Cancelar el aviso/ });
		await expectTactileTargets(cancel);

		await cancel.click();
		await overlay.getByRole("button", { name: "Mantener" }).click();
		expect(reminders[0]?.status).toBe("pending");

		await overlay.getByRole("button", { name: /^Cancelar el aviso/ }).click();
		await expect(overlay.getByText(/^¿Cancelar el aviso del .* a las .*\?$/)).toBeVisible();
		await overlay.getByRole("button", { name: "Cancelar aviso" }).click();

		await expect(overlay.getByText("Sin avisos.")).toBeVisible();
		expect(reminders[0]?.status).toBe("cancelled");
		await page.keyboard.press("Escape");
		await expect(page.getByText(/Aviso:/)).toHaveCount(0);
	});

	test("loses the bell when the task is completed", async ({ page, tasks, reminders }) => {
		const task = stubTask({ title: "Renovar el DNI" });
		tasks.push(task);
		reminders.push(stubReminder(task.id, IN_TWO_DAYS));
		await gotoRoute(page, "/tasks");
		await expect(page.getByText(/Aviso:/)).toBeVisible();

		await page.getByRole("button", { name: "Completar Renovar el DNI" }).click();

		await expect(page.getByText(/Aviso:/)).toHaveCount(0);
		await expect.poll(() => reminders[0]?.status).toBe("cancelled");
	});

	test("sends the test message from Más", async ({ page }) => {
		await gotoRoute(page, "/more");

		const button = page.getByRole("button", { name: "Enviar aviso de prueba" });
		await expectTactileTargets(button);
		await button.click();

		await expect(page.getByText("Aviso enviado. Revisa Telegram.")).toBeVisible();
		await expectNoHorizontalScroll(page);
	});

	test("keeps a long detail reachable by scrolling instead of clipping it", async ({
		page,
		tasks,
		reminders,
		isMobile,
	}) => {
		const task = stubTask({
			title: "Preparar la declaración de la renta",
			notes: "Reunir los certificados del banco y el borrador del año pasado.",
			priority: "high",
			due_at: IN_TWO_DAYS,
		});
		tasks.push(task);
		for (let day = 1; day <= 4; day++) {
			reminders.push(stubReminder(task.id, Date.now() + day * 86_400_000));
		}
		await gotoRoute(page, "/tasks");
		await page.getByRole("button", { name: /^Preparar la declaración/ }).click();
		const overlay = page.locator(overlaySlot(isMobile));

		// The last reminder sits below the fold in both viewports. `click` waits
		// for the overlay to stop moving, scrolls the element into view and fails
		// if it cannot be reached, which is exactly what a clipped overlay does.
		await overlay
			.getByRole("button", { name: /^Cancelar el aviso/ })
			.last()
			.click();
		await expect(overlay.getByRole("button", { name: "Mantener" })).toBeInViewport();
	});
});
