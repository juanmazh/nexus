import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { activePath, NAV_ITEMS } from "./navigation";

/**
 * The tab bar and the sidebar both walk `NAV_ITEMS`, so a duplicate path or a
 * missing icon would show up in the navigation itself, not in one of the two
 * renderings.
 */

afterEach(cleanup);

describe("NAV_ITEMS", () => {
	it("has the four sections of the shell", () => {
		expect(NAV_ITEMS.map((item) => item.label)).toEqual(["Hoy", "Tareas", "Notas", "Más"]);
	});

	it("gives every section its own route", () => {
		const paths = NAV_ITEMS.map((item) => item.to);

		expect(new Set(paths).size).toBe(paths.length);
	});

	it("labels every section with visible text", () => {
		for (const item of NAV_ITEMS) {
			expect(item.label.trim()).not.toBe("");
		}
	});

	it("gives every section an icon that renders", () => {
		for (const item of NAV_ITEMS) {
			const Icon = item.icon;
			const { container, unmount } = render(<Icon aria-hidden="true" />);

			expect(container.querySelector("svg"), `${item.label} sin icono`).not.toBeNull();
			unmount();
		}
	});

	it("starts at Hoy, the root of the application", () => {
		expect(NAV_ITEMS[0]?.to).toBe("/");
	});
});

describe("activePath", () => {
	it("recognises each of its own sections", () => {
		for (const item of NAV_ITEMS) {
			expect(activePath(item.to)).toBe(item.to);
		}
	});

	it("falls back to Hoy for a route that is not a section", () => {
		expect(activePath("/no-existe")).toBe("/");
	});
});
