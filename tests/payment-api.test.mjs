import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";

process.env.VITE_BUSINESS_ID = "b1";
process.env.FIREBASE_SERVICE_ACCOUNT = "{}";
delete process.env.ADMIN_PIN;
delete process.env.ADMIN_USER;
delete process.env.BUSINESS_ID;

const { state, reset } = await import("./helpers/fake-admin.mjs");
const { call } = await import("./helpers/http.mjs");
const { hashPin } = await import("../api/_creds.js");
const { default: payment } = await import("../api/payment.js");

const BASE = "turneroEstetica/businesses/b1";
const node = (path) => path.split("/").reduce((c, k) => (c && c[k] !== undefined ? c[k] : null), state.tree);
const PIN = "Clave-Segura-77";
const good = { currentPin: PIN, enabled: true, amount: 10000, alias: "luz.estetica", holder: "Luz Pérez", bank: "Mercado Pago" };

function withCustomCreds() {
  const { salt, hash } = hashPin(PIN);
  state.tree = { turneroEstetica: { businesses: { b1: { adminAuth: { credentials: { user: "luz", salt, hash } } } } } };
}
beforeEach(() => reset());

test("sin sesión o con token ajeno: rechazado y no se escribe nada", async () => {
  withCustomCreds();
  assert.equal((await call(payment, { body: good })).code, 401, "sin token");
  assert.equal((await call(payment, { token: "falso", body: good })).code, 403, "token inválido");
  assert.equal((await call(payment, { token: "cliente-token", body: good })).code, 403, "no es admin");
  assert.equal((await call(payment, { token: "otro-negocio", body: good })).code, 403, "admin de otro negocio");
  assert.equal(node(`${BASE}/payment`), null);
  assert.equal(node(`${BASE}/auditLog`), null);
});

test("solo acepta POST", async () => {
  withCustomCreds();
  assert.equal((await call(payment, { method: "GET", token: "admin-token" })).code, 405);
  assert.equal((await call(payment, { method: "PUT", token: "admin-token", body: good })).code, 405);
});

test("con la contraseña de fábrica no se puede cambiar el alias", async () => {
  // sin credenciales guardadas y sin ADMIN_PIN en el entorno = admin / 1234
  const r = await call(payment, { token: "admin-token", body: { ...good, currentPin: "1234" } });
  assert.equal(r.code, 403);
  assert.match(r.body.error, /contraseña de fábrica/);
  assert.equal(node(`${BASE}/payment`), null);
});

test("contraseña incorrecta: rechazado, y a los 5 intentos queda bloqueado (aunque después acierte)", async () => {
  withCustomCreds();
  for (let i = 0; i < 5; i++) {
    const r = await call(payment, { token: "admin-token", body: { ...good, currentPin: "mala-clave" } });
    assert.equal(r.code, 401, `intento ${i + 1}`);
  }
  const bloqueado = await call(payment, { token: "admin-token", body: good });
  assert.equal(bloqueado.code, 429, "bloqueado por intentos");
  assert.equal(node(`${BASE}/payment`), null, "no se escribió nada");
  // otra IP no está bloqueada
  assert.equal((await call(payment, { token: "admin-token", body: good, ip: "8.8.8.8" })).code, 200);
});

test("datos inválidos: 400 sin pedir ni gastar intentos de contraseña", async () => {
  withCustomCreds();
  for (const bad of [{ alias: "con espacio" }, { alias: "corto" }, { amount: 0 }, { amount: 10.5 }, { holder: "" }, { amount: "" }]) {
    const r = await call(payment, { token: "admin-token", body: { ...good, ...bad } });
    assert.equal(r.code, 400, JSON.stringify(bad));
  }
  assert.equal(node(`${BASE}/payment`), null);
  assert.equal(node(`${BASE}/adminAuth/payAttempts`), null);
});

test("con sesión + contraseña correcta: guarda y deja registro de auditoría", async () => {
  withCustomCreds();
  const r = await call(payment, { token: "admin-token", body: good });
  assert.equal(r.code, 200);
  const p = node(`${BASE}/payment`);
  assert.equal(p.alias, "luz.estetica");
  assert.equal(p.amount, 10000);
  assert.equal(p.holder, "Luz Pérez");
  assert.equal(p.enabled, true);
  assert.equal(typeof p.updatedAt, "number");
  const log = Object.values(node(`${BASE}/auditLog`));
  assert.equal(log.length, 1);
  assert.equal(log[0].kind, "payment");
  assert.equal(log[0].changes.alias.to, "luz.estetica");
  assert.equal(log[0].changes.alias.from, undefined, "Firebase no guarda null: antes no había alias");
  assert.equal(typeof log[0].at, "number");
  assert.ok(!JSON.stringify(log[0]).includes(PIN), "la contraseña nunca se guarda en el registro");
});

test("cambiar el alias queda registrado con el valor anterior y el nuevo", async () => {
  withCustomCreds();
  await call(payment, { token: "admin-token", body: good });
  const r = await call(payment, { token: "admin-token", body: { ...good, alias: "otro.alias.mp" } });
  assert.equal(r.code, 200);
  assert.deepEqual(r.body.changed, ["alias"]);
  assert.equal(node(`${BASE}/payment`).alias, "otro.alias.mp");
  const log = Object.values(node(`${BASE}/auditLog`)).sort((a, b) => a.at - b.at || 0);
  assert.equal(log.length, 2);
  const cambio = log.find((l) => l.changes.alias?.from === "luz.estetica");
  assert.equal(cambio.changes.alias.to, "otro.alias.mp");
  assert.deepEqual(Object.keys(cambio.changes), ["alias"], "solo se registra lo que cambió");
});

test("guardar lo mismo no genera registros de más", async () => {
  withCustomCreds();
  await call(payment, { token: "admin-token", body: good });
  const r = await call(payment, { token: "admin-token", body: good });
  assert.equal(r.code, 200);
  assert.equal(r.body.unchanged, true);
  assert.equal(Object.keys(node(`${BASE}/auditLog`)).length, 1);
});

test("el texto se limpia antes de guardar", async () => {
  withCustomCreds();
  await call(payment, { token: "admin-token", body: { ...good, holder: "  Luz <b>Pérez</b>  ", bank: "" } });
  const p = node(`${BASE}/payment`);
  assert.equal(p.holder, "Luz bPérez/b");
  assert.equal(p.bank, undefined, "vacío = no se guarda");
});
