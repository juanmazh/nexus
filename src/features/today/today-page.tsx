import { ViewHeader } from "@/app/layout/view-header";
import { EmptyState } from "@/components/empty-state";
import { NowMarker } from "./now-marker";

/**
 * The root of the application. A placeholder in this change: the tasks and
 * reminders that will fill it arrive with `add-tasks` and `add-home-dashboard`.
 *
 * It shows the date and the "now" marker, because that is the one moment of the
 * interface where the olive direction is spent (docs/DESIGN.md §5), and an empty
 * state that says what will live here instead of a blank screen.
 */
export function TodayPage() {
	const today = new Intl.DateTimeFormat("es-ES", {
		// Dates are stored in UTC and presented in Madrid (AGENTS.md §5).
		timeZone: "Europe/Madrid",
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(new Date());

	return (
		<>
			<ViewHeader title="Hoy" subtitle={today} />
			<div className="px-4">
				<NowMarker />
			</div>
			<EmptyState
				title="Nada pendiente para hoy"
				description="Aquí aparecerán las tareas y los recordatorios de hoy, en orden. Añade lo primero con la barra de abajo."
			/>
		</>
	);
}
