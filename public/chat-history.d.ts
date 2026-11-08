export interface ChatHistoryEvent {
 sequence: number;
 type: string;
 payload?: unknown;
 [key: string]: unknown;
}
export declare function mergeChatEvents(existing: unknown[], incoming: unknown[]): ChatHistoryEvent[];
