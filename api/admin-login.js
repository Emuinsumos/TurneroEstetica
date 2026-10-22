// Función serverless de Vercel. La verificación de la contraseña ocurre ACÁ (servidor),
// nunca en el navegador. Si es correcta, devuelve un token personalizado de
// Firebase con permisos de admin SOLO para este negocio.
//
// Credenciales: si el admin ya las cambió desde el panel, se usan las guardadas
// (con hash) en la base. Si no, valen las de Vercel (ADMIN_USER / ADMIN_PIN) o,
// como último recurso, admin / 1234.
import admin from "firebase-admin";
import { checkLogin } from "./_creds.js";
import {
  initOrFail, parseBody, businessId, basePath, clientKey, credsRef, lockState, registerFail,
} from "./_server.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const body = parseBody(req);
  const user = String(body.user ?? "").slice(0, 60);
  const pin = String(body.pin ?? "").slice(0, 60);

  if (!initOrFail(res)) return;

  const b = businessId();
  const ref = admin.database().ref(`${basePath()}/adminAuth/attempts/${clientKey(req)}`);

  try {
    const { locked, min, rec } = await lockState(ref);
    if (locked) return res.status(429).json({ error: `Demasiados intentos. Probá en ${min} min.` });

    const creds = (await credsRef().get()).val();
    if (!checkLogin(user, pin, creds, process.env)) {
      await registerFail(ref, rec);
      return res.status(401).json({ error: "Usuario o contraseña incorrecto" });
    }

    await ref.remove();
    const token = await admin.auth().createCustomToken(`admin:${b}`, { role: "admin", businessId: b });
    return res.status(200).json({ token });
  } catch (e) {
    return res.status(500).json({ error: "Error del servidor" });
  }
}
