self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || "Refontiq Control Center";
  const options = {
    body: data.message || "Nouvelle alerte Refontiq.",
    icon: "/notification-sound.svg",
    badge: "/notification-sound.svg",
    tag: data.tag || "refontiq-alert",
    renotify: true,
    requireInteraction: data.level === "critical",
    data: { href: data.href || "/admin/dashboard" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/admin/dashboard";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const client of list) {
      if ("focus" in client) { client.focus(); if ("navigate" in client) return client.navigate(href); return; }
    }
    return clients.openWindow(href);
  }));
});
