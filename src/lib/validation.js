// Mismas reglas que las reglas de seguridad de Firebase (database.rules.json)
export const PHONE_RE = /^[0-9+ ()-]{6,20}$/;

export function validateClientData({ name, phone, notes }) {
  const e = {};
  const n = String(name || "").trim();
  if (n.length < 2) e.name = "Escribí nombre y apellido";
  else if (n.length > 80) e.name = "El nombre es demasiado largo";
  if (!PHONE_RE.test(String(phone || "").trim()))
    e.phone = "Ingresá un teléfono válido (solo números, +, espacios o guiones)";
  if (String(notes || "").length > 300) e.notes = "Máximo 300 caracteres";
  return e;
}
