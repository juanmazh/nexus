import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/toast-host";
import { cancelReminder, createReminder, fetchReminders, sendTestMessage } from "./api";

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
		mutationFn: (remindAt: string) => createReminder(taskId, remindAt),
		onSuccess() {
			toast.add({ title: "Aviso añadido" });
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
