export interface TaskStatusInput {
 outcome_state?: string | null;
 status?: string;
 failure_category?: string;
 wait_reason?: string | null;
 stage?: string;
 [key: string]: any;
}

export function taskStatusLabel(task: TaskStatusInput): string;
export function taskStatusClass(task: TaskStatusInput): string;
