import {
	expect,
	expectNoHorizontalScroll,
	expectTactileTargets,
	expectVisibleWithoutScrolling,
	gotoRoute,
	SESSION_EMAIL,
	test,
} from "./fixtures";

/**
 * The three checks of docs/DESIGN.md §6, applied to every route in both
 * viewports, plus the behaviour that only shows up with a real layout: the
 * navigation, the capture bar and the `N` shortcut.
 *
 * They run against the built assets served by `vite preview`, not against
 * `pnpm dev`, because only the real static assets manager applies
 * `public/_headers` (design.md D8).
 */

const ROUTES = [
	{ path: "/", name: "Hoy", primary: { role: "button", name: "Guardar" } },
	{ path: "/tasks", name: "Tareas", primary: { role: "button", name: "Guardar" } },
	{ path: "/notes", name: "Notas", primary: { role: "button", name: "Guardar" } },
	{ path: "/more", name: "Más", primary: { role: "button", name: "Comprobar de nuevo" } },
	{ path: "/no-existe", name: "no encontrada", primary: { role: "link", name: "Volver a Hoy" } },
] as const;

for (const route of ROUTES) {
	test.describe(`${route.path} (${route.name})`, () => {
		test("does not scroll horizontally", async ({ page }) => {
			await gotoRoute(page, route.path);

			await expectNoHorizontalScroll(page);
		});

		test("shows the primary action without scrolling", async ({ page }) => {
			await gotoRoute(page, route.path);

			await expectVisibleWithoutScrolling(
				page,
				page.getByRole(route.primary.role, { name: route.primary.name }),
			);
		});

		test("gives the main controls a 44 px touch area", async ({ page }) => {
			await gotoRoute(page, route.path);

			await expectTactileTargets(page.locator("nav a, [data-slot='capture-bar'] button"));
		});
	});
}

test.describe("navigation", () => {
	test("reaches the four sections from the tab bar or the sidebar", async ({ page }) => {
		await gotoRoute(page, "/");

		const nav = page.getByRole("navigation", { name: "Secciones" });
		for (const label of ["Tareas", "Notas", "Más", "Hoy"]) {
			await nav.getByRole("link", { name: label }).click();
			await expect(page.getByRole("heading", { level: 1 })).toHaveText(label);
		}
	});

	test("marks the active section for assistive technology", async ({ page }) => {
		await gotoRoute(page, "/tasks");

		const nav = page.getByRole("navigation", { name: "Secciones" });
		await expect(nav.getByRole("link", { name: "Tareas" })).toHaveAttribute("aria-current", "page");
		await expect(nav.getByRole("link", { name: "Hoy" })).not.toHaveAttribute(
			"aria-current",
			"page",
		);
	});

	test("offers a way back to Hoy from a route that does not exist", async ({ page }) => {
		await gotoRoute(page, "/no-existe");

		await page.getByRole("link", { name: "Volver a Hoy" }).click();

		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hoy");
	});
});

test.describe("capture bar", () => {
	test("is visible without scrolling at 360 px", async ({ page, isMobile }) => {
		test.skip(!isMobile, "the bottom bar is only the mobile layout");

		await gotoRoute(page, "/");

		await expectVisibleWithoutScrolling(page, page.locator("[data-slot='capture-bar'] input"));
		await expectNoHorizontalScroll(page);
	});

	test("tells the keyboard that the action is send", async ({ page }) => {
		await gotoRoute(page, "/");

		await expect(page.locator("[data-slot='capture-bar'] input")).toHaveAttribute(
			"enterkeyhint",
			"send",
		);
	});

	test("is reachable with the N key on desktop", async ({ page, isMobile }) => {
		test.skip(isMobile, "the shortcut exists for the keyboard, not for the thumb");

		await gotoRoute(page, "/");

		await page.keyboard.press("n");

		const input = page.locator("[data-slot='capture-bar'] input");
		await expect(input).toBeFocused();
		await page.keyboard.type("comprar pan");
		await expect(input).toHaveValue("comprar pan");
	});

	test("does not steal N when it is pressed with a modifier", async ({ page }) => {
		await gotoRoute(page, "/");

		await page.locator("body").click();
		await page.keyboard.press("Control+n");

		await expect(page.locator("[data-slot='capture-bar'] input")).not.toBeFocused();
	});

	test("does not move the focus away from the capture field while typing", async ({ page }) => {
		await gotoRoute(page, "/");

		const input = page.locator("[data-slot='capture-bar'] input");
		await input.click();
		await page.keyboard.type("mañana");

		await expect(input).toBeFocused();
		await expect(input).toHaveValue("mañana");
	});
});

test.describe("the document itself", () => {
	test("does not block the browser zoom", async ({ page }) => {
		await gotoRoute(page, "/");

		const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");

		expect(viewport).toBe("width=device-width, initial-scale=1, viewport-fit=cover");
		expect(viewport).not.toContain("maximum-scale");
		expect(viewport).not.toContain("user-scalable");
	});

	test("serves the fonts from our own origin", async ({ page }) => {
		const requested: string[] = [];
		page.on("request", (request) => requested.push(request.url()));

		await gotoRoute(page, "/");
		// `font-display: swap` means the faces load after the first paint; without
		// waiting, the request may not have happened yet.
		await page.evaluate(() => document.fonts.ready);

		const origin = new URL(page.url()).origin;
		const external = requested.filter((url) => new URL(url).origin !== origin);

		expect(external, `peticiones fuera del propio origen: ${external.join(", ")}`).toEqual([]);
		expect(
			requested.some((url) => url.includes(".woff2")),
			"no se pidió ninguna fuente",
		).toBe(true);
	});
});

test.describe("more", () => {
	test("shows the session of the stubbed API", async ({ page }) => {
		await gotoRoute(page, "/more");

		await expect(page.getByText(SESSION_EMAIL)).toBeVisible();
		await expect(page.getByRole("button", { name: "Comprobar de nuevo" })).toBeVisible();
	});

	test("mounts exactly one toast host", async ({ page }) => {
		await gotoRoute(page, "/");

		await expect(page.locator("[data-slot='toast-viewport']")).toHaveCount(1);
	});
});
