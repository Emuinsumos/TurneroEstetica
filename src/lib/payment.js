// Validación de los datos de pago. La usan el navegador (para avisar rápido)
// Y el servidor (api/payment.js), que es el que de verdad manda.

export const ALIAS_RE = /^[A-Za-z0-9.-]{6,20}$/; // alias bancario argentino: 6 a 20, letras, números, punto y guion
export const MAX_AMOUNT = 1000000;

const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, max);

// Devuelve { errors, value }. value es lo que se guarda (ya limpio).
export function validatePayment(input = {}) {
  const enabled = input.enabled === true;
  const alias = clean(input.alias, 40);
  const holder = clean(input.holder, 80);
  const bank = clean(input.bank, 40);
  const rawAmount = String(input.amount ?? "").trim();
  const amount = rawAmount === "" ? null : Number(rawAmount);
  const errors = {};

  if (amount !== null && (!Number.isInteger(amount) || amount < 1 || amount > MAX_AMOUNT)) {
    errors.amount = `El monto tiene que ser un número entero entre 1 y ${MAX_AMOUNT.toLocaleString("es-AR")}`;
  }
  if (alias && !ALIAS_RE.test(alias)) {
    errors.alias = "El alias tiene entre 6 y 20 caracteres: letras, números, punto o guion (sin espacios)";
  }
  if (holder && holder.length < 3) errors.holder = "Poné el nombre completo del titular";

  if (enabled) {
    if (amount === null && !errors.amount) errors.amount = "Poné el monto de la seña";
    if (!alias) errors.alias = "Poné el alias para transferir";
    if (!holder) errors.holder = "Poné el titular de la cuenta (las clientas lo usan para verificar)";
  }

  return {
    errors,
    value: { enabled, amount, alias: alias || null, holder: holder || null, bank: bank || null },
  };
}
