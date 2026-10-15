import assert from "node:assert/strict";
import { validateClientData } from "../src/lib/validation.js";
import { clientWaNumber, waLink, clientMessage } from "../src/lib/whatsapp.js";
import { capacityMinutes } from "../src/lib/availability.js";

// validación (misma regla que las reglas de Firebase)
assert.deepEqual(validateClientData({ name: "Ana Pérez", phone: "11 2345-6789", notes: "" }), {});
assert.ok(validateClientData({ name: "A", phone: "11 2345-6789" }).name);
assert.ok(validateClientData({ name: "Ana", phone: "abc" }).phone);
assert.ok(validateClientData({ name: "Ana", phone: "123456", notes: "x".repeat(301) }).notes);

// teléfonos argentinos → wa.me
assert.equal(clientWaNumber("11 2345-6789"), "5491123456789");
assert.equal(clientWaNumber("011 15 2345-6789"), "5491123456789");
assert.equal(clientWaNumber("+54 9 11 2345 6789"), "5491123456789");
assert.equal(clientWaNumber(""), "");
assert.equal(waLink("", "x"), null);
assert.ok(waLink("5491123456789", "hola ñ").includes("text=hola%20%C3%B1"));

// mensajes
const a = { clientName: "Ana Pérez", serviceName: "Corte", professionalName: "Leo", time: "10:00", priceAtBooking: 5000 };
for (const k of ["creado", "confirmado", "modificado", "cancelado"]) {
  const m = clientMessage(k, a, "martes, 20 de octubre");
  assert.ok(m.includes("Ana") && m.includes("10:00") && m.includes("Corte"), k);
}
assert.ok(!clientMessage("creado", { ...a, priceAtBooking: 0 }, "x").includes("Precio"));

// capacidad
const w = { 1: { open: true, from: "09:00", to: "18:00", breakFrom: "13:00", breakTo: "14:00" } };
assert.equal(capacityMinutes(w, "2026-10-19", []), 480); // lunes
assert.equal(capacityMinutes(w, "2026-10-19", [{ date: "2026-10-19", from: "16:00", to: "17:00" }]), 420);
assert.equal(capacityMinutes(w, "2026-10-19", [{ date: "2026-10-19" }]), 0);
assert.equal(capacityMinutes(w, "2026-10-20", []), 0);
console.log("OK misc");
