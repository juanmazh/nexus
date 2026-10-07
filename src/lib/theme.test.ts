import { afterEach, describe, expect, it } from "vitest";
import {
	applyTheme,
	DARK_SCHEME_QUERY,
	readStoredPreference,
	resolveTheme,
	THEME_STORAGE_KEY,
} from "./theme";

/**
 * `resolveTheme` is the decision and `applyTheme` is the effect, so both are
 * covered: the first without any DOM, the second against a document whose
 * `localStorage` and `matchMedia` are controlled, including the private-mode
 * case where the storage throws.
 */

const originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
const originalMatchMedia = window.matchMedia;

interface StubOptions {
	prefersDark?: boolean;
	throwOnGet?: boolean;
	throwOnSet?: boolean;
}

function stubEnvironment(options: StubOptions = {}) {
	const values = new Map<string, string>();

	const storage = {
		length: 0,
		clear: () => values.clear(),
		getItem: (key: string) => {
			if (options.throwOnGet === true) {
				throw new Error("storage blocked");
			}
			return values.get(key) ?? null;
		},
		key: () => null,
		removeItem: (key: string) => values.delete(key),
		setItem: (key: string, value: string) => {
			if (options.throwOnSet === true) {
				throw new Error("storage blocked");
			}
			values.set(key, value);
		},
	} satisfies Storage;

	Object.defineProperty(window, "localStorage", { configurable: true, value: storage });

	if (options.prefersDark !== undefined) {
		window.matchMedia = (query: string) =>
			({
				matches: query === DARK_SCHEME_QUERY && options.prefersDark === true,
				media: query,
				addEventListener: () => {},
				removeEventListener: () => {},
			}) as unknown as MediaQueryList;
	}

	return values;
}

afterEach(() => {
	if (originalLocalStorage) {
		Object.defineProperty(window, "localStorage", originalLocalStorage);
	}
	window.matchMedia = originalMatchMedia;
	document.documentElement.classList.remove("dark", "light");
});

describe("resolveTheme", () => {
	it("follows the system while there is no manual choice", () => {
		expect(resolveTheme(null, false)).toBe("light");
		expect(resolveTheme(null, true)).toBe("dark");
		expect(resolveTheme("system", false)).toBe("light");
		expect(resolveTheme("system", true)).toBe("dark");
	});

	it("lets a manual choice win over the system preference", () => {
		expect(resolveTheme("light", true)).toBe("light");
		expect(resolveTheme("dark", false)).toBe("dark");
	});
});

describe("applyTheme", () => {
	it("paints the system preference when nothing has been chosen", () => {
		stubEnvironment({ prefersDark: true });

		expect(applyTheme(document)).toBe("dark");
		expect(document.documentElement).toHaveClass("dark");
		expect(document.documentElement).not.toHaveClass("light");
		expect(readStoredPreference(document)).toBeNull();
	});

	it("paints and remembers a manual choice", () => {
		stubEnvironment({ prefersDark: true });

		expect(applyTheme(document, "light")).toBe("light");
		expect(document.documentElement).toHaveClass("light");
		expect(document.documentElement).not.toHaveClass("dark");

		// A later bare call (a reload) reads the choice back from storage.
		document.documentElement.classList.remove("light", "dark");
		expect(applyTheme(document)).toBe("light");
		expect(document.documentElement).toHaveClass("light");
	});

	it("writes the preference under nexus:theme", () => {
		const values = stubEnvironment();

		applyTheme(document, "dark");

		expect(values.get(THEME_STORAGE_KEY)).toBe("dark");
	});

	it("falls back to the system when localStorage throws on read", () => {
		stubEnvironment({ prefersDark: true, throwOnGet: true });

		expect(applyTheme(document, undefined, undefined)).toBe("dark");
		expect(document.documentElement).toHaveClass("dark");
		expect(readStoredPreference(document)).toBeNull();
	});

	it("still paints when localStorage throws on write", () => {
		stubEnvironment({ prefersDark: false, throwOnSet: true });

		expect(() => applyTheme(document, "dark")).not.toThrow();
		expect(document.documentElement).toHaveClass("dark");
	});

	it("ignores a stored value that is not a theme", () => {
		const values = stubEnvironment({ prefersDark: true });
		values.set(THEME_STORAGE_KEY, "sepia");

		expect(readStoredPreference(document)).toBeNull();
		expect(applyTheme(document)).toBe("dark");
	});
});
