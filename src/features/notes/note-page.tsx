import { noteBody, noteTitle } from "@shared/notes";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ViewHeader } from "@/app/layout/view-header";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/skeleton";
import { toast } from "@/components/toast-host";
import { ApiError } from "@/lib/api-error";
import type { Note } from "./api";
import { renderMarkdown } from "./markdown";
import { type SaveStatus, useAutosave } from "./use-autosave";
import { useDeleteNote, useNote, usePinNote } from "./use-notes";

const buttonClass =
	"inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-base font-medium active:scale-[0.98] disabled:opacity-60";

/** What `navigate` passes to open a note straight in the editor. */
export type NotePageState = { edit?: boolean };

/**
 * One note on its own route inside the shell (add-notes design.md D4): the
 * back button of the phone returns to the list, and a note can be linked.
 */
export function NotePage() {
	const { id = "" } = useParams();
	const location = useLocation();
	const note = useNote(id);
	const startEditing = (location.state as NotePageState | null)?.edit === true;

	if (note.isPending) {
		return (
			<div role="status" aria-live="polite" className="flex flex-col gap-3 px-4 pt-4">
				<span className="sr-only">Cargando la nota…</span>
				<Skeleton className="h-8 w-2/3" />
				<Skeleton className="h-24 w-full" />
			</div>
		);
	}

	if (note.isError) {
		const missing =
			note.error instanceof ApiError && (note.error.status === 404 || note.error.status === 400);
		return missing ? (
			<>
				<BackToNotes />
				<ViewHeader title="Nota no encontrada" className="pt-0" />
				<EmptyState
					title="Esta nota no existe"
					description="Puede que se haya eliminado o que el enlace esté mal."
					action={
						<Link to="/notes" className={`${buttonClass} bg-primary text-primary-foreground`}>
							Volver a Notas
						</Link>
					}
				/>
			</>
		) : (
			<>
				<BackToNotes />
				<div role="alert" className="flex flex-col items-start gap-2 px-4 pt-4">
					<p className="font-medium text-destructive">No se ha podido cargar la nota.</p>
					<button
						type="button"
						className={`${buttonClass} border border-border text-foreground`}
						onClick={() => {
							void note.refetch();
						}}
					>
						Reintentar
					</button>
				</div>
			</>
		);
	}

	// `key`: another note is another editor, with its own draft and timers.
	return <NoteEditor key={note.data.id} note={note.data} startEditing={startEditing} />;
}

function BackToNotes() {
	return (
		<nav aria-label="Volver" className="px-2 pt-[env(safe-area-inset-top)]">
			<Link
				to="/notes"
				className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-base font-medium text-primary"
			>
				<span aria-hidden="true">←</span> Notas
			</Link>
		</nav>
	);
}

const STATUS_TEXT: Record<SaveStatus, string> = {
	idle: "",
	pending: "Cambios sin guardar",
	saving: "Guardando…",
	saved: "Guardado",
	error: "No se ha podido guardar",
};

function NoteEditor({ note, startEditing }: { note: Note; startEditing: boolean }) {
	const [editing, setEditing] = useState(startEditing);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const autosave = useAutosave(note);
	const pin = usePinNote(note.id);
	const remove = useDeleteNote();
	const navigate = useNavigate();
	const textarea = useRef<HTMLTextAreaElement>(null);
	const html = useMemo(
		() => (editing ? "" : renderMarkdown(noteBody(autosave.draft))),
		[editing, autosave.draft],
	);

	// A note opened to be written puts the cursor at the end of what is there.
	useEffect(() => {
		if (editing && textarea.current) {
			const end = textarea.current.value.length;
			textarea.current.focus();
			textarea.current.setSelectionRange(end, end);
		}
	}, [editing]);

	const title = autosave.draft.trim() === "" ? "Nota vacía" : noteTitle(autosave.draft);

	return (
		<>
			<BackToNotes />
			<ViewHeader
				// The back link above already keeps clear of the notch.
				className="pt-0"
				title={title}
				subtitle={
					<span role="status" aria-live="polite">
						{STATUS_TEXT[autosave.status]}
					</span>
				}
			/>

			<div
				className="flex flex-wrap items-center gap-2 px-4 pt-3"
				role="toolbar"
				aria-label="Acciones de la nota"
			>
				<button
					type="button"
					className={`${buttonClass} border border-border text-foreground`}
					onClick={() => {
						if (editing) {
							void autosave.flush();
						}
						setEditing(!editing);
					}}
				>
					{editing ? "Ver" : "Editar"}
				</button>
				<button
					type="button"
					aria-pressed={note.pinned}
					disabled={pin.isPending}
					className={`${buttonClass} border border-border text-foreground aria-pressed:bg-muted`}
					onClick={() => pin.mutate(!note.pinned)}
				>
					{note.pinned ? "Fijada" : "Fijar"}
				</button>
				<button
					type="button"
					className={`${buttonClass} text-destructive`}
					onClick={() => setConfirmingDelete(true)}
				>
					Eliminar
				</button>
			</div>

			{autosave.status === "error" ? (
				<div role="alert" className="flex flex-wrap items-center gap-2 px-4 pt-3">
					<p className="text-sm text-destructive">No se ha podido guardar. Tu texto sigue aquí.</p>
					<button
						type="button"
						className={`${buttonClass} border border-border text-foreground`}
						onClick={() => {
							void autosave.flush();
						}}
					>
						Reintentar
					</button>
				</div>
			) : null}

			{confirmingDelete ? (
				<div className="mx-4 mt-3 flex flex-col gap-2 rounded-lg border border-destructive/40 p-3">
					<p className="text-base text-foreground">¿Eliminar esta nota? No se puede deshacer.</p>
					<div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-end">
						<button
							type="button"
							disabled={remove.isPending}
							className={`${buttonClass} border-2 border-destructive text-destructive`}
							onClick={() => {
								autosave.discard();
								remove.mutate(note.id, {
									onSuccess() {
										toast.add({ title: "Nota eliminada" });
										navigate("/notes");
									},
									onError(error) {
										toast.add({
											title: "No se ha podido eliminar la nota",
											description: error.message,
										});
									},
								});
							}}
						>
							Eliminar nota
						</button>
						<button
							type="button"
							className={`${buttonClass} border border-border text-foreground`}
							onClick={() => setConfirmingDelete(false)}
						>
							Cancelar
						</button>
					</div>
				</div>
			) : null}

			<div className="px-4 pt-4">
				{editing ? (
					<textarea
						ref={textarea}
						aria-label="Contenido de la nota"
						value={autosave.draft}
						onChange={(event) => autosave.setDraft(event.target.value)}
						placeholder="Escribe aquí. La primera línea es el título."
						spellCheck
						className="field-sizing-content min-h-[50dvh] w-full min-w-0 resize-none rounded-lg border border-input bg-background p-3 text-base leading-relaxed text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
					/>
				) : autosave.draft.trim() === "" ? (
					<p className="text-base text-muted-foreground">Nota vacía. Pulsa Editar para escribir.</p>
				) : html === "" ? (
					<p className="text-base text-muted-foreground">
						Solo tiene título. Pulsa Editar para seguir escribiendo.
					</p>
				) : (
					<div
						className="markdown min-w-0 text-base text-foreground"
						// Sanitized by DOMPurify in renderMarkdown (design.md D5).
						// biome-ignore lint/security/noDangerouslySetInnerHtml: the HTML is sanitized right above
						dangerouslySetInnerHTML={{ __html: html }}
					/>
				)}
			</div>
		</>
	);
}
