import {
	expect,
	expectNoHorizontalScroll,
	expectTactileTargets,
	gotoRoute,
	stubTask,
	test,
} from "./fixtures";

/**
 * The task flow with a real layout, in both viewports: create from the capture
 * bar, complete with the check, open the detail (bottom sheet on a phone, dialog
 * on desktop) and delete with confirmation. The API is the in-memory stub of
 * `fixtures.ts` (design.md D15), so every step sees what the previous one did.
 */

/** The overlay `ResponsiveDialog` renders for the current viewport. */
function overlaySlot(isMobile: boolean) {
	return isMobile ? "[data-slot='drawer-popup']" : "[data-slot='dialog-content']";
}

test.describe("tasks", () => {
	test("creates a task from the capture bar", async ({ page, tasks, isMobile }) => {
		await gotoRoute(page, "/tasks");
		await expect(page.getByText("Sin tareas")).toBeVisible();

		const input = page.locator("[data-slot='capture-bar'] input");
		await input.fill("Comprar pan");
		await input.press("Enter");

		await expect(input).toHaveValue("");
		expect(tasks.map((task) => task.title)).toEqual(["Comprar pan"]);

		// The detail of the new task opens at once (open-detail-on-capture).
		const overlay = page.locator(overlaySlot(isMobile));
		await expect(overlay.getByLabel("Título")).toHaveValue("Comprar pan");
		await page.keyboard.press("Escape");
		await expect(overlay).toHaveCount(0);

		await expect(page.getByRole("button", { name: "Completar Comprar pan" })).toBeEnabled();

		await expectNoHorizontalScroll(page);
		await expectTactileTargets(page.getByRole("button", { name: /^Completar / }));
	});

	test("completes a task with the check and can undo it", async ({ page, tasks }) => {
		tasks.push(stubTask({ title: "Pagar el alquiler" }));
		await gotoRoute(page, "/tasks");

		await page.getByRole("button", { name: "Completar Pagar el alquiler" }).click();

		await expect(page.getByRole("button", { name: "Completar Pagar el alquiler" })).toHaveCount(0);
		const toggle = page.getByRole("button", { name: "Hechas (1)" });
		await expect(toggle).toHaveAttribute("aria-pressed", "false");
		expect(tasks[0]?.status).toBe("done");

		await toggle.click();
		await page.getByRole("button", { name: "Deshacer Pagar el alquiler" }).click();

		await expect(page.getByRole("button", { name: "Completar Pagar el alquiler" })).toBeVisible();
		expect(tasks[0]?.status).toBe("todo");
	});

	test("opens the detail as a sheet on a phone and a dialog on desktop", async ({
		page,
		tasks,
		isMobile,
	}) => {
		tasks.push(stubTask({ title: "Revisar la factura" }));
		await gotoRoute(page, "/tasks");

		await page.getByRole("button", { name: /^Revisar la factura/ }).click();

		const overlay = page.locator(overlaySlot(isMobile));
		await expect(overlay).toBeVisible();
		await expect(page.locator(overlaySlot(!isMobile))).toHaveCount(0);
		await expect(overlay.getByLabel("Vence")).toHaveAttribute("type", "date");

		await expectNoHorizontalScroll(page);
		await expectTactileTargets(overlay.getByRole("button", { name: /Guardar tarea|Borrar/ }));

		await overlay.getByLabel("Título").fill("Revisar la factura de la luz");
		await overlay.getByRole("button", { name: "Guardar tarea" }).click();

		await expect(overlay).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "Completar Revisar la factura de la luz" }),
		).toBeVisible();
		expect(tasks[0]?.title).toBe("Revisar la factura de la luz");
	});

	test("deletes a task only after the explicit confirmation", async ({ page, tasks, isMobile }) => {
		tasks.push(stubTask({ title: "Llamar al taller" }));
		await gotoRoute(page, "/tasks");

		await page.getByRole("button", { name: /^Llamar al taller/ }).click();
		const overlay = page.locator(overlaySlot(isMobile));

		await overlay.getByRole("button", { name: "Borrar", exact: true }).click();
		await expect(
			overlay.getByText("¿Borrar «Llamar al taller»? No se puede deshacer."),
		).toBeVisible();
		await overlay.getByRole("button", { name: "Cancelar" }).click();
		expect(tasks).toHaveLength(1);

		await overlay.getByRole("button", { name: "Borrar", exact: true }).click();
		await overlay.getByRole("button", { name: "Borrar tarea" }).click();

		await expect(page.getByText("Sin tareas")).toBeVisible();
		expect(tasks).toHaveLength(0);
	});

	test("keeps a very long title inside the screen", async ({ page, tasks }) => {
		tasks.push(
			stubTask({
				title:
					"Una tarea con un título larguísimo que no cabe de ninguna manera en una pantalla de 360 píxeles",
				priority: "high",
				due_at: Date.now() + 3 * 86_400_000,
			}),
		);
		await gotoRoute(page, "/tasks");

		await expect(page.getByText("Alta")).toBeVisible();
		await expectNoHorizontalScroll(page);
	});

	test("opens the detail of a captured task over the section it was captured in", async ({
		page,
		isMobile,
	}) => {
		await gotoRoute(page, "/");
		const input = page.locator("[data-slot='capture-bar'] input");
		await input.fill("Llamar al taller");
		await input.press("Enter");

		const overlay = page.locator(overlaySlot(isMobile));
		await expect(overlay.getByLabel("Título")).toHaveValue("Llamar al taller");
		await expect(page).toHaveURL(/\/$/);

		await page.keyboard.press("Escape");
		await expect(overlay).toHaveCount(0);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hoy");
	});

	test("does not pop the virtual keyboard when the detail opens on a phone", async ({
		page,
		isMobile,
	}) => {
		test.skip(!isMobile, "only a phone has a virtual keyboard to pop");
		await gotoRoute(page, "/tasks");
		const input = page.locator("[data-slot='capture-bar'] input");
		await input.fill("Comprar pan");
		await input.press("Enter");

		const overlay = page.locator(overlaySlot(true));
		await expect(overlay.getByLabel("Título")).toHaveValue("Comprar pan");
		// The focus lands on the sheet itself, not on a text field.
		await expect(overlay.getByLabel("Título")).not.toBeFocused();
	});
});
