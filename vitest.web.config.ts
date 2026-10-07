import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineProject } from "vitest/config";

export default defineProject({
	plugins: [react()],
	test: {
		name: "web",
		environment: "jsdom",
		// `shared/` holds the code the SPA and the Worker share, and its tests are
		// pure: no DOM, no network. They run here because this is the project that
		// already resolves `@shared/*`.
		include: ["src/**/*.test.{ts,tsx}", "shared/**/*.test.ts"],
		setupFiles: ["@testing-library/jest-dom/vitest"],
		// The same aliases as vite.config.ts, so a test imports exactly what the
		// SPA imports.
		alias: [
			{ find: /^@\//, replacement: `${fileURLToPath(new URL("./src", import.meta.url))}/` },
			{
				find: /^@shared\//,
				replacement: `${fileURLToPath(new URL("./shared", import.meta.url))}/`,
			},
		],
	},
});
