import assert from "node:assert/strict";
import { hashPin, verifyPin, checkLogin, validateNewCreds } from "../api/_creds.js";

// hash: no guarda la clave en texto plano y verifica bien
const h = hashPin("MiClave2026");
assert.ok(h.hash && h.salt && !JSON.stringify(h).includes("MiClave2026"));
assert.equal(verifyPin("MiClave2026", h), true);
assert.equal(verifyPin("miclave2026", h), false);
assert.notEqual(hashPin("MiClave2026").hash, h.hash); // sal distinta cada vez

// sin credenciales guardadas: valen las de fábrica (admin/1234) o las del entorno
assert.equal(checkLogin("admin", "1234", null, {}), true);
assert.equal(checkLogin("ADMIN ", "1234", null, {}), true);
assert.equal(checkLogin("admin", "0000", null, {}), false);
assert.equal(checkLogin("dueño", "x9", null, { ADMIN_USER: "dueño", ADMIN_PIN: "x9" }), true);
assert.equal(checkLogin("admin", "1234", null, { ADMIN_USER: "dueño", ADMIN_PIN: "x9" }), false);

// con credenciales guardadas: las de fábrica y las del entorno YA NO sirven
const saved = { user: "donmateo", ...hashPin("Corte#2026") };
assert.equal(checkLogin("DonMateo", "Corte#2026", saved, {}), true);
assert.equal(checkLogin("admin", "1234", saved, {}), false);
assert.equal(checkLogin("donmateo", "1234", saved, { ADMIN_PIN: "1234" }), false);
assert.equal(checkLogin("donmateo", "otra", saved, {}), false);

// validación de lo nuevo
assert.equal(validateNewCreds("donmateo", "Corte#2026"), "");
assert.ok(validateNewCreds("ab", "Corte#2026"));
assert.ok(validateNewCreds("don mateo", "Corte#2026"));
assert.ok(validateNewCreds("donmateo", "12345"));
assert.ok(validateNewCreds("donmateo", "123456"));
assert.ok(validateNewCreds("donmateo", "DonMateo"));
console.log("creds ok");
