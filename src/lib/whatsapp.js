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

export function bookingMessage({ businessName, name, service, pro, dateText, time, price, code, deposit }) {
  return [
    `¡Hola${businessName ? ` ${businessName}` : ""}! Reservé un turno:`,
    "",
    `Nombre: ${name}`,
    `Servicio: ${service}`,
    `Profesional: ${pro}`,
    `Fecha: ${dateText}`,
    `Hora: ${time}`,
    price > 0 ? `Precio: $${Number(price).toLocaleString("es-AR")}` : null,
    deposit > 0 ? `Seña: $${Number(deposit).toLocaleString("es-AR")} (te adjunto el comprobante)` : null,
    `Código: ${code}`,
  ].filter((l) => l !== null).join("\n");
}

// Reclamo de seña (lo manda el negocio al cliente cuando venció el plazo)
export function depositReminderMessage(a, dateText, { businessName, alias, hours = 72 } = {}) {
  const first = String(a.clientName || "").split(" ")[0];
  return [
    `Hola, ${first}! Te escribimos${businessName ? ` de ${businessName}` : ""}.`,
    "",
    `Todavía no recibimos la seña de $${Number(a.depositAmount).toLocaleString("es-AR")} de tu turno del ${dateText} a las ${a.time} (${a.serviceName}).`,
    alias ? `Alias para transferir: ${alias}` : null,
    "",
    `Si ya la abonaste, mandanos el comprobante por este medio. Si no la recibimos, el turno se cancela automáticamente a las ${hours} hs de la reserva.`,
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

// Recordatorio del turno de mañana (lo manda el negocio al cliente)
export function reminderMessage(a, dateText, { businessName, address, mapsUrl } = {}) {
  const first = String(a.clientName || "").split(" ")[0];
  return [
    `¡Hola, ${first}! Te recordamos que mañana tenés turno${businessName ? ` en ${businessName}` : ""}:`,
    "",
    `Fecha: ${dateText}`,
    `Hora: ${a.time}`,
    `Profesional: ${a.professionalName}`,
    `Servicio: ${a.serviceName}`,
    address ? `Dirección: ${address}` : null,
    mapsUrl ? `Cómo llegar: ${mapsUrl}` : null,
    "",
    "Si no podés venir, avisanos por este medio así liberamos el horario. ¡Te esperamos!",
  ].filter((l) => l !== null).join("\n");
}
