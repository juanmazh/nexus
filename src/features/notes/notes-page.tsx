import { ViewHeader } from "@/app/layout/view-header";
import { EmptyState } from "@/components/empty-state";

/**
 * A placeholder so the section has a route, a title and an empty state
 * (docs/DESIGN.md §1.3). The notes arrive with `add-notes`; nothing here yet on
 * purpose, rather than fake data that would have to be taken out again.
 */
export function NotesPage() {
	return (
		<>
			<ViewHeader title="Notas" subtitle="Lo que quieres recordar" />
			<EmptyState title="Sin notas" description="Aquí se guardarán tus notas." />
		</>
	);
}
