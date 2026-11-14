// Service worker: recibe los avisos push de turnos nuevos y los muestra en el celular del dueño.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data.json(); } catch { /* sin datos */ }
  e.waitUntil(
    self.registration.showNotification(d.title || "💅 Nuevo turno", {
      body: d.body || "",
      tag: d.tag || "turno",
      vibrate: [200, 100, 200],
      data: { url: d.url || "/admin" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/admin";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          if ("navigate" in c) c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
