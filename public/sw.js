self.addEventListener('notificationclick', event => {
 event.notification.close();
 const target = (event.notification.data && event.notification.data.url) || '/';
 event.waitUntil((async () => {
  const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
  for (const client of windows) {
   if ('focus' in client) {
    await client.navigate(target).catch(() => {});
    return client.focus();
   }
  }
  return self.clients.openWindow(target);
 })());
});
