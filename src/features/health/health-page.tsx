import { useHealth } from "./use-health";

/**
 * The bootstrap view: it asks the API whether it is alive and shows the result.
 * Mobile-first (docs/DESIGN.md §4): designed at 360 px and widened with `lg:`.
 * There is no "empty" state because there is no list to show, just a result.
 */
export function HealthPage() {
	const { data, error, isPending, isFetching, refetch } = useHealth();

	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:justify-center lg:gap-6 lg:p-8">
			<h1 className="text-2xl font-semibold tracking-tight">Nexus</h1>

			<div
				role="status"
				aria-live="polite"
				className="rounded-lg border border-border bg-card p-4 text-card-foreground"
			>
				{isPending ? <p className="text-muted-foreground">Comprobando la API…</p> : null}

				{error ? (
					<div role="alert" className="flex flex-col gap-1">
						<p className="font-medium text-destructive">No se ha podido comprobar la API.</p>
						<p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
					</div>
				) : null}

				{data ? (
					<p className="flex flex-col gap-1">
						<span className="text-muted-foreground">Estado de la API</span>
						<span className="font-mono text-lg font-medium tabular-nums">{data.status}</span>
					</p>
				) : null}
			</div>

			<button
				type="button"
				// 44 px minimum touch area (docs/DESIGN.md §4). Feedback uses
				// `active`, never `hover`: a hover style would stick on touch.
				className="mt-auto min-h-11 w-full rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60 lg:mt-0"
				onClick={() => {
					void refetch();
				}}
				disabled={isFetching}
			>
				{isFetching ? "Comprobando…" : "Comprobar de nuevo"}
			</button>
		</main>
	);
}

/**
 * `hc` throws an `HTTPError` for a non-2xx response and a plain `Error` for a
 * network failure. Both are reported as "the API did not answer", which is what
 * the person using the app can act on.
 */
function errorMessage(error: unknown): string {
	if (error instanceof Error && "status" in error) {
		return `La API respondió con el estado ${String(error.status)}. Vuelve a intentarlo en unos segundos.`;
	}
	return "No se ha podido contactar con la API. Comprueba tu conexión y vuelve a intentarlo.";
}
