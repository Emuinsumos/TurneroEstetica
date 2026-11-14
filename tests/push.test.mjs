import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";

process.env.VITE_BUSINESS_ID = "b1";
process.env.FIREBASE_SERVICE_ACCOUNT = "{}";
process.env.VAPID_PUBLIC_KEY = "pub";
process.env.VAPID_PRIVATE_KEY = "priv";
delete process.env.BUSINESS_ID;
delete process.env.VAPID_SUBJECT;

const { state, reset } = await import("./helpers/fake-admin.mjs");
const wp = await import("./helpers/fake-webpush.mjs");
const { call } = await import("./helpers/http.mjs");
const { default: push } = await import("../api/push.js");

const BASE = "turneroEstetica/businesses/b1";
const node = (path) => path.split("/").reduce((c, k) => (c && c[k] !== undefined ? c[k] : null), state.tree);
const ID = "-Nabcdefghij123";

const appt = (over = {}) => ({
  clientName: "Ana Pérez", clientPhone: "1123456789", serviceName: "Lifting de pestañas",
  professionalName: "Lu", date: "2030-01-10", time: "09:30", status: "pendiente",
  priceAtBooking: 25000, createdAt: Date.now() - 5000, ...over,
});
const dev = (endpoint) => ({ sub: { endpoint, keys: { p256dh: "k", auth: "a" } }, createdAt: 1 });

function seed({ appointments = { [ID]: appt() }, pushNode = { d1: dev("https://fcm.example/ok1") } } = {}) {
  reset();
  wp.reset();
  state.tree = { turneroEstetica: { businesses: { b1: { appointments, push: pushNode } } } };
}
beforeEach(() => seed());

test("turno nuevo: avisa a cada celular con texto de turno (cliente, servicio, día y hora)", async () => {
  seed({ pushNode: { d1: dev("https://fcm.example/ok1"), d2: dev("https://fcm.example/ok2") } });
  const r = await call(push, { body: { id: ID } });
  assert.equal(r.code, 200);
  assert.deepEqual([r.body.sent, r.body.total], [2, 2]);
  assert.equal(wp.sent.length, 2);
  const p = wp.sent[0].payload;
  assert.equal(p.title, "💅 Nuevo turno");
  assert.match(p.body, /Ana Pérez · Lifting de pestañas/);
  assert.match(p.body, /enero/);
  assert.match(p.body, /09:30/);
  assert.equal(p.url, "/admin");
  assert.equal(p.tag, `turno-${ID}`);
  assert.deepEqual([wp.sent[0].opts.TTL, wp.sent[0].opts.urgency], [3600, "high"]);
  assert.equal(wp.vapid.last.pub, "pub");
  assert.match(wp.vapid.last.subject, /^https:\/\//);
});

test("avisa una sola vez por turno, aunque lo llamen de nuevo", async () => {
  await call(push, { body: { id: ID } });
  const r2 = await call(push, { body: { id: ID } });
  assert.equal(r2.body.sent, 0);
  assert.equal(r2.body.reason, "ya avisado");
  assert.equal(wp.sent.length, 1);
  assert.ok(node(`${BASE}/notifLog/${ID}/push`));
});

test("no avisa de turnos inexistentes, viejos o que no están pendientes", async () => {
  for (const [name, a] of [
    ["viejo", appt({ createdAt: Date.now() - 3 * 60 * 1000 })],
    ["confirmado", appt({ status: "confirmado" })],
    ["cancelado", appt({ status: "cancelado" })],
    ["sin fecha de creación", appt({ createdAt: undefined })],
  ]) {
    seed({ appointments: { [ID]: a } });
    const r = await call(push, { body: { id: ID } });
    assert.equal(r.code, 200, name);
    assert.equal(r.body.sent, 0, name);
  }
  seed();
  const r = await call(push, { body: { id: "-Notherid123456" } });
  assert.equal(r.body.sent, 0);
  assert.equal(wp.sent.length, 0);
});

test("rechaza ids inválidos y métodos que no son POST", async () => {
  for (const id of ["", "x", "../../etc", "a b c d e f g h i j", "a".repeat(41), undefined, { $gt: "" }]) {
    const r = await call(push, { body: { id } });
    assert.equal(r.code, 400, JSON.stringify(id));
  }
  assert.equal((await call(push, { method: "GET" })).code, 405);
  assert.equal(wp.sent.length, 0);
});

test("sin claves VAPID responde 500 y no envía nada", async () => {
  const keep = process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  const r = await call(push, { body: { id: ID } });
  process.env.VAPID_PRIVATE_KEY = keep;
  assert.equal(r.code, 500);
  assert.equal(wp.sent.length, 0);
});

test("sin celulares activados no falla", async () => {
  seed({ pushNode: null });
  const r = await call(push, { body: { id: ID } });
  assert.equal(r.code, 200);
  assert.equal(r.body.sent, 0);
  assert.equal(r.body.reason, "sin dispositivos");
});

test("limpia los celulares que ya no existen (410) y deja los demás", async () => {
  seed({ pushNode: { ok: dev("https://fcm.example/ok"), muerto: dev("https://fcm.example/gone"), roto: dev("https://fcm.example/boom") } });
  const r = await call(push, { body: { id: ID } });
  assert.deepEqual([r.body.sent, r.body.total], [1, 3]);
  const left = node(`${BASE}/push`);
  assert.ok(left.ok, "el sano queda");
  assert.equal(left.muerto, undefined, "el 410 se borra");
  assert.ok(left.roto, "un error 500 pasajero no borra el celular");
});

test("usa solo el negocio de ESTE deploy (no mezcla datos de otro negocio)", async () => {
  state.tree.turneroEstetica.businesses.otro = { push: { x: dev("https://fcm.example/otro") } };
  await call(push, { body: { id: ID } });
  assert.equal(wp.sent.length, 1);
  assert.equal(wp.sent[0].sub.endpoint, "https://fcm.example/ok1");
});
