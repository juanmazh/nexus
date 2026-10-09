import { NOTE_SEARCH_MAX } from "@shared/notes";
import { useState } from "react";
import { Link } from "react-router";
import { ViewHeader } from "@/app/layout/view-header";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useIsDesktop } from "@/lib/use-media-query";
import type { ListedNote } from "./api";
import { noteDate } from "./note-date";
import { useNotes } from "./use-notes";

/** How long the search waits for the person to stop typing (design.md D2). */
export const SEARCH_DELAY_MS = 300;

/**
 * The list of notes: pinned ones first under "Fijadas", the rest after, and a
 * search that asks the API once the typing stops (add-notes design.md D2).
 */
export function NotesPage() {
	const [search, setSearch] = useState("");
	const query = useDebouncedValue(search.trim(), SEARCH_DELAY_MS);
	const notes = useNotes(query);
	const isDesktop = useIsDesktop();

	const pinned = notes.data?.filter((note) => note.pinned) ?? [];
	const others = notes.data?.filter((note) => !note.pinned) ?? [];

	return (
		<>
			<ViewHeader title="Notas" subtitle="Lo que quieres recordar" />

			<div className="px-4 pt-3">
				<label htmlFor="buscar-notas" className="sr-only">
					Buscar en las notas
				</label>
				<input
					id="buscar-notas"
					type="search"
					enterKeyHint="search"
					maxLength={NOTE_SEARCH_MAX}
					placeholder="Buscar en las notas"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					className="min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
				/>
			</div>

			{notes.isPending ? (
				<div role="status" aria-live="polite" className="px-4 pt-3">
					<span className="sr-only">Cargando las notas…</span>
					<SkeletonList rows={4} />
				</div>
			) : null}

			{notes.isError ? (
				<div role="alert" className="flex flex-col items-start gap-2 px-4 pt-4">
					<p className="font-medium text-destructive">No se han podido cargar las notas.</p>
					<button
						type="button"
						className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-base font-medium text-foreground"
						onClick={() => {
							void notes.refetch();
						}}
					>
						Reintentar
					</button>
				</div>
			) : null}

			{notes.isSuccess && notes.data.length === 0 && query === "" ? (
				<EmptyState
					title="Sin notas"
					description={
						isDesktop
							? "Escribe en la barra de arriba para crear la primera. La primera línea será su título."
							: "Escribe en la barra de abajo para crear la primera. La primera línea será su título."
					}
				/>
			) : null}

			{notes.isSuccess && notes.data.length === 0 && query !== "" ? (
				<p role="status" className="px-4 pt-6 text-base text-muted-foreground">
					Ninguna nota contiene «{query}».
				</p>
			) : null}

			{pinned.length > 0 ? <NoteSection title="Fijadas" notes={pinned} /> : null}
			{others.length > 0 ? (
				<NoteSection title={pinned.length > 0 ? "Notas" : null} notes={others} />
			) : null}
		</>
	);
}

function NoteSection({ title, notes }: { title: string | null; notes: ListedNote[] }) {
	const now = Date.now();
	const headingId = title ? `notas-${title.toLowerCase()}` : undefined;

	return (
		<section aria-labelledby={headingId} className="pt-3">
			{title ? (
				<h2
					id={headingId}
					className="px-4 pb-1 text-sm font-medium tracking-wide text-muted-foreground uppercase"
				>
					{title}
				</h2>
			) : null}
			<ul aria-label={title ?? "Notas"} className="flex flex-col">
				{notes.map((note) => (
					<li key={note.id} className="border-b border-border last:border-b-0">
						<Link
							to={`/notes/${note.id}`}
							className="flex min-h-11 min-w-0 flex-col gap-0.5 px-4 py-3 active:bg-muted"
						>
							<span className="flex min-w-0 items-baseline justify-between gap-3">
								<span className="min-w-0 truncate font-medium text-foreground">{note.title}</span>
								<span className="shrink-0 text-sm text-muted-foreground tabular-nums">
									{noteDate(note.updated_at, now)}
								</span>
							</span>
							{note.excerpt ? (
								<span className="line-clamp-2 text-sm text-muted-foreground">{note.excerpt}</span>
							) : null}
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
