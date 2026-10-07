import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The palette is documented in hexadecimals (docs/DESIGN.md §5) and checked here
 * against WCAG, so changing a colour to something prettier fails `pnpm test`
 * instead of failing a screen (design.md D6). Reading the stylesheet as text
 * means there is no second copy of the palette to drift.
 *
 * It is read from disk rather than with `import ... from "index.css?raw"`: in
 * this Vite setup a `?raw` import of a stylesheet resolves to an empty string,
 * which would make every assertion below pass without checking anything. The
 * path is built with `fileURLToPath` because jsdom replaces the global `URL`, and
 * `readFileSync` then rejects the result of `new URL(...)` as not a `file:` URL.
 */
const here = dirname(fileURLToPath(import.meta.url));
const indexCss = readFileSync(resolve(here, "../index.css"), "utf8");

/** WCAG 2.2 AA for text. */
const AA_TEXT = 4.5;

/** WCAG 1.4.11 for graphics and focus indicators: the "now" marker, the ring. */
const AA_NON_TEXT = 3;

type ThemeName = "light" | "dark";
type Tokens = Record<string, string>;

const TEXT_PAIRS: { foreground: string; background: string }[] = [
	{ foreground: "foreground", background: "background" },
	{ foreground: "muted-foreground", background: "background" },
	{ foreground: "muted-foreground", background: "muted" },
	{ foreground: "primary-foreground", background: "primary" },
	{ foreground: "accent-foreground", background: "accent" },
	{ foreground: "destructive", background: "background" },
];

const NON_TEXT_PAIRS: { foreground: string; background: string }[] = [
	{ foreground: "accent-strong", background: "background" },
	{ foreground: "ring", background: "background" },
];

/**
 * Every custom property of one selector, keyed without the leading `--`, so the
 * checks below read `--foreground` / `--background` as `foreground` / `background`.
 * Blocks with the same selector are merged, which is what the cascade does.
 */
function readTokens(selector: string): Tokens {
	const tokens: Tokens = {};
	// Comments go first: one sitting above a declaration would otherwise be read
	// as that declaration's name.
	const css = indexCss.replace(/\/\*[\s\S]*?\*\//g, "");
	const blockPattern = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`, "g");

	for (const match of css.matchAll(blockPattern)) {
		const body = match[1];
		if (body === undefined) {
			continue;
		}
		for (const declaration of body.split(";")) {
			const [rawName, value] = declaration.split(":").map((part) => part.trim());
			const name = rawName?.startsWith("--") ? rawName.slice(2) : undefined;
			if (name !== undefined && name !== "" && value !== undefined && value !== "") {
				tokens[name] = value;
			}
		}
	}

	return tokens;
}

const lightTokens = readTokens(":root");
const darkTokens = { ...lightTokens, ...readTokens(".dark") };

const THEMES: { name: ThemeName; tokens: Tokens }[] = [
	{ name: "light", tokens: lightTokens },
	{ name: "dark", tokens: darkTokens },
];

function toLinear(channel: number): number {
	const ratio = channel / 255;
	return ratio <= 0.04045 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
	const digits = hex.trim().replace("#", "");
	const full =
		digits.length === 3
			? digits
					.split("")
					.map((digit) => `${digit}${digit}`)
					.join("")
			: digits;

	const [red = 0, green = 0, blue = 0] = [
		Number.parseInt(full.slice(0, 2), 16),
		Number.parseInt(full.slice(2, 4), 16),
		Number.parseInt(full.slice(4, 6), 16),
	];

	return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
}

function contrastRatio(foreground: string, background: string): number {
	const foregroundLuminance = relativeLuminance(foreground);
	const backgroundLuminance = relativeLuminance(background);
	const lighter = Math.max(foregroundLuminance, backgroundLuminance);
	const darker = Math.min(foregroundLuminance, backgroundLuminance);
	return (lighter + 0.05) / (darker + 0.05);
}

describe.each(THEMES)("palette tokens in $name mode", ({ name, tokens }) => {
	it("declares the colours of docs/DESIGN.md §5", () => {
		for (const token of [
			"background",
			"foreground",
			"primary",
			"accent",
			"accent-strong",
			"muted",
			"muted-foreground",
			"destructive",
			"border",
			"input",
			"ring",
		]) {
			expect(tokens[token], `--${token} missing in ${name} mode`).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});

	it.each(TEXT_PAIRS)(
		`keeps --${"$foreground"} on --${"$background"} at AA`,
		({ foreground, background }) => {
			const ratio = contrastRatio(tokens[foreground] ?? "", tokens[background] ?? "");

			expect(
				ratio,
				`--${foreground} (${tokens[foreground]}) on --${background} (${tokens[background]}): ${ratio.toFixed(2)}:1`,
			).toBeGreaterThanOrEqual(AA_TEXT);
		},
	);

	it.each(NON_TEXT_PAIRS)(
		`keeps --${"$foreground"} on --${"$background"} at 3:1`,
		({ foreground, background }) => {
			const ratio = contrastRatio(tokens[foreground] ?? "", tokens[background] ?? "");

			expect(
				ratio,
				`--${foreground} (${tokens[foreground]}) on --${background} (${tokens[background]}): ${ratio.toFixed(2)}:1`,
			).toBeGreaterThanOrEqual(AA_NON_TEXT);
		},
	);
});

describe("the guard itself", () => {
	it("fails for tinta at 55 % as muted-foreground, which is why 70 % was chosen", () => {
		// #7F837B is tinta (#1E2419) at 55 % over cal (#F6F7F2): the tempting value
		// gives 3,6:1 on background and 3,1:1 over piedra, both under AA.
		expect(contrastRatio("#7f837b", "#f6f7f2")).toBeLessThan(AA_TEXT);
		expect(contrastRatio("#7f837b", "#e4e6dd")).toBeLessThan(AA_TEXT);

		// The value in the stylesheet passes.
		expect(contrastRatio("#5f635a", "#f6f7f2")).toBeGreaterThanOrEqual(AA_TEXT);
		expect(contrastRatio("#5f635a", "#e4e6dd")).toBeGreaterThanOrEqual(AA_TEXT);
	});
});
