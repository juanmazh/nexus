import { ViewHeader } from "@/app/layout/view-header";
import { EmptyState } from "@/components/empty-state";

/**
 * A placeholder so the section has a route, a title and an empty state
 * (docs/DESIGN.md §1.3). The lists arrive with `add-tasks`; there is nothing here
 * yet on purpose, rather than fake data that would have to be taken out again.
 */
export function TasksPage() {
	return (
		<>
			<ViewHeader title="Tareas" subtitle="Lo que tienes que hacer" />
			<EmptyState
				title="Sin tareas"
				description="Aquí se recogerán todas las tareas, agrupadas por día y sin conexión. Añade la primera con la barra de abajo."
			/>
		</>
	);
}
