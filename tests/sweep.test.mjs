import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";

process.env.VITE_BUSINESS_ID = "b1";
process.env.FIREBASE_SERVICE_ACCOUNT = "{}";
delete process.env.BUSINESS_ID;

const { state, reset } = await import("./helpers/fake-admin.mjs");
const { call } = await import("./helpers/http.mjs");
const { default: sweep } = await import("../api/sweep.js");

const BASE = "turneroEstetica/businesses/b1";
const node = (path) => path.split("/").reduce((c, k) => (c && c[k] !== undefined ? c[k] : null), state.tree);
const H = 3600000;
const now = () => Date.now();

const appt = (over = {}) => ({
  clientName: "Ana", clientPhone: "1123456789", serviceId: "s1", serviceName: "Lifting",
  professionalId: "p1", date: "2030-01-10", time: "09:00", status: "pendiente", priceAtBooking: 25000,
  depositAmount: 10000, depositStatus: "pendiente", createdAt: now() - 73 * H, slots: ["0900", "0905"], ...over,
});

function seed(appointments, locks = {}) {
  reset();
  state.tree = { turneroEstetica: { businesses: { b1: { appointments, slotLocks: { p1: { "2030-01-10": locks } } } } } };
}
beforeEach(() => reset());

test("cancela solo el turno sin seña a las 72 hs, libera su horario y lo registra", async () => {
  seed({ a1: appt() }, { "0900": "a1", "0905": "a1", "1000": "otro" });
  const r = await call(sweep, { method: "GET" });
  assert.equal(r.code, 200);
  assert.equal(r.body.cancelled, 1);
  const a = node(`${BASE}/appointments/a1`);
  assert.equal(a.status, "cancelado");
  assert.equal(a.slots, undefined, "ya no ocupa celdas");
  const h = Object.values(a.history)[0];
  assert.equal(h.by, "sistema");
  assert.equal(h.action, "Cancelación automática");
  const locks = node(`${BASE}/slotLocks/p1/2030-01-10`);
  assert.equal(locks["0900"], undefined, "horario liberado");
  assert.equal(locks["0905"], undefined);
  assert.equal(locks["1000"], "otro", "no toca celdas de otros turnos");
});

test("no toca turnos dentro de plazo, señados, eximidos, cancelados ni sin seña pedida", async () => {
  seed({
    reciente: appt({ createdAt: now() - 50 * H }),
    justo: appt({ createdAt: now() - 71 * H }),
    pago: appt({ depositStatus: "recibida", createdAt: now() - 200 * H }),
    eximido: appt({ depositStatus: "eximida", createdAt: now() - 200 * H }),
    cancelado: appt({ status: "cancelado", createdAt: now() - 200 * H }),
    completado: appt({ status: "completado", createdAt: now() - 200 * H }),
    manual: appt({ depositAmount: undefined, depositStatus: undefined, status: "confirmado", createdAt: now() - 200 * H }),
  }, { "0900": "reciente" });
  const antes = JSON.parse(JSON.stringify(state.tree));
  const r = await call(sweep, { method: "POST" });
  assert.equal(r.body.cancelled, 0);
  const despues = JSON.parse(JSON.stringify(state.tree));
  delete despues.turneroEstetica.businesses.b1.meta; // solo el control de frecuencia
  assert.deepEqual(despues, antes, "no cambió nada más");
});

test("también cancela turnos 'confirmado' que nunca registraron la seña", async () => {
  seed({ c1: appt({ status: "confirmado" }) }, { "0900": "c1", "0905": "c1" });
  const r = await call(sweep, { method: "POST" });
  assert.equal(r.body.cancelled, 1);
  assert.equal(node(`${BASE}/appointments/c1`).status, "cancelado");
});

test("si la seña se marca justo antes, no se cancela (se vuelve a verificar al escribir)", async () => {
  seed({ a1: appt() }, { "0900": "a1", "0905": "a1" });
  // simula que el admin tildó la seña entre la consulta y la transacción
  const real = state.tree.turneroEstetica.businesses.b1.appointments.a1;
  const orig = Object.getOwnPropertyDescriptor(real, "depositStatus");
  let lecturas = 0;
  Object.defineProperty(real, "depositStatus", { configurable: true, enumerable: true, get() { lecturas++; return lecturas <= 1 ? "pendiente" : "recibida"; }, set(v) { Object.defineProperty(real, "depositStatus", { ...orig, value: v }); } });
  const r = await call(sweep, { method: "POST" });
  assert.equal(r.body.cancelled, 0);
  assert.notEqual(node(`${BASE}/appointments/a1`).status, "cancelado");
  assert.equal(node(`${BASE}/slotLocks/p1/2030-01-10/0900`), "a1", "el horario sigue ocupado");
});

test("limita la frecuencia: un segundo llamado inmediato no hace nada", async () => {
  seed({ a1: appt() }, { "0900": "a1", "0905": "a1" });
  assert.equal((await call(sweep, { method: "POST" })).body.cancelled, 1);
  state.tree.turneroEstetica.businesses.b1.appointments.a2 = appt({ slots: ["1000"] });
  const r2 = await call(sweep, { method: "POST" });
  assert.equal(r2.body.skipped, true);
  assert.equal(node(`${BASE}/appointments/a2`).status, "pendiente");
});

test("solo acepta GET o POST", async () => {
  seed({});
  assert.equal((await call(sweep, { method: "DELETE" })).code, 405);
});
