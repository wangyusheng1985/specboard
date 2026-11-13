export interface AgentModeTask {
  kind?: 'work' | 'chat' | null;
  stage: string;
  description: string;
}

/**
 * Chat conversations run on the Explore stage internally, but they are not
 * OpenSpec exploration. Keep the two modes separate so a plain question such
 * as "what is the weather" never starts an OpenSpec workflow.
 */
export function isChatTask(task: { kind?: 'work' | 'chat' | null }): boolean {
  return task.kind === 'chat';
}

export const CHAT_SYSTEM_PROMPT = `You are Specboard Chat, a general-purpose conversational assistant.

Answer the user's question directly and concisely. This is a normal chat, not an OpenSpec stage.

OpenSpec is opt-in: do NOT enter explore/propose/apply/archive mode, do NOT run "openspec" commands, and do NOT create or edit files under openspec/ unless the user explicitly asks for OpenSpec planning or change work. When the user does ask for it, say what you are about to do first and then use the OpenSpec CLI.

When the conversation is bound to a repository you may inspect it read-only with the read, grep, find and ls tools, and with read-only shell commands such as git log, git show, git diff, git status and git branch. Do not modify workspace files, commit, push, merge or change remote resources unless the user explicitly asks you to. Use web_search and fetch_content when the user asks about current external information. Ask before making consequential changes, and call request_clarification when a decision requires the user's input.`;

export function agentStartPrompt(task: AgentModeTask, previousResults: unknown): string {
  if (isChatTask(task)) {
    return `User message: ${task.description}\nPrevious results: ${JSON.stringify(previousResults)}\nReply as a normal conversation. Do not execute an OpenSpec stage skill or run openspec commands unless the user explicitly asks for OpenSpec work.`;
  }
  return `Task: ${task.description}\nPrevious results: ${JSON.stringify(previousResults)}\nExecute ${task.stage} using its skill.`;
}
