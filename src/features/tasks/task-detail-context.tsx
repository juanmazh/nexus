import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import type { Task } from "./api";
import { TaskDetailSheet } from "./task-detail-sheet";

/**
 * The task detail, once for the whole application (open-detail-on-capture
 * design.md D1). The list opens it when a row is tapped and the capture bar when
 * a task has just been created, from whichever section is on screen, so it has
 * to live above the pages and not inside `/tasks`.
 */

type TaskDetail = { openTask: (task: Task) => void };

const TaskDetailContext = createContext<TaskDetail | null>(null);

export function TaskDetailProvider({ children }: { children: ReactNode }) {
	const [task, setTask] = useState<Task | null>(null);
	const value = useMemo<TaskDetail>(() => ({ openTask: setTask }), []);

	return (
		<TaskDetailContext.Provider value={value}>
			{children}
			<TaskDetailSheet task={task} onClose={() => setTask(null)} />
		</TaskDetailContext.Provider>
	);
}

export function useTaskDetail(): TaskDetail {
	const context = useContext(TaskDetailContext);
	if (!context) {
		throw new Error("useTaskDetail needs a TaskDetailProvider above it (AppShell mounts one).");
	}
	return context;
}
