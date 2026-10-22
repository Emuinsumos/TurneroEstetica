// Permite que el admin (ya logueado) cambie su usuario y contraseña.
//   GET  → { custom, user }   (¿ya cambió las de fábrica?)
//   POST → { currentPin, newUser, newPin }
// Se guarda solo el hash (scrypt) en adminAuth/credentials, que ningún cliente puede leer.
import admin from "firebase-admin";
import { checkLogin, hashPin, validateNewCreds, normUser } from "./_creds.js";
import {
  initOrFail, parseBody, businessId, basePath, clientKey, credsRef, lockState, registerFail,
} from "./_server.js";

async function requireAdmin(req, res) {
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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }
  if (!initOrFail(res)) return;
  if (!(await requireAdmin(req, res))) return;

  try {
    const creds = (await credsRef().get()).val();

    if (req.method === "GET") {
      return res.status(200).json({ custom: !!(creds && creds.hash), user: creds?.user || null });
    }

    const body = parseBody(req);
    const currentPin = String(body.currentPin ?? "").slice(0, 60);
    const newUser = String(body.newUser ?? "").trim();
    const newPin = String(body.newPin ?? "");

    const bad = validateNewCreds(newUser, newPin);
    if (bad) return res.status(400).json({ error: bad });

    // pide la contraseña actual (con bloqueo por intentos) para que nadie con el
    // celular desbloqueado pueda cambiarla
    const ref = admin.database().ref(`${basePath()}/adminAuth/credAttempts/${clientKey(req)}`);
    const { locked, min, rec } = await lockState(ref);
    if (locked) return res.status(429).json({ error: `Demasiados intentos. Probá en ${min} min.` });

    const currentUser = creds?.user || process.env.ADMIN_USER || "admin";
    if (!checkLogin(currentUser, currentPin, creds, process.env)) {
      await registerFail(ref, rec);
      return res.status(401).json({ error: "La contraseña actual no es correcta" });
    }
    await ref.remove();

    const { salt, hash } = hashPin(newPin);
    await credsRef().set({
      user: normUser(newUser),
      salt,
      hash,
      updatedAt: admin.database.ServerValue.TIMESTAMP,
    });
    return res.status(200).json({ ok: true, user: normUser(newUser) });
  } catch (e) {
    return res.status(500).json({ error: "Error del servidor" });
  }
}
