import { lazy } from "react";
import { createBrowserRouter } from "react-router";
import { AppShell } from "@/app/layout/app-shell";
import { NotFoundView } from "@/app/layout/not-found-view";

/**
 * The shell is a layout route, so it survives navigation instead of being torn
 * down and rebuilt: the state of the capture bar and the scroll position of the
 * content are not lost on the way from one section to the next (design.md D1).
 *
 * The four sections are `lazy()`, so the initial load stays inside the 200 KB
 * budget and a section only costs what it needs.
 */

const TodayPage = lazy(() =>
	import("@/features/today/today-page").then((module) => ({ default: module.TodayPage })),
);
const TasksPage = lazy(() =>
	import("@/features/tasks/tasks-page").then((module) => ({ default: module.TasksPage })),
);
const NotesPage = lazy(() =>
	import("@/features/notes/notes-page").then((module) => ({ default: module.NotesPage })),
);
const MorePage = lazy(() =>
	import("@/features/more/more-page").then((module) => ({ default: module.MorePage })),
);

export const router = createBrowserRouter([
	{
		element: <AppShell />,
		children: [
			{ path: "/", element: <TodayPage /> },
			{ path: "/tasks", element: <TasksPage /> },
			{ path: "/notes", element: <NotesPage /> },
			{ path: "/more", element: <MorePage /> },
			{ path: "*", element: <NotFoundView /> },
		],
	},
]);
