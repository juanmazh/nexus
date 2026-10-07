import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The plugin creates a Vite environment for the Worker ("nexus") next to the
// SPA's client environment, so `pnpm dev` serves both from one origin.
export default defineConfig({
	plugins: [react(), tailwindcss(), cloudflare()],
	resolve: {
		// Declared once here: Vite applies them to both environments. The same
		// aliases are repeated in the tsconfig `paths` for the type checker and in
		// vitest.web.config.ts for the tests.
		alias: [
			{ find: /^@\//, replacement: `${fileURLToPath(new URL("./src", import.meta.url))}/` },
			{
				find: /^@shared\//,
				replacement: `${fileURLToPath(new URL("./shared", import.meta.url))}/`,
			},
		],
	},
});
