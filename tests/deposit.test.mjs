import assert from "node:assert/strict";
import {
  depositAmountFor, paymentConfig, depositState, shouldExpire, hoursSinceBooked, hoursUntilExpire,
  DEPOSIT_HOURS, EXPIRE_HOURS,
} from "../src/lib/deposit.js";
import { bookingMessage, depositReminderMessage } from "../src/lib/whatsapp.js";

const H = 3600000;

// ---- monto fijo ----
assert.equal(DEPOSIT_HOURS, 24);
assert.equal(EXPIRE_HOURS, 72);
assert.equal(depositAmountFor(25000, 10000), 10000);
assert.equal(depositAmountFor(10000, 10000), 10000);
assert.equal(depositAmountFor(6000, 10000), 6000, "si el servicio sale menos que la seña, se pide el precio");
assert.equal(depositAmountFor(0, 10000), 10000, "precio 'Consultar' → seña fija");
assert.equal(depositAmountFor(5000.5, 10000), 5000.5, "si el servicio sale menos, es EXACTAMENTE el precio");
assert.equal(depositAmountFor(25000, 0), 0);
assert.equal(depositAmountFor(25000, undefined), 0);
assert.equal(depositAmountFor(25000, -5), 0);

// ---- datos de pago ----
const good = { enabled: true, amount: 10000, alias: "luz.estetica", holder: "Luz Pérez", bank: "Mercado Pago" };
assert.equal(paymentConfig(good).on, true);
assert.equal(paymentConfig(good).bank, "Mercado Pago");
assert.equal(paymentConfig({}).on, false);
assert.equal(paymentConfig(undefined).on, false);
assert.equal(paymentConfig(null).on, false);
assert.equal(paymentConfig({ ...good, enabled: false }).on, false);
assert.equal(paymentConfig({ ...good, enabled: "true" }).on, false, "tiene que ser true de verdad");
assert.equal(paymentConfig({ ...good, amount: 0 }).on, false);
assert.equal(paymentConfig({ ...good, amount: 99.5 }).on, false);
assert.equal(paymentConfig({ ...good, alias: "" }).on, false);
assert.equal(paymentConfig({ ...good, holder: "" }).on, false, "sin titular no hay forma de verificar la cuenta");

// ---- línea de tiempo de la seña ----
const t0 = 1_700_000_000_000;
const base = { depositAmount: 10000, depositStatus: "pendiente", status: "pendiente", createdAt: t0 };
assert.equal(depositState(base, t0 + 1 * H), "pending");
assert.equal(depositState(base, t0 + 23 * H + 59 * 60000), "pending");
assert.equal(depositState(base, t0 + 24 * H), "overdue", "a las 24 hs pasa a rojo");
assert.equal(depositState(base, t0 + 71 * H), "overdue");
assert.equal(depositState({ ...base, status: "confirmado" }, t0 + 30 * H), "overdue");
assert.equal(depositState({ ...base, depositStatus: "recibida" }, t0 + 99 * H), "paid");
assert.equal(depositState({ ...base, depositStatus: "eximida" }, t0 + 99 * H), "waived");
assert.equal(depositState({ ...base, status: "cancelado" }, t0 + 30 * H), null);
assert.equal(depositState({ ...base, status: "completado" }, t0 + 30 * H), null);
assert.equal(depositState({ ...base, status: "ausente" }, t0 + 30 * H), null);
assert.equal(depositState({ status: "pendiente", createdAt: t0 }, t0 + 99 * H), null, "turno sin seña (manual o viejo)");
assert.equal(depositState({ ...base, depositAmount: 0 }, t0 + 99 * H), null);
assert.equal(depositState({ ...base, createdAt: undefined }, t0 + 99 * H), "pending");
assert.equal(depositState(null), null);

// ---- cancelación automática a los 3 días ----
assert.equal(shouldExpire(base, t0 + 71 * H + 59 * 60000), false);
assert.equal(shouldExpire(base, t0 + 72 * H), true);
assert.equal(shouldExpire({ ...base, status: "confirmado" }, t0 + 100 * H), true);
assert.equal(shouldExpire({ ...base, depositStatus: "recibida" }, t0 + 100 * H), false, "señado: nunca se cancela solo");
assert.equal(shouldExpire({ ...base, depositStatus: "eximida" }, t0 + 100 * H), false, "eximido: nunca se cancela solo");
assert.equal(shouldExpire({ ...base, status: "cancelado" }, t0 + 100 * H), false);
assert.equal(shouldExpire({ ...base, status: "completado" }, t0 + 100 * H), false);
assert.equal(shouldExpire({ status: "pendiente", createdAt: t0 }, t0 + 100 * H), false, "sin seña pedida: no se toca");
assert.equal(shouldExpire({ ...base, createdAt: undefined }, t0 + 100 * H), false, "sin fecha de alta no se cancela");
assert.equal(shouldExpire({ ...base, createdAt: "ayer" }, t0 + 100 * H), false);
assert.equal(shouldExpire(null), false);

// ---- helpers de tiempo ----
assert.equal(hoursSinceBooked(base, t0 + 50 * H + 1000), 50);
assert.equal(hoursSinceBooked({}, t0), null);
assert.equal(hoursUntilExpire(base, t0 + 50 * H), 22);
assert.equal(hoursUntilExpire(base, t0 + 71 * H + 1000), 1);
assert.equal(hoursUntilExpire(base, t0 + 200 * H), 0);
assert.equal(hoursUntilExpire({}, t0), null);

// ---- mensajes de WhatsApp ----
const withDep = bookingMessage({ businessName: "Estética", name: "Ana", service: "Lifting", pro: "Lu", dateText: "lunes", time: "10:00", price: 25000, code: "ABC123", deposit: 10000 });
assert.ok(withDep.includes("Seña: $10.000"), "el mensaje incluye la seña");
const noDep = bookingMessage({ businessName: "Estética", name: "Ana", service: "Lifting", pro: "Lu", dateText: "lunes", time: "10:00", price: 25000, code: "ABC123" });
assert.ok(!noDep.includes("Seña"), "sin seña no se menciona");
const rem = depositReminderMessage({ clientName: "Ana Pérez", depositAmount: 10000, time: "10:00", serviceName: "Lifting" }, "lunes 16", { businessName: "Estética", alias: "luz.estetica" });
assert.ok(rem.includes("$10.000") && rem.includes("luz.estetica") && rem.includes("72 hs") && rem.includes("Ana"));

console.log("deposit ok");
