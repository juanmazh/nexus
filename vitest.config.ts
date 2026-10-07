import { defineConfig } from "vitest/config";

// Two separate project files instead of two inline projects: the Cloudflare
// plugin has to live in the `plugins` of the project that uses it, and separate
// files keep each environment explicit. Project config files do not inherit
// options from this one, so each project declares its own aliases.
export default defineConfig({
	test: {
		projects: ["./vitest.worker.config.ts", "./vitest.web.config.ts"],
	},
});
