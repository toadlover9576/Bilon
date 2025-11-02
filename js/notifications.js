// notifications.js

// Request notification permission on load
export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("This browser does not support notifications.");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.log("Notification permission denied.");
  }
}

// Show a notification immediately
export function showNotification(title, body) {
  if (Notification.permission === "granted") {
    new Notification(title, {
      body: body,
      icon: "./assets/icon.png" // optional app icon
    });
  } else {
    console.log("Permission not granted or notifications blocked.");
  }
}

// Schedule an in-session reminder (works only while app is open)
export function scheduleReminder(minutes, title, message) {
  const ms = minutes * 60 * 1000;
  setTimeout(() => {
    showNotification(title, message);
  }, ms);
}

// Register service worker for limited background notifications
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./service-worker.js');
      console.log("Service worker registered for reminders.");
    } catch (err) {
      console.error("Service worker registration failed:", err);
    }
  }
}

// Initialize reminders setup
window.addEventListener("DOMContentLoaded", async () => {
  await requestNotificationPermission();
  await registerServiceWorker();
});
