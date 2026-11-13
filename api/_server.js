// Ayudas de servidor compartidas por los endpoints de admin (no es un endpoint).
import crypto from "node:crypto";
import admin from "firebase-admin";

export const ROOT = "turneroEstetica";
export const MAX_ATTEMPTS = 5;
export const LOCK_MS = 15 * 60 * 1000;

export function init() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("NO_SERVICE_ACCOUNT");
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(raw)),
    databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  });
}

export const businessId = () =>
  process.env.BUSINESS_ID || process.env.VITE_BUSINESS_ID || "barberia-demo";

export const basePath = () => `${ROOT}/businesses/${businessId()}`;
export const credsRef = () => admin.database().ref(`${basePath()}/adminAuth/credentials`);

export const clientKey = (req) =>
  crypto
    .createHash("sha256")
    .update(String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim())
    .digest("hex")
    .slice(0, 20);

export function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body || {};
}

export function initOrFail(res) {
  try {
    init();
    return true;
  } catch (e) {
    res.status(500).json({
      error: e.message === "NO_SERVICE_ACCOUNT"
        ? "Falta configurar FIREBASE_SERVICE_ACCOUNT en Vercel"
        : "Error de configuración del servidor",
    });
    return false;
  }
}

// Bloqueo por intentos fallidos (por IP y por tipo de operación)
export async function lockState(ref) {
  const rec = (await ref.get()).val() || { count: 0, until: 0 };
  const now = Date.now();
  if (rec.until && rec.until > now) return { locked: true, min: Math.ceil((rec.until - now) / 60000), rec };
  return { locked: false, rec };
}
export async function registerFail(ref, rec) {
  const now = Date.now();
  const count = (rec.until && rec.until <= now ? 0 : rec.count || 0) + 1;
  await ref.set({ count: count >= MAX_ATTEMPTS ? 0 : count, until: count >= MAX_ATTEMPTS ? now + LOCK_MS : 0 });
}

// El que llama tiene que traer un token de admin de ESTE negocio (el que entrega /api/admin-login).
export async function requireAdmin(req, res) {
  const h = String(req.headers.authorization || "");
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) { res.status(401).json({ error: "Sesión no válida" }); return false; }
  try {
    const t = await admin.auth().verifyIdToken(token);
    if (t.role === "admin" && t.businessId === businessId()) return true;
  } catch { /* cae al error de abajo */ }
  res.status(403).json({ error: "Sin permisos" });
  return false;
}
