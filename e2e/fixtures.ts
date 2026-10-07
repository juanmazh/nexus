import type { Locator, Page } from "@playwright/test";
import { test as base, expect } from "@playwright/test";

/**
 * Shared fixtures for the responsive suite (docs/DESIGN.md §6).
 *
 * The API is stubbed instead of authenticated: in CI there is no Cloudflare
 * Access application in front of the Worker and no `ACCESS_AUD`, so the suite
 * intercepts every request under `/api` with `page.route` and answers with
 * fixtures. That keeps `.dev.vars` untouched (AGENTS.md §6.1) and lets the shell
 * be tested on a fresh machine.
 */

/** Fictional, so no real personal data is versioned (AGENTS.md §6.5). */
export const SESSION_EMAIL = "owner@nexus.test";

const TACTILE_MIN_PX = 44;

/** Browsers report fractional boxes, so a strict `>= 44` fails intermittently. */
const TACTILE_TOLERANCE_PX = 0.5;

export async function stubApi(page: Page): Promise<void> {
	await page.route("**/api/**", async (route) => {
		const { pathname } = new URL(route.request().url());
		const body = pathname.endsWith("/api/me")
			? { user: { email: SESSION_EMAIL } }
			: { status: "ok" };

		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(body),
		});
	});
}

/**
 * Navigates and waits for the shell to be on screen.
 *
 * The shell is code-split and hydrated after the first paint, so a check that
 * runs straight after `goto` would measure an empty document and pass for the
 * wrong reason.
 */
export async function gotoRoute(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await expect(page.locator("[data-slot='view-header'] h1")).toBeVisible();
}

/**
 * docs/DESIGN.md §6: no horizontal page scroll.
 *
 * The document check on its own is not enough: the shell root is
 * `overflow-hidden` on purpose, so an element that is too wide gets *clipped*
 * instead of making the document scroll, and `scrollWidth` stays at the window
 * width. Clipped content is exactly the defect this rule exists to catch, so the
 * second half looks for any box that sticks out past the viewport.
 */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
	const { scrollWidth, innerWidth, offenders } = await page.evaluate(() => {
		const offenders: string[] = [];

		for (const element of document.querySelectorAll<HTMLElement>("body *")) {
			const rect = element.getBoundingClientRect();
			if (rect.width === 0 && rect.height === 0) {
				continue;
			}
			if (rect.right > window.innerWidth + 0.5 || rect.left < -0.5) {
				const name = `${element.tagName.toLowerCase()}${
					element.getAttribute("data-slot") === null
						? ""
						: `[data-slot="${element.getAttribute("data-slot")}"]`
				}`;
				offenders.push(`${name} (${Math.round(rect.left)}→${Math.round(rect.right)})`);
			}
		}

		return {
			scrollWidth: document.documentElement.scrollWidth,
			innerWidth: window.innerWidth,
			offenders: offenders.slice(0, 5),
		};
	});

	expect(
		scrollWidth,
		`la página hace scroll horizontal a ${innerWidth}px de ancho`,
	).toBeLessThanOrEqual(innerWidth);

	expect(
		offenders,
		`elementos que sobresalen del viewport de ${innerWidth}px: ${offenders.join(", ")}`,
	).toEqual([]);
}

/** docs/DESIGN.md §6: the view's primary action is reachable without scrolling. */
export async function expectVisibleWithoutScrolling(page: Page, target: Locator): Promise<void> {
	await expect(target).toBeVisible();

	const box = await target.boundingBox();
	const viewport = page.viewportSize();

	expect(box, "el elemento no tiene caja de layout").not.toBeNull();
	expect(viewport, "el proyecto de Playwright no tiene viewport").not.toBeNull();

	if (box === null || viewport === null) {
		return;
	}

	expect(box.y, "el elemento queda por encima del viewport").toBeGreaterThanOrEqual(0);
	expect(
		box.y + box.height,
		"el elemento queda por debajo del viewport, hay que desplazarse",
	).toBeLessThanOrEqual(viewport.height);
}

/** docs/DESIGN.md §6: main interactive elements are at least 44 × 44 px. */
export async function expectTactileTargets(targets: Locator): Promise<void> {
	await targets.first().waitFor();

	const count = await targets.count();
	expect(count, "no hay elementos interactivos que medir").toBeGreaterThan(0);

	const measured = await targets.evaluateAll((nodes) =>
		nodes.map((node) => {
			const element = node as HTMLElement;
			const rect = element.getBoundingClientRect();
			return {
				label:
					element.getAttribute("aria-label") ??
					element.textContent?.trim().slice(0, 40) ??
					element.tagName.toLowerCase(),
				height: rect.height,
				width: rect.width,
			};
		}),
	);

	for (const target of measured) {
		expect(target.height, `altura del área táctil de "${target.label}"`).toBeGreaterThanOrEqual(
			TACTILE_MIN_PX - TACTILE_TOLERANCE_PX,
		);
		expect(target.width, `anchura del área táctil de "${target.label}"`).toBeGreaterThanOrEqual(
			TACTILE_MIN_PX - TACTILE_TOLERANCE_PX,
		);
	}
}

export const test = base.extend({
	page: async ({ page }, use) => {
		await stubApi(page);
		await use(page);
	},
});

export { expect };
