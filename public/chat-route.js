export function parseChatRoute(hash) {
 const raw = String(hash || '').replace(/^#\/?/, '');
 if (raw === 'work') return {mode: 'work'};
 if (raw === 'chat') return {mode: 'chat', chatId: null};
 const match = /^chat\/([0-9a-f-]{36})$/i.exec(raw);
 if (match) return {mode: 'chat', chatId: match[1]};
 return null;
}

export function chatRoutePath(chatId) {
 return chatId ? `/chat/${chatId}` : '/chat';
}
