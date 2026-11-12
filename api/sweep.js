// Cancela solo los turnos que siguen sin seña a las 72 hs de haberse reservado y libera el horario.
//
// Es seguro dejarlo público: no recibe datos, y el servidor decide con SU reloj y con lo
// que hay guardado qué turnos vencieron. Lo llaman (1) la pantalla de reservas y el admin al
// abrirse, y (2) un cron diario de Vercel (vercel.json) como respaldo.
// Para no sobrecargar, corre como máximo una vez por minuto (el resto de los llamados no hace nada).
import admin from "firebase-admin";
import { shouldExpire, EXPIRE_HOURS } from "../src/lib/deposit.js";
import { initOrFail, basePath } from "./_server.js";

const THROTTLE_MS = 60 * 1000;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  if (!initOrFail(res)) return;

  try {
    const db = admin.database();
    const base = basePath();
    const now = Date.now();

    const gate = await db.ref(`${base}/meta/lastSweep`).transaction((cur) =>
      typeof cur === "number" && now - cur < THROTTLE_MS ? undefined : now
    );
    if (!gate.committed) return res.status(200).json({ ok: true, skipped: true });

    const snaps = await Promise.all(
      ["pendiente", "confirmado"].map((s) => db.ref(`${base}/appointments`).orderByChild("status").equalTo(s).get())
    );
    const candidates = [];
    for (const snap of snaps) snap.forEach((c) => { if (shouldExpire(c.val(), now)) candidates.push(c.key); });

    let cancelled = 0;
    for (const id of candidates) {
      const histKey = db.ref().push().key;
      let cells = [];
      let prof = null;
      let date = null;
      // Se vuelve a verificar DENTRO de la transacción: si justo el admin marcó la seña, no se toca.
      const r = await db.ref(`${base}/appointments/${id}`).transaction((cur) => {
        if (cur === null) return cur; // primera pasada sin datos locales: Firebase reintenta con el valor real
        if (!shouldExpire(cur, Date.now())) return undefined; // abortar
        cells = Array.isArray(cur.slots) ? cur.slots : [];
        prof = cur.professionalId;
        date = cur.date;
        const next = { ...cur, status: "cancelado", updatedAt: Date.now() };
        delete next.slots;
        next.history = {
          ...(cur.history || {}),
          [histKey]: {
            at: Date.now(), by: "sistema", action: "Cancelación automática",
            detail: `Sin seña a las ${EXPIRE_HOURS} hs de reservar`,
          },
        };
        return next;
      });
      if (!r.committed) continue;
      cancelled++;

      // Liberar solo las celdas que pertenecen a este turno
      if (prof && date && cells.length) {
        const locks = (await db.ref(`${base}/slotLocks/${prof}/${date}`).get()).val() || {};
        const free = {};
        for (const k of cells) if (locks[k] === id) free[k] = null;
        if (Object.keys(free).length) await db.ref(`${base}/slotLocks/${prof}/${date}`).update(free);
      }
    }
    return res.status(200).json({ ok: true, cancelled });
  } catch (e) {
    return res.status(500).json({ error: "Error del servidor" });
  }
}
