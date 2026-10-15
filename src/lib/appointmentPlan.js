// Lógica pura (sin Firebase) para crear / modificar / cancelar turnos.
// Devuelve el "mapa de escrituras" para una sola actualización atómica:
//   - el turno completo (appointments/{id})
//   - las celdas de bloqueo que se liberan (null) y las que se toman (id)
import { lockCells, toMin } from "./availability.js";

export const STATUSES = ["pendiente", "confirmado", "cancelado", "completado", "ausente"];
export const isActive = (s) => s !== "cancelado";

const LABELS = {
  date: "fecha", time: "hora", professionalName: "profesional", serviceName: "servicio",
  clientName: "nombre", clientPhone: "teléfono", status: "estado", priceAtBooking: "precio", notes: "observaciones",
};

// Texto legible con lo que cambió, para el historial
export function diffText(a, b) {
  const out = [];
  for (const k of Object.keys(LABELS)) {
    const x = a?.[k] ?? "";
    const y = b?.[k] ?? "";
    if (String(x) !== String(y)) out.push(`${LABELS[k]}: ${x === "" ? "—" : x} → ${y === "" ? "—" : y}`);
  }
  return out.join("; ");
}

const conflict = () => {
  const e = new Error("CONFLICT");
  e.code = "CONFLICT";
  return e;
};

/**
 * existing: turno actual (sin id) o null si se está creando
 * next:     turno deseado (sin id)
 * locksNew: celdas ocupadas del profesional/fecha NUEVOS  { "0900": "idTurno" }
 * locksOld: celdas ocupadas del profesional/fecha ANTERIORES (para liberar)
 */
export function planWrite({
  id, existing, next, buffer = 0, locksNew = {}, locksOld = {}, stamp, histKey, action, detail = "",
}) {
  const rec = { ...next };
  const wasActive = !!existing && isActive(existing.status);
  const nowActive = isActive(rec.status);
  const sameSlot =
    !!existing &&
    existing.professionalId === rec.professionalId &&
    existing.date === rec.date &&
    existing.time === rec.time &&
    Number(existing.duration) === Number(rec.duration);
  const lockPath = (p, d, k) => `slotLocks/${p}/${d}/${k}`;
  const updates = {};

  if (!(wasActive && nowActive && sameSlot)) {
    // 1) liberar SOLO las celdas que realmente pertenecen a este turno
    const released = new Set();
    if (wasActive) {
      for (const k of Object.keys(locksOld || {})) {
        if (locksOld[k] === id) {
          const p = lockPath(existing.professionalId, existing.date, k);
          updates[p] = null;
          released.add(p);
        }
      }
    }
    // 2) tomar las celdas nuevas (si el turno queda activo)
    if (nowActive) {
      const cells = lockCells(toMin(rec.time), Number(rec.duration) + Number(buffer));
      if (cells.some((k) => locksNew && locksNew[k] && locksNew[k] !== id)) throw conflict();
      for (const k of cells) {
        const p = lockPath(rec.professionalId, rec.date, k);
        // Si la celda ya es de este turno, no se toca: las reglas de Firebase
        // solo permiten crear celdas libres y borrar, nunca pisar una ocupada.
        if (released.has(p)) delete updates[p];
        else updates[p] = id;
      }
      rec.slots = cells;
    } else {
      delete rec.slots;
    }
  }

  if (!existing && rec.createdAt === undefined) rec.createdAt = stamp;
  rec.updatedAt = stamp;
  rec.history = {
    ...((existing && existing.history) || {}),
    [histKey]: { at: stamp, by: "admin", action, detail },
  };

  const clean = {};
  for (const [k, v] of Object.entries(rec)) {
    if (v === undefined || v === null) continue;
    if (k === "notes" && v === "") continue;
    clean[k] = v;
  }
  updates[`appointments/${id}`] = clean;
  return updates;
}
