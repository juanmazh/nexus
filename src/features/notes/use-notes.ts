import {
	keepPreviousData,
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { toast } from "@/components/toast-host";
import { createNote, deleteNote, fetchNote, fetchNotes, type Note, updateNote } from "./api";

export const notesKey = ["notes"] as const;
export const notesListKey = (query: string) => ["notes", "list", query] as const;
export const noteKey = (id: string) => ["notes", "detail", id] as const;

/**
 * The list keeps showing the previous results while a new search is on its way,
 * so typing does not make the screen flash empty on every letter.
 */
export function useNotes(query: string) {
	return useQuery({
		queryKey: notesListKey(query),
		queryFn: () => fetchNotes(query),
		placeholderData: keepPreviousData,
	});
}

export function useNote(id: string) {
	return useQuery({ queryKey: noteKey(id), queryFn: () => fetchNote(id) });
}

/** After a write the detail has the API's row and every list is stale. */
export function rememberNote(queryClient: QueryClient, note: Note) {
	queryClient.setQueryData(noteKey(note.id), note);
	return queryClient.invalidateQueries({ queryKey: ["notes", "list"] });
}

/** Not optimistic: until the API answers there is no id to open (design.md D7). */
export function useCreateNote() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createNote,
		onSuccess: (note) => rememberNote(queryClient, note),
		onError(error) {
			toast.add({
				title: "No se ha podido crear la nota",
				description: error instanceof Error ? error.message : undefined,
			});
		},
	});
}

export function usePinNote(id: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (pinned: boolean) => updateNote(id, { pinned }),
		onSuccess(note) {
			toast.add({ title: note.pinned ? "Nota fijada" : "Nota desfijada" });
			return rememberNote(queryClient, note);
		},
		onError(error) {
			toast.add({
				title: "No se ha podido cambiar la nota",
				description: error instanceof Error ? error.message : undefined,
			});
		},
	});
}

export function useDeleteNote() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: deleteNote,
		onSuccess(_result, id) {
			queryClient.removeQueries({ queryKey: noteKey(id) });
			return queryClient.invalidateQueries({ queryKey: ["notes", "list"] });
		},
	});
}
