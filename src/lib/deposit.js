// Lógica pura (sin Firebase ni React) de la seña.
//
// Los datos de pago (monto fijo, alias, titular, banco) viven en el nodo `payment`,
// que SOLO escribe el servidor (api/payment.js). Acá solo se leen.
//
// Datos en el turno:  depositAmount (pesos), depositStatus ("pendiente" | "recibida" | "eximida"), depositPaidAt
//
// Línea de tiempo desde que se reserva (el horario queda bloqueado todo el tiempo):
//   0 – 24 hs  → "pending": plazo normal para pagar
//   24 – 72 hs → "overdue": aparece en rojo como "todavía no señó"
//   72 hs      → el servidor lo cancela solo y libera el horario (api/sweep.js)
// El admin puede cancelar a mano en cualquier momento.

export const DEPOSIT_HOURS = 24;  // pasado este plazo se marca en rojo
export const EXPIRE_HOURS = 72;   // pasado este plazo se cancela solo
const HOUR = 3600000;

// Seña fija. Si el servicio cuesta menos que la seña, se pide el precio (nunca más que el servicio).
// Si el precio es "Consultar" (0), se pide la seña fija.
export function depositAmountFor(price, fixed) {
  const f = Math.floor(Number(fixed));
  const p = Number(price);
  if (!(f > 0)) return 0;
  return p > 0 ? Math.min(f, p) : f; // igual al precio exacto: así lo exigen las reglas de Firebase
}

// Lee el nodo `payment`. `on` = la seña está activa y hay dónde pagar.
export function paymentConfig(p = {}) {
  const amount = Number(p?.amount);
  const alias = String(p?.alias || "").trim();
  const holder = String(p?.holder || "").trim();
  const bank = String(p?.bank || "").trim();
  const on = p?.enabled === true && Number.isInteger(amount) && amount >= 1 && alias.length >= 6 && holder.length >= 1;
  return { on, amount, alias, holder, bank };
}

const open = (a) => a.status === "pendiente" || a.status === "confirmado";

// Estado de la seña de un turno:
//   null       → el turno no lleva seña (o ya no importa: cancelado, completado, ausente)
//   "pending"  → falta la seña, dentro de las primeras 24 hs
//   "overdue"  → falta la seña y ya pasaron 24 hs (en rojo)
//   "paid"     → seña recibida
//   "waived"   → el admin eximió la seña
export function depositState(a, now = Date.now()) {
  if (!a || !(Number(a.depositAmount) > 0) || !a.depositStatus) return null;
  if (a.depositStatus === "recibida") return "paid";
  if (a.depositStatus === "eximida") return "waived";
  if (!open(a)) return null;
  const created = typeof a.createdAt === "number" ? a.createdAt : null;
  if (created !== null && now - created >= DEPOSIT_HOURS * HOUR) return "overdue";
  return "pending";
}

// ¿Hay que cancelarlo solo? (lo usa el servidor, que además lo vuelve a verificar con la hora real)
export function shouldExpire(a, now = Date.now()) {
  if (!a || !(Number(a.depositAmount) > 0) || a.depositStatus !== "pendiente" || !open(a)) return false;
  return typeof a.createdAt === "number" && now - a.createdAt >= EXPIRE_HOURS * HOUR;
}

// Horas que pasaron desde que se reservó (hacia abajo), o null si no se sabe.
export function hoursSinceBooked(a, now = Date.now()) {
  return typeof a?.createdAt === "number" ? Math.max(0, Math.floor((now - a.createdAt) / HOUR)) : null;
}

// Horas que faltan para la cancelación automática (hacia arriba), o null si no se sabe.
export function hoursUntilExpire(a, now = Date.now()) {
  return typeof a?.createdAt === "number" ? Math.max(0, Math.ceil((a.createdAt + EXPIRE_HOURS * HOUR - now) / HOUR)) : null;
}
