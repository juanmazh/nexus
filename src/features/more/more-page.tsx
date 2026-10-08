import { ViewHeader } from "@/app/layout/view-header";
import { Skeleton } from "@/components/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { HealthPanel } from "@/features/health/health-panel";
import { QuietHoursPanel } from "@/features/reminders/quiet-hours-panel";
import { TestMessagePanel } from "@/features/reminders/test-message-panel";
import { useSession } from "./use-session";

/**
 * Everything that is not a section of its own: who is inside, how to check that
 * the API is alive, and the few settings that apply everywhere.
 *
 * The three states each of its panels needs are present because both of its data
 * sources can be slow or broken (docs/DESIGN.md §5): loading, error with a way
 * to retry, and content.
 */
export function MorePage() {
	const { data, error, isPending, refetch } = useSession();

	return (
		<>
			<ViewHeader
				title="Más"
				subtitle="Sesión, comprobaciones y ajustes"
				action={<ThemeToggle />}
			/>

			<div className="flex flex-col gap-4 px-4 pt-4">
				<section aria-labelledby="sesion-titulo" className="flex flex-col gap-3">
					<h2 id="sesion-titulo" className="font-heading text-base font-medium text-foreground">
						Sesión
					</h2>

					{isPending ? (
						<div className="flex flex-col gap-2" role="status" aria-live="polite">
							<span className="sr-only">Comprobando la sesión…</span>
							<Skeleton className="h-5 w-40" />
						</div>
					) : null}

					{error ? (
						<div role="alert" className="flex flex-col items-start gap-2">
							<p className="font-medium text-destructive">No se ha podido comprobar la sesión.</p>
							<button
								type="button"
								className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-base font-medium text-foreground"
								onClick={() => {
									void refetch();
								}}
							>
								Reintentar
							</button>
						</div>
					) : null}

					{data ? (
						<p className="flex min-w-0 flex-col gap-1">
							<span className="text-sm text-muted-foreground">Sesión iniciada como</span>
							<span className="truncate font-medium text-foreground">{data.user.email}</span>
						</p>
					) : null}
				</section>

				<TestMessagePanel />

				<QuietHoursPanel />

				<HealthPanel />
			</div>
		</>
	);
}
