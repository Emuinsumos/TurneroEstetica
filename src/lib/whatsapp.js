// Modalidad A: enlace wa.me con mensaje precargado.
// NO es un envío automático: la persona tiene que tocar "enviar" en WhatsApp.

// Convierte un teléfono escrito "a la argentina" a formato internacional para wa.me.
// Es una aproximación: si el número no es argentino, escribilo con código de país (+34 ...).
export function clientWaNumber(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) return d;
  if (d.startsWith("0")) d = d.slice(1);
  d = d.replace(/^(\d{2,4})15(\d{6,8})$/, "$1$2"); // quita el 15 de celulares
  return d.length === 10 ? `549${d}` : d;
}

export function waLink(number, text) {
  const n = String(number || "").replace(/\D/g, "");
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

export function bookingMessage({ businessName, name, service, pro, dateText, time, price, code }) {
  return [
    `¡Hola${businessName ? ` ${businessName}` : ""}! Reservé un turno:`,
    "",
    `Nombre: ${name}`,
    `Servicio: ${service}`,
    `Profesional: ${pro}`,
    `Fecha: ${dateText}`,
    `Hora: ${time}`,
    price > 0 ? `Precio: $${Number(price).toLocaleString("es-AR")}` : null,
    `Código: ${code}`,
  ].filter((l) => l !== null).join("\n");
}

// Mensajes del negocio hacia el cliente (turno confirmado / modificado / cancelado)
const detailLines = (a, dateText) => [
  `Servicio: ${a.serviceName}`,
  `Profesional: ${a.professionalName}`,
  `Fecha: ${dateText}`,
  `Hora: ${a.time}`,
  a.priceAtBooking > 0 ? `Precio: $${Number(a.priceAtBooking).toLocaleString("es-AR")}` : null,
];

export function clientMessage(kind, a, dateText) {
  const first = String(a.clientName || "").split(" ")[0];
  const head = {
    confirmado: `¡Hola, ${first}! Tu turno está confirmado.`,
    creado: `¡Hola, ${first}! Tu turno está registrado.`,
    modificado: `¡Hola, ${first}! Te avisamos que tu turno fue modificado. Estos son los datos nuevos:`,
    cancelado: `Hola, ${first}. Lamentamos avisarte que tu turno fue cancelado.`,
  }[kind] || `Hola, ${first}.`;
  const tail = {
    cancelado: "Si querés reprogramarlo, respondenos por este medio.",
  }[kind] || "Te esperamos. Si necesitás modificar o cancelar tu turno, contactanos por este medio.";
  return [head, "", ...detailLines(a, dateText).filter((l) => l !== null), "", tail].join("\n");
}
