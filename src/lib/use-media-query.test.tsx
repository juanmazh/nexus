import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DESKTOP_QUERY, useIsDesktop, useMediaQuery } from "./use-media-query";

/**
 * jsdom has no `matchMedia`, so it is stubbed with one whose `matches` can be
 * flipped: that is how "the overlay swaps when the window crosses 1024 px" is
 * asserted without resizing anything.
 */

const originalMatchMedia = window.matchMedia;

let listeners: (() => void)[] = [];
let matches = false;
let addCalls = 0;
let removeCalls = 0;

function stubMatchMedia() {
	listeners = [];
	matches = false;
	addCalls = 0;
	removeCalls = 0;

	window.matchMedia = (query: string) =>
		({
			matches: query === DESKTOP_QUERY && matches,
			media: query,
			addEventListener: (_: string, listener: () => void) => {
				addCalls += 1;
				listeners.push(listener);
			},
			removeEventListener: (_: string, listener: () => void) => {
				removeCalls += 1;
				listeners = listeners.filter((registered) => registered !== listener);
			},
		}) as unknown as MediaQueryList;
}

function changeViewport(matchesNow: boolean) {
	matches = matchesNow;
	act(() => {
		for (const listener of listeners) {
			listener();
		}
	});
}

function Probe({ query = DESKTOP_QUERY }: { query?: string }) {
	const value = useMediaQuery(query);
	return <span>{value ? "coincide" : "no coincide"}</span>;
}

afterEach(() => {
	cleanup();
	window.matchMedia = originalMatchMedia;
	listeners = [];
	addCalls = 0;
	removeCalls = 0;
});

describe("useMediaQuery", () => {
	it("reports the initial value", () => {
		stubMatchMedia();
		matches = true;

		render(<Probe />);

		expect(screen.getByText("coincide")).toBeInTheDocument();
	});

	it("re-renders when the media query changes", () => {
		stubMatchMedia();
		render(<Probe />);

		expect(screen.getByText("no coincide")).toBeInTheDocument();

		changeViewport(true);

		expect(screen.getByText("coincide")).toBeInTheDocument();
	});

	it("subscribes once and unsubscribes on unmount", () => {
		stubMatchMedia();
		const { unmount } = render(<Probe />);

		expect(addCalls).toBeGreaterThan(0);

		unmount();

		expect(removeCalls).toBeGreaterThan(0);
		expect(listeners).toHaveLength(0);
	});

	it("reports false when the environment has no matchMedia", () => {
		window.matchMedia = undefined as unknown as typeof window.matchMedia;

		render(<Probe />);

		expect(screen.getByText("no coincide")).toBeInTheDocument();
	});

	it("does not subscribe when the environment has no matchMedia", () => {
		window.matchMedia = undefined as unknown as typeof window.matchMedia;

		expect(() => render(<Probe />)).not.toThrow();
		expect(addCalls).toBe(0);
	});
});

describe("useIsDesktop", () => {
	it("follows the 1024 px breakpoint the shell uses", () => {
		stubMatchMedia();

		function DesktopProbe() {
			const isDesktop = useIsDesktop();
			return <span>{isDesktop ? "escritorio" : "movil"}</span>;
		}

		render(<DesktopProbe />);
		expect(screen.getByText("movil")).toBeInTheDocument();

		changeViewport(true);
		expect(screen.getByText("escritorio")).toBeInTheDocument();
	});
});
