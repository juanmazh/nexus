import { NavLink } from "react-router";
import { NAV_ITEMS } from "@/app/navigation";
import { cn } from "@/lib/utils";

/**
 * The same four sections as the tab bar, in a column, from 1024 px up
 * (design.md D2). It walks the same `NAV_ITEMS`, so the two navigations cannot
 * fall out of step.
 *
 * The list is taller than the visible column when the window is short, so the
 * column scrolls on its own and never pushes the capture bar out of the header.
 */
export function Sidebar() {
	return (
		<nav
			data-slot="sidebar"
			aria-label="Secciones"
			className="flex h-full min-h-0 w-56 shrink-0 flex-col border-r border-border bg-muted/40"
		>
			<p className="shrink-0 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 font-heading text-xl font-semibold tracking-tight text-foreground">
				Nexus
			</p>
			<ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
				{NAV_ITEMS.map(({ to, label, icon: Icon }) => (
					<li key={to}>
						<NavLink
							to={to}
							end={to === "/"}
							className={({ isActive }) =>
								cn(
									"flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-base font-medium",
									isActive
										? "bg-sidebar-accent text-sidebar-accent-foreground"
										: "text-muted-foreground",
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
