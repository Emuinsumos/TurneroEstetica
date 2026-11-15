import assert from "node:assert/strict";
import * as A from "../src/lib/availability.js";

const tz = "America/Argentina/Buenos_Aires";
const now = A.nowInTz(tz);
// una fecha futura que caiga lunes (día 1), para que no dependa de la hora actual
let d = A.addDays(now.date, 3);
while (A.weekday(d) !== 1) d = A.addDays(d, 1);
const sunday = A.addDays(d, -1);
const weekly = {
  1: { open: true, from: "09:00", to: "12:00", breakFrom: "10:00", breakTo: "10:30" },
  0: { open: false },
};
const base = { date: d, weekly, duration: 30, tz, maxDaysAhead: 60 };

// 1) descansos: 09:00 ok, 09:30 ok, 10:00 y 10:30? (10:30 libre), 11:00, 11:30
assert.deepEqual(A.getSlots(base), ["09:00", "09:30", "10:30", "11:00", "11:30"]);
// 2) día cerrado
assert.deepEqual(A.getSlots({ ...base, date: sunday }), []);
// 3) bloqueo de franja y de día completo
assert.deepEqual(
  A.getSlots({ ...base, blocks: [{ date: d, from: "11:00", to: "12:00" }] }),
  ["09:00", "09:30", "10:30"]
);
assert.deepEqual(A.getSlots({ ...base, blocks: [{ date: d }] }), []);
// 4) reserva existente: turno 09:30 de 30 min => celdas 0930..0955
const locks = {};
A.lockCells(570, 30).forEach((k) => (locks[k] = "x"));
assert.deepEqual(A.lockCells(570, 30), ["0930", "0935", "0940", "0945", "0950", "0955"]);
assert.deepEqual(A.getSlots({ ...base, locks }), ["09:00", "10:30", "11:00", "11:30"]);
// 5) servicio de 60 min: 09:00, el siguiente choca con el descanso y sigue a las 10:30;
//    11:30 es la última hora de inicio posible (termina 12:30, pasado el cierre)
assert.deepEqual(A.getSlots({ ...base, duration: 60 }), ["09:00", "10:30", "11:30"]);
// 6) buffer: con 15 min extra, un turno a las 09:00 bloquea hasta 09:44 -> 09:30 queda tomado
const l2 = {};
A.lockCells(540, 30 + 15).forEach((k) => (l2[k] = "y"));
assert.deepEqual(A.getSlots({ ...base, buffer: 15, locks: l2 }).slice(0, 2), ["10:30", "11:15"]);
// 7) fuera de rango de días futuros
assert.deepEqual(A.getSlots({ ...base, maxDaysAhead: 1 }), []);
// 8) fecha pasada
assert.deepEqual(A.getSlots({ ...base, date: A.addDays(now.date, -1) }), []);
// 9) anticipación mínima enorme descarta todo
assert.deepEqual(A.getSlots({ ...base, minNoticeHours: 24 * 30 }), []);
// 10) hoy: ningún horario anterior a ahora + anticipación
const todayWd = A.weekday(now.date);
const allDay = { [todayWd]: { open: true, from: "00:00", to: "23:30" } };
const todaySlots = A.getSlots({ date: now.date, weekly: allDay, duration: 30, tz, minNoticeHours: 2 });
for (const t of todaySlots) assert.ok(A.toMin(t) >= now.minutes + 120, `slot ${t} es demasiado pronto`);
// 11) servicio de 120 min: turnos encadenados por duración, sin intervalo fijo
const weekly2 = { 1: { open: true, from: "09:00", to: "18:00" } };
const b120 = { date: d, weekly: weekly2, duration: 120, tz, maxDaysAhead: 60 };
assert.deepEqual(A.getSlots(b120), ["09:00", "11:00", "13:00", "15:00", "17:00"]);
// con un turno de 120 min reservado 11:00-13:00 se ofrecen los demás
const l3 = {};
A.lockCells(660, 120).forEach((k) => (l3[k] = "z"));
assert.deepEqual(A.getSlots({ ...b120, locks: l3 }), ["09:00", "13:00", "15:00", "17:00"]);
// si hay un turno corto 10:00-11:00, el de 120 min arranca justo cuando termina
const l4 = {};
A.lockCells(600, 60).forEach((k) => (l4[k] = "w"));
assert.deepEqual(A.getSlots({ ...b120, locks: l4 }), ["11:00", "13:00", "15:00", "17:00"]);
// lunes 09:30 a 12:30 y servicio de 120 min: 09:30 y 11:30 (el "hasta" es la última hora de inicio)
const weekly3 = { 1: { open: true, from: "09:30", to: "12:30" } };
assert.deepEqual(A.getSlots({ date: d, weekly: weekly3, duration: 120, tz, maxDaysAhead: 60 }), ["09:30", "11:30"]);
// 12) utilidades
assert.equal(A.dayDiff("2026-10-14", "2026-10-16"), 2);
assert.equal(A.addDays("2026-12-31", 1), "2027-01-01");
assert.equal(A.weekday("2026-10-14"), 3); // miércoles
console.log("OK: todas las pruebas de disponibilidad pasan", { hoy: now.date, lunesProbado: d, slotsHoy: todaySlots.length });
