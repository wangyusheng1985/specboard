export type ChatRoute =
 | {mode: 'work'}
 | {mode: 'chat'; chatId: string | null};
export declare function parseChatRoute(hash: string): ChatRoute | null;
export declare function chatRoutePath(chatId?: string | null): string;
