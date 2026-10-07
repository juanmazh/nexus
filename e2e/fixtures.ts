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

/** The row the API returns. Kept loose on purpose: the stub is not the contract. */
export type StubTask = {
	id: string;
	title: string;
	notes: string | null;
	status: "todo" | "done";
	priority: "low" | "medium" | "high";
	due_at: number | null;
	completed_at: number | null;
	created_at: number;
	updated_at: number;
};

/** A fictional task, so the fixtures carry no real personal data (AGENTS.md §6.5). */
export function stubTask(overrides: Partial<StubTask> = {}): StubTask {
	const now = Date.now();
	return {
		id: crypto.randomUUID(),
		title: "Tarea de ejemplo",
		notes: null,
		status: "todo",
		priority: "medium",
		due_at: null,
		completed_at: null,
		created_at: now,
		updated_at: now,
		...overrides,
	};
}

/** `YYYY-MM-DD` → 00:00 of that day in Madrid, close enough for a stub. */
function dueDateToMs(date: string | null | undefined): number | null {
	return date ? new Date(`${date}T00:00:00+02:00`).getTime() : null;
}

/**
 * Stubs every request under `/api`. `/api/tasks` is backed by an in-memory array
 * per test (design.md D15): a task created by a step must still be there in the
 * next one, or the suite would be testing the mock and not the app. The array is
 * returned so a test can seed it or look at it.
 */
export async function stubApi(page: Page, tasks: StubTask[] = []): Promise<StubTask[]> {
	await page.route("**/api/**", async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const { pathname } = url;
		const json = (status: number, body?: unknown) =>
			route.fulfill({
				status,
				contentType: "application/json",
				body: body === undefined ? "" : JSON.stringify(body),
			});
		const notFound = () =>
			json(404, { error: { code: "not_found", message: "Esta tarea ya no existe." } });

		if (pathname.endsWith("/api/me")) {
			return json(200, { user: { email: SESSION_EMAIL } });
		}

		if (pathname.endsWith("/api/tasks")) {
			if (request.method() === "POST") {
				const body = request.postDataJSON() as { title: string };
				const task = stubTask({ title: body.title.trim() });
				tasks.push(task);
				return json(201, task);
			}
			const status = url.searchParams.get("status") ?? "todo";
			return json(
				200,
				tasks.filter((task) => task.status === status),
			);
		}

		const id = pathname.match(/\/api\/tasks\/([^/]+)$/)?.[1];
		if (id !== undefined) {
			const index = tasks.findIndex((task) => task.id === id);
			const task = tasks[index];
			if (task === undefined) {
				return notFound();
			}
			if (request.method() === "DELETE") {
				tasks.splice(index, 1);
				return route.fulfill({ status: 204 });
			}
			const patch = request.postDataJSON() as Partial<StubTask> & { due_date?: string | null };
			const now = Date.now();
			const { due_date, ...fields } = patch;
			const updated: StubTask = {
				...task,
				...fields,
				...(due_date === undefined ? {} : { due_at: dueDateToMs(due_date) }),
				completed_at:
					patch.status === "done"
						? (task.completed_at ?? now)
						: patch.status === "todo"
							? null
							: task.completed_at,
				updated_at: now,
			};
			tasks[index] = updated;
			return json(200, updated);
		}

		return json(200, { status: "ok" });
	});

	return tasks;
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
			// Visually hidden on purpose (`sr-only`, Base UI's focus guards): clipped
			// to nothing, so it paints nothing that could be cut off. A real scroll
			// would still be caught by the `scrollWidth` check below.
			const style = getComputedStyle(element);
			if (style.clip === "rect(0px, 0px, 0px, 0px)" || style.clipPath === "inset(50%)") {
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

export const test = base.extend<{ tasks: StubTask[] }>({
	// Automatic, so every test runs against the stub whether it reads the array
	// or not. One array per test: seed it before navigating, read it after acting.
	tasks: [
		async ({ page }, use) => {
			await use(await stubApi(page));
		},
		{ auto: true },
	],
});

export { expect };
