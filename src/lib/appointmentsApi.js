import { ref, get, update, serverTimestamp } from "firebase/database";
import { db } from "../config/firebase";
import { P } from "../config/paths";
import { newKey } from "./db";
import { planWrite, isActive } from "./appointmentPlan";

async function getLocks(profId, date) {
  if (!profId || !date) return {};
  const s = await get(ref(db, P.slotLocks(profId, date)));
  return s.val() || {};
}

export const withoutId = (a) => {
  const { id, ...rest } = a; // eslint-disable-line no-unused-vars
  return rest;
};

// Crea o modifica un turno en UNA sola escritura atómica (turno + celdas).
// Lanza Error con code "CONFLICT" si el horario nuevo ya está ocupado por otro turno.
export async function saveAppointment({ id, existing, next, buffer, action, detail }) {
  const apptId = id || newKey(P.appointments);
  const ex = existing ? withoutId(existing) : null;
  const nowActive = isActive(next.status);
  const locksNew = nowActive ? await getLocks(next.professionalId, next.date) : {};
  const locksOld = ex && isActive(ex.status) ? await getLocks(ex.professionalId, ex.date) : {};
  const updates = planWrite({
    id: apptId, existing: ex, next, buffer, locksNew, locksOld,
    stamp: serverTimestamp(), histKey: newKey(`${P.appointment(apptId)}/history`), action, detail,
  });
  await update(ref(db, P.base), updates);
  return apptId;
}
