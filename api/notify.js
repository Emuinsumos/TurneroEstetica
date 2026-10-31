// WhatsApp automático (Meta WhatsApp Cloud API). Etapa 5.
//
//  GET  /api/notify                      → { configured: true|false }
//  POST /api/notify {kind:"nuevo", id}   → lo llama el cliente al reservar (sin login).
//        Solo funciona UNA vez por turno, para turnos "pendiente" recién creados.
//        Envía: confirmación de registro al cliente + aviso al dueño.
//  POST /api/notify {kind, id}           → lo llama el admin (Authorization: Bearer <idToken>)
//        kind = creado | confirmado | modificado | cancelado → mensaje al cliente.
//
// El texto lo arma el servidor a partir del turno guardado: nadie puede mandar
// mensajes arbitrarios desde afuera. Si no hay credenciales de WhatsApp, responde
// { ok:false, reason:"not_configured" } y la app usa el link manual (wa.me).
import admin from "firebase-admin";
import { clientMessage, clientWaNumber } from "../src/lib/whatsapp.js";
import { dateLabel } from "../src/lib/availability.js";

const GRAPH = "https://graph.facebook.com/v21.0";
const ADMIN_KINDS = ["creado", "confirmado", "modificado", "cancelado"];

function init() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("NO_SERVICE_ACCOUNT");
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(raw)),
    databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  });
}

const configured = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);

async function sendWa(to, kind, text, params) {
  const tpl = process.env[`WA_TEMPLATE_${kind.toUpperCase()}`];
  const body = tpl
    ? {
        messaging_product: "whatsapp", to, type: "template",
        template: {
          name: tpl, language: { code: process.env.WA_TEMPLATE_LANG || "es_AR" },
          components: [{ type: "body", parameters: params.map((t) => ({ type: "text", text: String(t) })) }],
        },
      }
    : { messaging_product: "whatsapp", to, type: "text", text: { body: text, preview_url: false } };
  const r = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j?.error?.message || `WhatsApp ${r.status}`);
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ configured: configured() });
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const kind = String(body?.kind || "");
  const id = String(body?.id || "");
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(id)) return res.status(400).json({ error: "Datos inválidos" });
  if (kind !== "nuevo" && !ADMIN_KINDS.includes(kind)) return res.status(400).json({ error: "Datos inválidos" });
  if (!configured()) return res.status(200).json({ ok: false, reason: "not_configured" });

  try {
    init();
    const b = process.env.VITE_BUSINESS_ID;
    const base = `turneroEstetica/businesses/${b}`;
    const db = admin.database();

    if (kind !== "nuevo") {
      const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
      if (!m) return res.status(401).json({ error: "No autorizado" });
      const t = await admin.auth().verifyIdToken(m[1]).catch(() => null);
      if (!t || t.role !== "admin" || t.businessId !== b) return res.status(401).json({ error: "No autorizado" });
    }

    const [aSnap, cSnap] = await Promise.all([db.ref(`${base}/appointments/${id}`).get(), db.ref(`${base}/config`).get()]);
    if (!aSnap.exists()) return res.status(404).json({ error: "Turno inexistente" });
    const a = aSnap.val();
    const cfg = cSnap.val() || {};
    const dateText = dateLabel(a.date);
    const to = clientWaNumber(a.clientPhone);
    const sent = [];
    const params = [a.clientName, a.serviceName, a.professionalName, dateText, a.time];

    if (kind === "nuevo") {
      // público: solo turnos pendientes de los últimos 10 min, y una única vez
      const fresh = typeof a.createdAt === "number" && Date.now() - a.createdAt < 10 * 60 * 1000;
      if (a.status !== "pendiente" || !fresh) return res.status(403).json({ error: "No permitido" });
      const claim = await db.ref(`${base}/notifLog/${id}/nuevo`).transaction((cur) => (cur ? undefined : Date.now()));
      if (!claim.committed) return res.status(200).json({ ok: true, sent: [], duplicate: true });

      const owner = clientWaNumber(process.env.OWNER_WHATSAPP || cfg.whatsapp);
      const tasks = [];
      if (to) tasks.push(["cliente", sendWa(to, "creado", clientMessage("creado", a, dateText), params)]);
      if (owner && owner !== to) {
        const txt = [
          "🔔 Nuevo turno reservado", "",
          `Cliente: ${a.clientName} (${a.clientPhone})`, `Servicio: ${a.serviceName}`,
          `Profesional: ${a.professionalName}`, `Fecha: ${dateText}`, `Hora: ${a.time}`,
        ].join("\n");
        tasks.push(["dueño", sendWa(owner, "dueno", txt, params)]);
      }
      const results = await Promise.allSettled(tasks.map((t) => t[1]));
      const errors = [];
      results.forEach((r, i) => (r.status === "fulfilled" ? sent.push(tasks[i][0]) : errors.push(`${tasks[i][0]}: ${r.reason.message}`)));
      if (errors.length) await db.ref(`${base}/notifLog/${id}/errors`).set(errors.join(" | ").slice(0, 500));
      return res.status(200).json({ ok: sent.length > 0, sent, errors });
    }

    if (!to) return res.status(200).json({ ok: false, reason: "no_phone" });
    await sendWa(to, kind, clientMessage(kind, a, dateText), params);
    await db.ref(`${base}/notifLog/${id}/${kind}-${Date.now()}`).set(true);
    return res.status(200).json({ ok: true, sent: ["cliente"] });
  } catch (e) {
    if (String(e?.message) === "NO_SERVICE_ACCOUNT") return res.status(500).json({ error: "Falta FIREBASE_SERVICE_ACCOUNT" });
    return res.status(200).json({ ok: false, reason: "send_failed", error: String(e?.message || e).slice(0, 200) });
  }
}
