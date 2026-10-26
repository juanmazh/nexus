import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/toast-host";
import { deleteNote, type Note, updateNote } from "./api";
import { clearDraft, readDraft, writeDraft } from "./draft-store";
import { noteKey, rememberNote } from "./use-notes";

/**
 * Autosave of a note's content (add-notes design.md D6).
 *
 * - One save a second after the last keystroke, and one right away when asked
 *   (`flush`): going back to the formatted view, leaving the note, or the app
 *   going to the background (those two with `keepalive`).
 * - Never two saves at once. A save that finishes finds out whether the text
 *   changed meanwhile and, if so, sends only the latest one.
 * - Unsaved text is also kept in the browser (`draft-store.ts`) until the API
 *   has it, so a save that fails after leaving the note, or an app killed
 *   offline, loses nothing: the note reopens with it and saves it.
 * - A note left blank is not saved; leaving it deletes it, once any save in
 *   flight has finished, so a late save cannot bring it back.
 *
 * The state that timers and the cleanup read lives in refs: they run outside
 * React's render and must see the latest text, not the one of the render that
 * scheduled them.
 */

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export const AUTOSAVE_DELAY_MS = 1000;

export function useAutosave(note: Note, delayMs = AUTOSAVE_DELAY_MS) {
	const queryClient = useQueryClient();
	const { id } = note;
	const [initial] = useState(() => readDraft(id) ?? note.content);
	const [draft, setDraftState] = useState(initial);
	const [status, setStatus] = useState<SaveStatus>(initial === note.content ? "idle" : "pending");

	const draftRef = useRef(initial);
	/** What the API has: the text of the last save that succeeded. */
	const savedRef = useRef(note.content);
	const inFlightRef = useRef<Promise<void> | null>(null);
	/** Touched at least once: an untouched note is never deleted for being blank. */
	const dirtyRef = useRef(initial !== note.content);
	/** Being deleted on purpose: no save may run for it meanwhile. */
	const pausedRef = useRef(false);
	const mountedRef = useRef(true);
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const flush = useCallback(
		async ({ keepalive = false }: { keepalive?: boolean } = {}): Promise<void> => {
			clearTimeout(timerRef.current);
			const content = draftRef.current;
			if (pausedRef.current || content === savedRef.current || content.trim() === "") {
				return;
			}
			if (inFlightRef.current) {
				// The save in flight checks the text again when it finishes.
				return;
			}

			setStatus("saving");
			const save = (async () => {
				try {
					const saved = await updateNote(id, { content }, { keepalive });
					savedRef.current = content;
					if (draftRef.current === content) {
						clearDraft(id);
					}
					void rememberNote(queryClient, saved);
					return true;
				} catch {
					return false;
				}
			})();
			inFlightRef.current = save.then(() => undefined);
			const ok = await save;
			inFlightRef.current = null;

			if (!ok) {
				setStatus("error");
				if (!mountedRef.current) {
					// The text is in the draft store: say where it is, not just that
					// something failed.
					toast.add({
						title: "No se ha podido guardar la nota",
						description: "Tus cambios aparecerán al volver a abrirla.",
					});
				}
				return;
			}
			if (draftRef.current !== content) {
				await flush({ keepalive });
			} else {
				setStatus("saved");
			}
		},
		[id, queryClient],
	);

	const setDraft = useCallback(
		(value: string) => {
			draftRef.current = value;
			dirtyRef.current = true;
			setDraftState(value);
			if (value === savedRef.current) {
				clearDraft(id);
				setStatus("saved");
			} else {
				writeDraft(id, value);
				setStatus("pending");
			}
			clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => {
				void flush();
			}, delayMs);
		},
		[flush, delayMs, id],
	);

	/** Before deleting the note from its menu: no save may run meanwhile. */
	const pause = useCallback(() => {
		pausedRef.current = true;
		clearTimeout(timerRef.current);
	}, []);

	/** The delete failed: the note is still there, and so is what was typed. */
	const resume = useCallback(() => {
		pausedRef.current = false;
		void flush();
	}, [flush]);

	/** The delete went through: nothing is left to keep. */
	const forget = useCallback(() => {
		clearDraft(id);
	}, [id]);

	// A text recovered from the draft store is saved as soon as the note opens.
	useEffect(() => {
		if (draftRef.current !== savedRef.current) {
			void flush();
		}
	}, [flush]);

	// Switching apps on a phone hides the page; it may never come back.
	useEffect(() => {
		const onHide = () => {
			if (document.visibilityState === "hidden") {
				void flush({ keepalive: true });
			}
		};
		document.addEventListener("visibilitychange", onHide);
		window.addEventListener("pagehide", onHide);
		return () => {
			document.removeEventListener("visibilitychange", onHide);
			window.removeEventListener("pagehide", onHide);
		};
	}, [flush]);

	// Leaving the note: save what is left, or delete it if it was emptied.
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			clearTimeout(timerRef.current);
			if (pausedRef.current) {
				return;
			}
			if (dirtyRef.current && draftRef.current.trim() === "") {
				pausedRef.current = true;
				clearDraft(id);
				void (inFlightRef.current ?? Promise.resolve())
					.then(() => deleteNote(id))
					.then(() => {
						queryClient.removeQueries({ queryKey: noteKey(id) });
						toast.add({ title: "Nota vacía eliminada" });
						return queryClient.invalidateQueries({ queryKey: ["notes", "list"] });
					})
					.catch(() => {
						// The note keeps its last saved text.
					});
				return;
			}
			void flush({ keepalive: true });
		};
	}, [flush, id, queryClient]);

	return { draft, setDraft, status, flush, pause, resume, forget };
}
