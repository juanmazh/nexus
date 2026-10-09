import type { InferResponseType } from "hono/client";
import { client } from "@/lib/api";
import { failure } from "@/lib/api-error";

/** One function per endpoint over the typed RPC client (ADR-007). */

type ListCall = typeof client.api.notes.$get;
type ReadCall = (typeof client.api.notes)[":id"]["$get"];

export type ListedNote = InferResponseType<ListCall, 200>[number];
export type Note = InferResponseType<ReadCall, 200>;

export async function fetchNotes(query: string): Promise<ListedNote[]> {
	const response = await client.api.notes.$get({ query: query === "" ? {} : { q: query } });
	if (!response.ok) {
		throw await failure(response);
	}
	return response.json();
}

export async function fetchNote(id: string): Promise<Note> {
	const response = await client.api.notes[":id"].$get({ param: { id } });
	if (!response.ok) {
		throw await failure(response);
	}
	return response.json();
}

export async function createNote(content: string): Promise<Note> {
	const response = await client.api.notes.$post({ json: { content } });
	if (!response.ok) {
		throw await failure(response);
	}
	return response.json();
}

export async function updateNote(
	id: string,
	patch: { content?: string; pinned?: boolean },
): Promise<Note> {
	const response = await client.api.notes[":id"].$patch({ param: { id }, json: patch });
	if (!response.ok) {
		throw await failure(response);
	}
	return response.json();
}

export async function deleteNote(id: string): Promise<void> {
	const response = await client.api.notes[":id"].$delete({ param: { id } });
	if (!response.ok) {
		throw await failure(response);
	}
}
