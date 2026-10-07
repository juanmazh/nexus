import { NavLink } from "react-router";
import { NAV_ITEMS } from "@/app/navigation";
import { cn } from "@/lib/utils";

/**
 * Navigation below 1024 px, at the bottom of the screen where the thumb reaches
 * (docs/DESIGN.md §1.1). Four sections is the maximum that still gives each tab
 * 44 px and a readable label at 320 px.
 *
 * It only renders in its own range of viewports, instead of always being in the
 * DOM with a class that hides it: two navigation trees would mean two sets of
 * focus targets, and the hidden one would still be reachable.
 */
export function TabBar() {
	return (
		<nav
			data-slot="tab-bar"
			aria-label="Secciones"
			className="shrink-0 border-t border-border bg-background"
		>
			<ul className="flex items-stretch pb-[env(safe-area-inset-bottom)]">
				{NAV_ITEMS.map(({ to, label, icon: Icon }) => (
					<li key={to} className="min-w-0 flex-1">
						{/* NavLink marks the active section with aria-current="page", so it is
					    identifiable without relying on the colour being seen. */}
						<NavLink
							to={to}
							end={to === "/"}
							className={({ isActive }) =>
								cn(
									"flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-center text-xs font-medium",
									isActive ? "text-primary" : "text-muted-foreground",
								)
							}
						>
							<Icon aria-hidden="true" className="size-5" />
							<span className="truncate">{label}</span>
						</NavLink>
					</li>
				))}
			</ul>
		</nav>
	);
}
