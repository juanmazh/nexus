import type { CreateReminderInput, QuietHoursInput } from "@shared/reminders";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/toast-host";
import {
	cancelReminder,
	createReminder,
	fetchQuietHours,
	fetchReminders,
	saveQuietHours,
	sendTestMessage,
} from "./api";

export const remindersQueryKey = (taskId: string) => ["reminders", taskId] as const;

/**
 * The pending reminders of one task, read when its detail opens. A completed
 * task never asks: it has no pending reminders by definition (add-reminders
 * design.md D5), so the section does not even mount this hook for it.
 */
export function useReminders(taskId: string) {
	return useQuery({
		queryKey: remindersQueryKey(taskId),
		queryFn: () => fetchReminders(taskId),
	});
}

/**
 * After creating or cancelling, the detail's list **and** the task lists are
 * refreshed, so the bell of the row follows. Not optimistic on purpose: the API
 * may reject the time, and a reminder that appears and then vanishes is worse
 * than a button that waits a moment (design.md D11).
 */
function useRefresh(taskId: string) {
	const queryClient = useQueryClient();
	return () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: remindersQueryKey(taskId) }),
			queryClient.invalidateQueries({ queryKey: ["tasks"] }),
		]);
}

export function useCreateReminder(taskId: string) {
	const refresh = useRefresh(taskId);
	return useMutation({
		mutationFn: (input: CreateReminderInput) => createReminder(taskId, input),
		onSuccess(_reminder, input) {
			toast.add({ title: input.repeat ? "Repetición añadida" : "Aviso añadido" });
			return refresh();
		},
	});
}

export function useCancelReminder(taskId: string) {
	const refresh = useRefresh(taskId);
	return useMutation({
		mutationFn: (id: string) => cancelReminder(id),
		onSuccess() {
			toast.add({ title: "Recordatorio cancelado" });
		},
		onError(error) {
			toast.add({
				title: "No se ha podido cancelar el aviso",
				description: error instanceof Error ? error.message : undefined,
			});
		},
		onSettled: refresh,
	});
}

export function useSendTestMessage() {
	return useMutation({
		mutationFn: sendTestMessage,
		onSuccess() {
			toast.add({ title: "Aviso enviado. Revisa Telegram." });
		},
		onError(error) {
			toast.add({
				title: "No se ha podido enviar el aviso de prueba",
				description: error instanceof Error ? error.message : undefined,
			});
		},
	});
}

export const quietHoursQueryKey = ["settings", "quiet-hours"] as const;

export function useQuietHours() {
	return useQuery({ queryKey: quietHoursQueryKey, queryFn: fetchQuietHours });
}

/**
 * Not optimistic either: the API may reject the window, and the switch must not
 * claim a state the server does not have. The error is shown next to the
 * fields by the panel, so only the success is a toast.
 */
export function useSaveQuietHours() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (quiet: QuietHoursInput) => saveQuietHours(quiet),
		onSuccess(saved) {
			queryClient.setQueryData(quietHoursQueryKey, saved);
			toast.add({
				title: saved ? "Silencio nocturno guardado" : "Silencio nocturno desactivado",
			});
		},
	});
}
