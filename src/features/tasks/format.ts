export function pendingCountLabel(count: number): string {
	if (count === 0) {
		return "Nada pendiente";
	}
	return count === 1 ? "1 pendiente" : `${count} pendientes`;
}
