// ÚNICO lugar que arma rutas de Firebase. Todo cuelga de la raíz exclusiva.
const ROOT = "turneroEstetica";
export const BUSINESS_ID = import.meta.env.VITE_BUSINESS_ID;
const base = `${ROOT}/businesses/${BUSINESS_ID}`;

export const P = {
  base,
  config: `${base}/config`,
  services: `${base}/services`,
  professionals: `${base}/professionals`,
  availabilityAll: `${base}/availability`,
  availability: (profId) => `${base}/availability/${profId}`,
  blockedSlots: `${base}/blockedSlots`,
  serviceAgenda: `${base}/serviceAgenda`,
  payment: `${base}/payment`,
  appointments: `${base}/appointments`,
  appointment: (id) => `${base}/appointments/${id}`,
  slotLocks: (profId, date) => `${base}/slotLocks/${profId}/${date}`,
  media: `${base}/media`,
  auditLog: `${base}/auditLog`,
};
