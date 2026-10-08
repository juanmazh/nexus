import { expect, gotoRoute, test } from "./fixtures";

/**
 * The installable app against the built assets served by `vite preview`, where
 * `public/_headers` applies: the manifest and the icons are reachable under the
 * real CSP, the status bar colour follows the theme, and no service worker is
 * ever registered (docs/ARCHITECTURE.md ADR-011).
 */

test.describe("installable app", () => {
	test("links a manifest that is served and describes a standalone app", async ({ page }) => {
		await gotoRoute(page, "/");

		const href = await page.locator('link[rel="manifest"]').getAttribute("href");
		expect(href).toBe("/manifest.webmanifest");

		const response = await page.request.get(href ?? "");
		expect(response.status()).toBe(200);
		const manifest = await response.json();
		expect(manifest).toMatchObject({ display: "standalone", start_url: "/", name: "Nexus" });

		for (const icon of manifest.icons as { src: string }[]) {
			const image = await page.request.get(icon.src);
			expect(image.status(), icon.src).toBe(200);
			expect(image.headers()["content-type"], icon.src).toContain("image/png");
		}
	});

	test("loads the manifest and the favicon without a CSP violation", async ({ page }) => {
		const violations: string[] = [];
		page.on("console", (message) => {
			if (message.text().includes("Content Security Policy")) {
				violations.push(message.text());
			}
		});

		await gotoRoute(page, "/");
		await page.waitForLoadState("networkidle");

		expect((await page.request.get("/favicon.svg")).status()).toBe(200);
		expect(violations).toEqual([]);
	});

	test("paints the status bar with the background of the chosen theme", async ({ page }) => {
		await gotoRoute(page, "/more");
		const themeColor = page.locator('meta[name="theme-color"]');

		await page.getByRole("button", { name: "Oscuro" }).click();
		await expect(themeColor).toHaveAttribute("content", "#14170f");

		await page.getByRole("button", { name: "Claro" }).click();
		await expect(themeColor).toHaveAttribute("content", "#f6f7f2");
	});

	test("registers no service worker", async ({ page }) => {
		await gotoRoute(page, "/tasks");
		await page.waitForLoadState("networkidle");

		const registrations = await page.evaluate(
			async () => (await navigator.serviceWorker.getRegistrations()).length,
		);
		expect(registrations).toBe(0);
	});

	test("is installable according to Chromium itself", async ({ page }) => {
		await gotoRoute(page, "/");
		await page.waitForLoadState("networkidle");

		// Chromium lists every reason a page cannot be installed. Playwright's
		// contexts are private, and some Chromium builds object to that
		// ("in-incognito") while the CI's does not: that one is ignored, and any
		// other reason fails. No manifest error and, with no service worker, no
		// complaint about it either.
		const cdp = await page.context().newCDPSession(page);
		const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
		const { errors } = await cdp.send("Page.getAppManifest");

		const reasons = installabilityErrors
			.map((error) => error.errorId)
			.filter((reason) => reason !== "in-incognito");
		expect(reasons).toEqual([]);
		expect(errors).toEqual([]);
	});
});
