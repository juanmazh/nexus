import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { ToastHost } from "@/components/toast-host";
import { useIsDesktop } from "@/lib/use-media-query";
import { CaptureBar } from "./capture-bar";
import { Sidebar } from "./sidebar";
import { TabBar } from "./tab-bar";

/**
 * The shell of the application: fixed height, scroll inside, navigation and
 * capture always in the same place (docs/DESIGN.md §3).
 *
 * `h-dvh` and `overflow-hidden` on the root are what make the document itself
 * never scroll, which is the only way `documentElement.scrollWidth` stays at the
 * window width and the capture bar stays within thumb reach. `min-h-0` on the
 * scrolling column is not optional: without it a `flex-1` refuses to shrink below
 * its content and the overflow escapes to the document (design.md, layout).
 *
 * `Sidebar` and `TabBar` are two components rather than one with conditional
 * classes because each one is mounted only in its own range of viewport: two
 * navigation trees in the DOM would mean two sets of focus stops, and the one
 * that is "hidden" would still be reachable (design.md D2). The same reasoning
 * places the capture bar in two positions, chosen here and not in CSS, so which
 * one exists depends on the viewport and not on a breakpoint.
 *
 * The page owns its own `ViewHeader`, sticky at the top of the scrolling column,
 * so the title of the section is always visible and each section can put its own
 * one action there (the theme switcher in "Más").
 */
export function AppShell() {
	const isDesktop = useIsDesktop();
	const scrollRef = useRef<HTMLDivElement>(null);
	const { pathname } = useLocation();

	// A new section starts at its own beginning, never halfway down.
	// biome-ignore lint/correctness/useExhaustiveDependencies: `pathname` is the trigger, not something the body reads
	useEffect(() => {
		scrollRef.current?.scrollTo({ top: 0 });
	}, [pathname]);

	return (
		<div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
			{isDesktop ? <Sidebar /> : null}

			<div className="flex min-h-0 min-w-0 flex-1 flex-col">
				{isDesktop ? (
					<header
						data-slot="app-header"
						className="shrink-0 border-b border-border bg-background pt-[env(safe-area-inset-top)]"
					>
						<CaptureBar placeholder="Añade una tarea…" className="border-t-0" />
					</header>
				) : null}

				<main
					ref={scrollRef}
					data-slot="app-content"
					className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
				>
					{/* A list stretched to 1,900 px cannot be read (docs/DESIGN.md §3). */}
					<div className="mx-auto w-full max-w-2xl pb-6">
						<Outlet />
					</div>
				</main>

				{isDesktop ? null : <CaptureBar placeholder="Añade una tarea…" />}

				{isDesktop ? null : <TabBar />}
			</div>

			{/* One host for the whole application, mounted above every page. */}
			<ToastHost />
		</div>
	);
}
