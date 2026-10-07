import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { DARK_SCHEME_QUERY, THEME_STORAGE_KEY } from "@/lib/theme";
import { ThemeProvider, useTheme } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

/**
 * The class on `<html>` is the contract with the CSS: `.dark` is what the
 * `dark:` variants and the `.dark` token block react to, so these tests assert
 * on the element itself rather than on a rendered style.
 */

const originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
const originalMatchMedia = window.matchMedia;

let mediaListeners: ((event: MediaQueryListEvent) => void)[] = [];
let mediaMatches = false;

/**
 * jsdom has no `matchMedia`, so it is stubbed with one whose `matches` can be
 * flipped at will: that is how "follows the system" is asserted without
 * reloading.
 */
function stubEnvironment(storedValue?: string) {
	const values = new Map<string, string>();
	if (storedValue !== undefined) {
		values.set(THEME_STORAGE_KEY, storedValue);
	}

	mediaListeners = [];
	mediaMatches = false;

	const storage = {
		length: 0,
		clear: () => values.clear(),
		getItem: (key: string) => values.get(key) ?? null,
		key: () => null,
		removeItem: (key: string) => values.delete(key),
		setItem: (key: string, value: string) => values.set(key, value),
	} satisfies Storage;

	Object.defineProperty(window, "localStorage", { configurable: true, value: storage });

	window.matchMedia = (query: string) =>
		({
			matches: query === DARK_SCHEME_QUERY && mediaMatches,
			media: query,
			addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
				mediaListeners.push(listener);
			},
			removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
				mediaListeners = mediaListeners.filter((registered) => registered !== listener);
			},
		}) as unknown as MediaQueryList;

	return values;
}

function changeSystemPreference(prefersDark: boolean) {
	mediaMatches = prefersDark;
	act(() => {
		for (const listener of mediaListeners) {
			listener({ matches: prefersDark } as MediaQueryListEvent);
		}
	});
}

afterEach(() => {
	cleanup();
	if (originalLocalStorage) {
		Object.defineProperty(window, "localStorage", originalLocalStorage);
	}
	window.matchMedia = originalMatchMedia;
	document.documentElement.classList.remove("dark", "light");
});

describe("ThemeProvider", () => {
	it("puts the class the system asks for on <html>", () => {
		stubEnvironment();
		mediaMatches = true;

		render(
			<ThemeProvider>
				<p>contenido</p>
			</ThemeProvider>,
		);

		expect(document.documentElement).toHaveClass("dark");
	});

	it("follows the system while nobody has chosen a theme", () => {
		stubEnvironment();

		render(
			<ThemeProvider>
				<p>contenido</p>
			</ThemeProvider>,
		);

		expect(document.documentElement).toHaveClass("light");

		changeSystemPreference(true);

		expect(document.documentElement).toHaveClass("dark");
	});

	it("remembers a manual choice and stops following the system", async () => {
		const user = userEvent.setup();
		const values = stubEnvironment();

		render(
			<ThemeProvider>
				<ThemeToggle />
			</ThemeProvider>,
		);

		await user.click(screen.getByRole("button", { name: "Claro" }));

		expect(document.documentElement).toHaveClass("light");
		expect(values.get(THEME_STORAGE_KEY)).toBe("light");

		changeSystemPreference(true);

		expect(document.documentElement).toHaveClass("light");
		expect(document.documentElement).not.toHaveClass("dark");
	});

	it("paints the stored choice on a later visit", () => {
		stubEnvironment("dark");

		render(
			<ThemeProvider>
				<p>contenido</p>
			</ThemeProvider>,
		);

		expect(document.documentElement).toHaveClass("dark");
	});

	it("goes back to following the system when 'Sistema' is chosen again", async () => {
		const user = userEvent.setup();
		const values = stubEnvironment("light");

		render(
			<ThemeProvider>
				<ThemeToggle />
			</ThemeProvider>,
		);

		expect(document.documentElement).toHaveClass("light");

		await user.click(screen.getByRole("button", { name: "Sistema" }));

		expect(values.get(THEME_STORAGE_KEY)).toBe("system");
		expect(document.documentElement).toHaveClass("light");

		changeSystemPreference(true);

		expect(document.documentElement).toHaveClass("dark");
	});
});

describe("ThemeToggle", () => {
	it("marks the active option with aria-pressed", async () => {
		const user = userEvent.setup();
		stubEnvironment();

		render(
			<ThemeProvider>
				<ThemeToggle />
			</ThemeProvider>,
		);

		const system = screen.getByRole("button", { name: "Sistema" });
		const dark = screen.getByRole("button", { name: "Oscuro" });

		expect(system).toHaveAttribute("aria-pressed", "true");
		expect(dark).toHaveAttribute("aria-pressed", "false");

		await user.click(dark);

		expect(dark).toHaveAttribute("aria-pressed", "true");
		expect(system).toHaveAttribute("aria-pressed", "false");
	});

	it("fails loudly when used outside the provider", () => {
		stubEnvironment();

		expect(() => render(<ThemeToggle />)).toThrow(/ThemeProvider/);
	});
});

describe("useTheme", () => {
	it("exposes the resolved theme to consumers", () => {
		stubEnvironment();

		function Probe() {
			const { resolved } = useTheme();
			return <span>{resolved}</span>;
		}

		render(
			<ThemeProvider>
				<Probe />
			</ThemeProvider>,
		);

		expect(screen.getByText("light")).toBeInTheDocument();
	});
});
