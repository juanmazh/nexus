import {
	expect,
	expectNoHorizontalScroll,
	expectTactileTargets,
	gotoRoute,
	stubNote,
	test,
} from "./fixtures";

/**
 * Notes with a real layout, in both viewports, against the in-memory stub of
 * `fixtures.ts` (add-notes): capture one, write in it and see it saved, read
 * it with format, search without accents, pin and delete.
 */

test.describe("notes", () => {
	test("captures a note, saves what is written and shows it with format", async ({
		page,
		notes,
	}) => {
		await gotoRoute(page, "/notes");
		await expect(page.getByText("Sin notas")).toBeVisible();

		const bar = page.getByRole("textbox", { name: "Añadir algo" });
		await expect(bar).toHaveAttribute("placeholder", "Añade una nota…");
		await bar.fill("Lista de la compra");
		await page.getByRole("button", { name: "Guardar" }).click();

		const editor = page.getByRole("textbox", { name: "Contenido de la nota" });
		await expect(editor).toBeFocused();
		// Inside a note there is no capture bar; the navigation stays.
		await expect(page.getByRole("textbox", { name: "Añadir algo" })).toHaveCount(0);
		await editor.press("End");
		await editor.pressSequentially("\n- pan\n- **leche**");
		await expect(page.getByText("Guardado")).toBeVisible();
		expect(notes[0]?.content).toBe("Lista de la compra\n- pan\n- **leche**");

		await page.getByRole("button", { name: "Ver" }).click();
		await expect(page.getByRole("heading", { level: 1, name: "Lista de la compra" })).toBeVisible();
		await expect(page.locator(".markdown strong")).toHaveText("leche");
		await expectTactileTargets(
			page.getByRole("toolbar", { name: "Acciones de la nota" }).getByRole("button"),
		);
		await expectNoHorizontalScroll(page);

		await page.getByRole("link", { name: /Notas/ }).first().click();
		await expect(page.getByRole("link", { name: /Lista de la compra/ })).toContainText(
			"pan · leche",
		);
	});

	test("finds a note without typing its accents", async ({ page, notes }) => {
		notes.push(stubNote("Canción de cumpleaños\nletra"), stubNote("Otra cosa"));
		await gotoRoute(page, "/notes");
		await expect(page.getByRole("link", { name: /Otra cosa/ })).toBeVisible();

		await page.getByRole("searchbox", { name: "Buscar en las notas" }).fill("cancion");

		await expect(page.getByRole("link", { name: /Otra cosa/ })).toHaveCount(0);
		await expect(page.getByRole("link", { name: /Canción de cumpleaños/ })).toBeVisible();
	});

	test("pins a note to the top and deletes it after confirming", async ({ page, notes }) => {
		notes.push(stubNote("Contraseña del wifi\nen la nevera"), stubNote("Más reciente"));
		await gotoRoute(page, "/notes");

		await page.getByRole("link", { name: /Contraseña del wifi/ }).click();
		await page.getByRole("button", { name: "Fijar" }).click();
		await expect(page.getByRole("button", { name: "Fijada" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await page.getByRole("link", { name: /Notas/ }).first().click();
		await expect(
			page.getByRole("list", { name: "Fijadas" }).getByRole("link", { name: /Contraseña/ }),
		).toBeVisible();

		await page.getByRole("link", { name: /Contraseña del wifi/ }).click();
		await page.getByRole("button", { name: "Eliminar" }).click();
		await page.getByRole("button", { name: "Eliminar nota" }).click();

		await expect(page.getByText("Nota eliminada")).toBeVisible();
		await expect(page.getByRole("link", { name: /Contraseña del wifi/ })).toHaveCount(0);
		expect(notes.map((note) => note.content)).toEqual(["Más reciente"]);
	});

	test("keeps a wide table, long code and a long link inside the screen", async ({
		page,
		notes,
	}) => {
		const wide = Array.from({ length: 12 }, (_, i) => `columna ${i}`);
		const note = stubNote(
			[
				"Apuntes técnicos",
				`| ${wide.join(" | ")} |`,
				`|${wide.map(() => "---").join("|")}|`,
				`| ${wide.map((_, i) => `valor${i}`).join(" | ")} |`,
				"",
				"```",
				`const muyLarga = "${"x".repeat(200)}";`,
				"```",
				"",
				`https://example.test/${"segmento/".repeat(30)}`,
			].join("\n"),
		);
		notes.push(note);

		await gotoRoute(page, `/notes/${note.id}`);

		await expect(page.locator(".markdown table")).toBeVisible();
		await expectNoHorizontalScroll(page);
	});

	test("says a note does not exist, with a way back", async ({ page }) => {
		await gotoRoute(page, `/notes/${crypto.randomUUID()}`);

		await expect(page.getByText("Esta nota no existe")).toBeVisible();
		await page.getByRole("link", { name: "Volver a Notas" }).click();
		await expect(page).toHaveURL(/\/notes$/);
	});
});
