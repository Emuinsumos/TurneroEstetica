// Función serverless de Vercel. La verificación del PIN ocurre ACÁ (servidor),
// nunca en el navegador. Si es correcto, devuelve un token personalizado de
// Firebase con permisos de admin SOLO para este negocio.
import crypto from "node:crypto";
import admin from "firebase-admin";

// Credenciales por defecto (temporales). Para cambiarlas sin tocar el código,
// definí ADMIN_USER y ADMIN_PIN en las variables de entorno de Vercel.
const DEFAULT_USER = "admin";
const DEFAULT_PIN = "1234";

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

function init() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("NO_SERVICE_ACCOUNT");
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(raw)),
    databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  });
}

const digest = (s) => crypto.createHash("sha256").update(String(s)).digest();
const same = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const user = String(body?.user ?? "").slice(0, 60);
  const pin = String(body?.pin ?? "").slice(0, 60);

  try {
    init();
  } catch (e) {
    const msg = e.message === "NO_SERVICE_ACCOUNT"
      ? "Falta configurar FIREBASE_SERVICE_ACCOUNT en Vercel"
      : "Error de configuración del servidor";
    return res.status(500).json({ error: msg });
  }

  const businessId =
    process.env.BUSINESS_ID || process.env.VITE_BUSINESS_ID || "estetica-demo";
  const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  const key = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 20);
  const ref = admin
    .database()
    .ref(`turneroEstetica/businesses/${businessId}/adminAuth/attempts/${key}`);

  try {
    const snap = await ref.get();
    const rec = snap.val() || { count: 0, until: 0 };
    const now = Date.now();

    if (rec.until && rec.until > now) {
      const min = Math.ceil((rec.until - now) / 60000);
      return res.status(429).json({ error: `Demasiados intentos. Probá en ${min} min.` });
    }

    const okUser = same(user, process.env.ADMIN_USER || DEFAULT_USER);
    const okPin = same(pin, process.env.ADMIN_PIN || DEFAULT_PIN);

    if (!(okUser && okPin)) {
      const count = (rec.until && rec.until <= now ? 0 : rec.count || 0) + 1;
      await ref.set({ count: count >= MAX_ATTEMPTS ? 0 : count, until: count >= MAX_ATTEMPTS ? now + LOCK_MS : 0 });
      return res.status(401).json({ error: "Usuario o PIN incorrecto" });
    }

    await ref.remove();
    const token = await admin
      .auth()
      .createCustomToken(`admin:${businessId}`, { role: "admin", businessId, root: "turneroEstetica" });
    return res.status(200).json({ token });
  } catch (e) {
    return res.status(500).json({ error: "Error del servidor" });
  }
}
