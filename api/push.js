// Avisos push (Web Push, gratis) al celular del dueño cuando entra un turno nuevo.
//
//  POST /api/push {id}  → lo llama el cliente apenas reserva (sin login).
//
// El servidor lee el turno con firebase-admin (los clientes no pueden leer /appointments),
// verifica que exista, sea "pendiente" y recién creado, y solo entonces avisa. El texto lo arma
// el servidor: nadie puede mandar mensajes arbitrarios desde afuera. Un turno avisa UNA sola vez.
//
// Variables de entorno: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, opcional VAPID_SUBJECT.
// (FIREBASE_SERVICE_ACCOUNT, VITE_FIREBASE_DATABASE_URL y VITE_BUSINESS_ID ya existen en el proyecto.)
import webpush from "web-push";
import admin from "firebase-admin";
import { initOrFail, basePath, parseBody } from "./_server.js";
import { dateLabel } from "../src/lib/availability.js";

const MAX_AGE_MS = 2 * 60 * 1000; // solo se avisa de turnos recién hechos

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return res.status(500).json({ error: "Faltan las claves VAPID en Vercel" });

  const id = String(parseBody(req).id || "");
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(id)) return res.status(400).json({ error: "Datos inválidos" });
  if (!initOrFail(res)) return;

  try {
    const db = admin.database();
    const base = basePath();

    // el turno tiene que existir de verdad, estar pendiente y ser reciente
    const a = (await db.ref(`${base}/appointments/${id}`).get()).val();
    if (!a || a.status !== "pendiente" || typeof a.createdAt !== "number" || Date.now() - a.createdAt > MAX_AGE_MS) {
      return res.status(200).json({ sent: 0, reason: "no encontrado o viejo" });
    }

    // una sola vez por turno (se guarda en Firebase: vale aunque la función se reinicie)
    const claim = await db.ref(`${base}/notifLog/${id}/push`).transaction((cur) => (cur ? undefined : Date.now()));
    if (!claim.committed) return res.status(200).json({ sent: 0, reason: "ya avisado" });

    const all = (await db.ref(`${base}/push`).get()).val() || {};
    const subs = Object.entries(all).filter(([, x]) => x && x.sub && x.sub.endpoint);
    if (!subs.length) return res.status(200).json({ sent: 0, reason: "sin dispositivos" });

    webpush.setVapidDetails(process.env.VAPID_SUBJECT || `https://${req.headers.host || "localhost"}`, pub, priv);
    const payload = JSON.stringify({
      title: "💅 Nuevo turno",
      body: `${a.clientName} · ${a.serviceName || "Turno"}\n${dateLabel(a.date)} ${a.time} hs`,
      tag: `turno-${id}`,
      url: "/admin",
    });

    const results = await Promise.allSettled(
      subs.map(([, x]) => webpush.sendNotification(x.sub, payload, { TTL: 3600, urgency: "high" }))
    );

    // celulares que ya no existen (desinstalaron o revocaron el permiso): se limpian solos
    await Promise.allSettled(
      results.map((r, i) =>
        r.status === "rejected" && [404, 410].includes(r.reason?.statusCode)
          ? db.ref(`${base}/push/${subs[i][0]}`).remove()
          : null
      )
    );

    return res.status(200).json({ sent: results.filter((r) => r.status === "fulfilled").length, total: subs.length });
  } catch {
    return res.status(200).json({ sent: 0, reason: "send_failed" });
  }
}
