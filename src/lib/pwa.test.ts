import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { THEME_COLORS } from "./theme";

/**
 * The installable app is static files, so it is tested as files
 * (add-pwa design.md D2–D4): the manifest has what Chrome needs, its colours are
 * the palette's, and every PNG it declares exists with the size it claims.
 * Paths are built with `fileURLToPath` for the reason given in contrast.test.ts.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path: string) => readFileSync(resolve(root, path));

type Manifest = {
	name: string;
	short_name: string;
	start_url: string;
	scope: string;
	display: string;
	lang: string;
	background_color: string;
	theme_color: string;
	icons: { src: string; sizes: string; type: string; purpose: string }[];
};

const manifest = JSON.parse(read("public/manifest.webmanifest").toString("utf8")) as Manifest;
const indexCss = read("src/index.css").toString("utf8");
const indexHtml = read("index.html").toString("utf8");

/** `--background` of `:root` or `.dark`, straight from the stylesheet. */
function background(selector: ":root" | ".dark"): string {
	const block = indexCss.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`))?.[1];
	return block?.match(/--background:\s*(#[0-9a-f]{6})/i)?.[1]?.toLowerCase() ?? "";
}

/** Width and height from the IHDR chunk, which always starts at byte 16. */
function pngSize(path: string): string {
	const png = read(path);
	expect(png.subarray(1, 4).toString("ascii"), `${path} is not a PNG`).toBe("PNG");
	return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
}

describe("the manifest", () => {
	it("makes Nexus a standalone app that starts at its root", () => {
		expect(manifest).toMatchObject({
			name: "Nexus",
			short_name: "Nexus",
			start_url: "/",
			scope: "/",
			display: "standalone",
			lang: "es",
		});
	});

	it("uses the light theme's background, the colour of the splash screen", () => {
		expect(background(":root")).toBe(THEME_COLORS.light);
		expect(manifest.background_color).toBe(THEME_COLORS.light);
		expect(manifest.theme_color).toBe(THEME_COLORS.light);
	});

	it("declares 192, 512 and a maskable 512, each with the size it claims", () => {
		expect(manifest.icons.map((icon) => `${icon.sizes} ${icon.purpose}`)).toEqual([
			"192x192 any",
			"512x512 any",
			"512x512 maskable",
		]);
		for (const icon of manifest.icons) {
			expect(pngSize(`public${icon.src}`), icon.src).toBe(icon.sizes);
		}
	});
});

describe("the document", () => {
	it("links the manifest, the icons and a theme-color", () => {
		// With the session cookie, or Access answers the manifest with its login page.
		expect(indexHtml).toContain(
			'<link rel="manifest" href="/manifest.webmanifest" crossorigin="use-credentials" />',
		);
		expect(indexHtml).toContain('<link rel="icon" href="/favicon.svg"');
		expect(indexHtml).toContain(
			'<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />',
		);
		expect(indexHtml).toContain(`<meta name="theme-color" content="${THEME_COLORS.light}" />`);
		expect(pngSize("public/icons/apple-touch-icon.png")).toBe("180x180");
	});

	it("keeps the dark theme-color equal to the dark background", () => {
		expect(background(".dark")).toBe(THEME_COLORS.dark);
	});

	it("registers no service worker anywhere in the app (ADR-011)", () => {
		const sources = readdirSync(resolve(root, "src"), { recursive: true, encoding: "utf8" })
			.filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith(".test.ts"))
			.filter((file) => read(`src/${file}`).toString("utf8").includes("serviceWorker"));

		expect(sources).toEqual([]);
		expect(indexHtml).not.toMatch(/serviceWorker/);
	});
});
