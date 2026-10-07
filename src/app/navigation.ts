import type { LucideIcon } from "lucide-react";
import { CalendarCheckIcon, ListTodoIcon, MoreHorizontalIcon, NotebookPenIcon } from "lucide-react";

export type NavItem = {
	/** Route path, which is also how the active section is matched. */
	to: string;
	label: string;
	icon: LucideIcon;
};

/**
 * One list for the whole application (design.md D2). `TabBar` and `Sidebar` both
 * walk it, so the two navigations cannot drift apart, which is the classic bug
 * of this pattern. Adding a section is one entry here plus one route.
 *
 * Four sections and no more: the bottom tab bar fits four at 44 px each without
 * truncating labels at 320 px (docs/DESIGN.md §3).
 */
export const NAV_ITEMS: NavItem[] = [
	{ to: "/", label: "Hoy", icon: CalendarCheckIcon },
	{ to: "/tasks", label: "Tareas", icon: ListTodoIcon },
	{ to: "/notes", label: "Notas", icon: NotebookPenIcon },
	{ to: "/more", label: "Más", icon: MoreHorizontalIcon },
];

/** Path of a section that is the active one, from the current location. */
export function activePath(pathname: string): string {
	return NAV_ITEMS.some((item) => item.to === pathname) ? pathname : "/";
}
