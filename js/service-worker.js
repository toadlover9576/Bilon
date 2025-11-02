// service-worker.js
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('./index.html'));
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  self.registration.showNotification(data.title || "Reminder", {
    body: data.body || "You have a new reminder",
    icon: "./assets/icon.png"
  });
});
