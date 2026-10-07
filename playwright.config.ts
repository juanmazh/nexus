import { defineConfig, devices } from "@playwright/test";

/**
 * The responsive suite (docs/DESIGN.md §6) runs against the built assets served by
 * `vite preview`, not against `pnpm dev`: `preview` is the only mode where the
 * static assets manager applies `public/_headers`, so a CSP or `base` regression
 * shows up here (design.md D8).
 *
 * Only Chromium: Firefox and WebKit would multiply the CI time without finding a
 * bug that the mobile-first rules describe (design.md D10).
 */
export const PREVIEW_PORT = 4173;

export default defineConfig({
	testDir: "e2e",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? "github" : "list",
	use: {
		baseURL: `http://localhost:${PREVIEW_PORT}`,
		locale: "es-ES",
		timezoneId: "Europe/Madrid",
	},
	projects: [
		{
			name: "mobile",
			// A real device descriptor with the reference viewport of
			// docs/DESIGN.md §2 forced on top, so the project reports `isMobile`
			// and emulates touch instead of pretending to be a narrow desktop.
			use: { ...devices["Pixel 5"], viewport: { width: 360, height: 780 } },
		},
		{
			name: "desktop",
			use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
		},
	],
	webServer: {
		command: `pnpm build && pnpm exec vite preview --port ${PREVIEW_PORT} --strictPort`,
		url: `http://localhost:${PREVIEW_PORT}`,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
	},
});
