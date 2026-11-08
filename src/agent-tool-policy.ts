export interface AgentToolTask {
 stage: string;
 kind?: string | null;
}

/**
 * Explore work tasks stay without a shell to keep exploration side-effect free.
 * Chat tasks also run in Explore, but they need read-only repository inspection
 * commands such as `git log`, `git status`, `git show` and `git diff`.
 */
export function shouldEnableBashTool(task: AgentToolTask): boolean {
 return task.stage !== 'Explore' || task.kind === 'chat';
}
