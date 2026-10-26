import { useEffect } from "react";
import { useRouteError } from "react-router";
import { ViewHeader } from "@/app/layout/view-header";
import { EmptyState } from "@/components/empty-state";

/**
 * What a section shows when it cannot load or render (reload-on-stale-chunk
 * design.md D2). It sits in the place of the section, so the navigation and
 * the capture bar stay usable, and offers the one fix that works for a file of
 * an old version or a dropped connection: reloading.
 */
export function SectionError() {
	const error = useRouteError();

	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<>
			<ViewHeader title="Algo ha fallado" subtitle="Esta sección no se ha podido cargar" />
			<div role="alert">
				<EmptyState
					title="No se ha podido cargar esta sección"
					description="Puede que haya una versión nueva de Nexus o que se haya perdido la conexión. Recargar suele arreglarlo."
					action={
						<button
							type="button"
							onClick={() => window.location.reload()}
							className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground active:scale-[0.98]"
						>
							Recargar
						</button>
					}
				/>
			</div>
		</>
	);
}
