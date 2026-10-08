// Regenerates the PNG icons of the PWA from public/icons/icon.svg
// (add-pwa design.md D3). Run it only when the design changes:
//
//   node scripts/icons.mjs
//
// It renders with the Chromium that Playwright already installs, so it needs no
// image library. CHROMIUM_PATH points it at another binary if needed.
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const root = new URL("../public/icons/", import.meta.url);
const source = await readFile(new URL("icon.svg", root), "utf8");

// The maskable icon is cut by the launcher (a circle, a squircle…), so it has
// no rounded corners of its own and its background bleeds to the edge. The
// letter already sits inside the central 80 %, the safe zone.
const fullBleed = source.replace('rx="112"', 'rx="0"');

const outputs = [
	{ file: "icon-192.png", size: 192, svg: source },
	{ file: "icon-512.png", size: 512, svg: source },
	{ file: "icon-maskable-512.png", size: 512, svg: fullBleed },
	{ file: "apple-touch-icon.png", size: 180, svg: fullBleed },
];

const browser = await chromium.launch(
	process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
try {
	for (const { file, size, svg } of outputs) {
		const page = await browser.newPage({ viewport: { width: size, height: size } });
		const sized = svg.replace("<svg ", `<svg width="${size}" height="${size}" `);
		await page.setContent(
			`<html><body style="margin:0;background:transparent">${sized}</body></html>`,
		);
		const png = await page.screenshot({ omitBackground: true, type: "png" });
		await writeFile(new URL(file, root), png);
		await page.close();
		console.log(`${file} (${size} px)`);
	}
} finally {
	await browser.close();
}
