import { ref, set, remove } from "firebase/database";
import { db } from "../config/firebase";
import { P } from "../config/paths";
import { VAPID_PUBLIC } from "../config/push";

const b64ToBytes = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

// id estable por dispositivo (así volver a activar no duplica)
async function subId(endpoint) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(buf)).slice(0, 10).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// 'unsupported' | 'denied' | 'on' | 'off'
export async function pushState() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = reg && (await reg.pushManager.getSubscription());
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "off";
  }
}

// Pide permiso, suscribe ESTE celular y guarda la suscripción en Firebase
// (solo el admin logueado puede escribir ahí).
export async function enablePush() {
  if (!pushSupported()) throw new Error("unsupported");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("denied");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
  const id = await subId(sub.endpoint);
  try {
    await set(ref(db, `${P.push}/${id}`), { sub: sub.toJSON(), ua: navigator.userAgent.slice(0, 90), createdAt: Date.now() });
  } catch (e) {
    await sub.unsubscribe().catch(() => {}); // no dejar el celular "activo" sin estar guardado
    throw e;
  }
  await reg.showNotification("🔔 Avisos activados", { body: "Te vamos a avisar cuando entre un turno nuevo.", tag: "avisos-ok" });
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) return;
  const id = await subId(sub.endpoint);
  await sub.unsubscribe();
  try { await remove(ref(db, `${P.push}/${id}`)); } catch { /* si falla, el servidor la limpia al fallar el envío */ }
}

// Avisa al servidor que entró un turno (no bloquea ni rompe la reserva si falla).
export function notifyPush(id) {
  try {
    fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* nunca rompe la reserva */ }
}
