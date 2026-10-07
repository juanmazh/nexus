import { Link } from "react-router";
import { ViewHeader } from "@/app/layout/view-header";
import { EmptyState } from "@/components/empty-state";

/**
 * A route that is not a section resolves inside the shell, so the person keeps
 * the navigation and the capture bar and only gets told what happened, with a
 * way back to Hoy (`app-shell`, "Unknown routes").
 */
export function NotFoundView() {
	return (
		<>
			<ViewHeader title="No encontrada" subtitle="Esta dirección no lleva a ninguna sección" />
			<EmptyState
				title="Aquí no hay nada"
				description="La dirección que has abierto no existe en Nexus. Puede que el enlace esté mal escrito."
				action={
					<Link
						to="/"
						className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground"
					>
						Volver a Hoy
					</Link>
				}
			/>
		</>
	);
}
