// ÚNICO camino para cambiar los datos de pago de la seña (monto, alias, titular, banco).
//
// Por qué así: el nodo `payment` de Firebase es de solo lectura para todos los navegadores
// (regla ".write": false). Solo este servidor, con la clave de servicio, puede escribirlo.
// Para que alguien cambie el alias tiene que:
//   1) tener una sesión de admin válida (token firmado por /api/admin-login),
//   2) volver a escribir la contraseña actual (con bloqueo por intentos fallidos),
//   3) haber cambiado ya la contraseña de fábrica (si no, se rechaza),
// y cada cambio queda en `auditLog` (con la hora del servidor), que ningún navegador puede escribir.
//
//   POST { currentPin, enabled, amount, alias, holder, bank }  (Authorization: Bearer <idToken>)
import admin from "firebase-admin";
import { checkLogin, DEFAULT_PIN } from "./_creds.js";
import { validatePayment } from "../src/lib/payment.js";
import {
  initOrFail, parseBody, basePath, clientKey, credsRef, lockState, registerFail, requireAdmin,
} from "./_server.js";

const FIELDS = ["enabled", "amount", "alias", "holder", "bank"];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  if (!initOrFail(res)) return;
  if (!(await requireAdmin(req, res))) return;

  try {
    const body = parseBody(req);
    const currentPin = String(body.currentPin ?? "").slice(0, 60);
    const { errors, value } = validatePayment(body);
    const firstError = Object.values(errors)[0];
    if (firstError) return res.status(400).json({ error: firstError, field: Object.keys(errors)[0] });

    const creds = (await credsRef().get()).val();

    // Con la contraseña de fábrica (admin / 1234) cualquiera que conozca el sistema podría entrar.
    const factory = !(creds && creds.hash) && (!process.env.ADMIN_PIN || process.env.ADMIN_PIN === DEFAULT_PIN);
    if (factory) {
      return res.status(403).json({ error: "Primero cambiá la contraseña de fábrica en la pestaña Acceso. Hasta entonces no se puede modificar el alias." });
    }

    const db = admin.database();
    const attempts = db.ref(`${basePath()}/adminAuth/payAttempts/${clientKey(req)}`);
    const { locked, min, rec } = await lockState(attempts);
    if (locked) return res.status(429).json({ error: `Demasiados intentos. Probá en ${min} min.` });

    const currentUser = creds?.user || process.env.ADMIN_USER || "admin";
    if (!checkLogin(currentUser, currentPin, creds, process.env)) {
      await registerFail(attempts, rec);
      return res.status(401).json({ error: "La contraseña no es correcta" });
    }
    await attempts.remove();

    const before = (await db.ref(`${basePath()}/payment`).get()).val() || {};
    const changes = {};
    for (const k of FIELDS) {
      const a = before[k] ?? null;
      const b = value[k] ?? null;
      if (a !== b) changes[k] = { from: a, to: b };
    }
    if (Object.keys(changes).length === 0) return res.status(200).json({ ok: true, unchanged: true });

    const TS = admin.database.ServerValue.TIMESTAMP;
    const logKey = db.ref().push().key;
    await db.ref(basePath()).update({
      payment: { ...value, updatedAt: TS },
      [`auditLog/${logKey}`]: { at: TS, kind: "payment", by: "admin", ip: clientKey(req), changes },
    });
    return res.status(200).json({ ok: true, changed: Object.keys(changes) });
  } catch (e) {
    return res.status(500).json({ error: "Error del servidor" });
  }
}
