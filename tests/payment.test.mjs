import assert from "node:assert/strict";
import { validatePayment, ALIAS_RE } from "../src/lib/payment.js";

const ok = { enabled: true, amount: "10000", alias: "luz.estetica", holder: "Luz Pérez", bank: "Mercado Pago" };

// camino feliz
let r = validatePayment(ok);
assert.deepEqual(r.errors, {});
assert.deepEqual(r.value, { enabled: true, amount: 10000, alias: "luz.estetica", holder: "Luz Pérez", bank: "Mercado Pago" });

// alias: 6–20, letras/números/punto/guion
for (const a of ["luz.estetica", "LUZ-2024.mp", "abcdef", "a".repeat(20)]) assert.ok(ALIAS_RE.test(a), a);
for (const a of ["corto", "a".repeat(21), "con espacio", "ñandú.mp", "luz@mp.com", "luz_estetica", "<script>", ""]) assert.ok(!ALIAS_RE.test(a), a);
assert.ok(validatePayment({ ...ok, alias: "con espacio" }).errors.alias);
assert.ok(validatePayment({ ...ok, alias: "corto" }).errors.alias);

// habilitada exige monto, alias y titular
for (const k of ["amount", "alias", "holder"]) {
  assert.ok(validatePayment({ ...ok, [k]: "" }).errors[k], `${k} obligatorio`);
}
// deshabilitada puede guardarse incompleta
assert.deepEqual(validatePayment({ enabled: false, amount: "", alias: "", holder: "", bank: "" }).errors, {});

// monto: entero entre 1 y 1.000.000
for (const bad of ["0", "-5", "10.5", "abc", "1000001", "1e9"]) assert.ok(validatePayment({ ...ok, amount: bad }).errors.amount, bad);
assert.equal(validatePayment({ ...ok, amount: 1 }).value.amount, 1);
assert.equal(validatePayment({ ...ok, amount: 1000000 }).value.amount, 1000000);

// titular: al menos 3 letras; limpia caracteres peligrosos y espacios
assert.ok(validatePayment({ ...ok, holder: "Lu" }).errors.holder);
assert.equal(validatePayment({ ...ok, holder: "  Luz <b>Pérez</b>\n" }).value.holder, "Luz bPérez/b");
assert.equal(validatePayment({ ...ok, bank: "" }).value.bank, null);

// "enabled" tiene que ser true de verdad (no un texto)
assert.equal(validatePayment({ ...ok, enabled: "true" }).value.enabled, false);

console.log("payment ok");
