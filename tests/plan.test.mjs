import assert from "node:assert/strict";
import { planWrite, diffText } from "../src/lib/appointmentPlan.js";
import { lockCells, toMin } from "../src/lib/availability.js";

const STAMP = "TS";
const L = (p, d, k) => `slotLocks/${p}/${d}/${k}`;
const base = {
  clientName: "Ana Pérez", clientPhone: "11 2345 6789", serviceId: "s1", serviceName: "Corte",
  professionalId: "p1", professionalName: "Prof 1", date: "2026-10-20", time: "09:00", endTime: "09:30",
  duration: 30, status: "pendiente", priceAtBooking: 1000, createdAt: 111,
};
const cellsOf = (time, dur, buf = 0) => lockCells(toMin(time), dur + buf);
const own = (cells, id) => Object.fromEntries(cells.map((k) => [k, id]));

// 1) crear
let u = planWrite({ id: "A", existing: null, next: { ...base, status: "confirmado", createdAt: undefined }, locksNew: {}, stamp: STAMP, histKey: "h1", action: "Creación", detail: "x" });
assert.equal(u["appointments/A"].createdAt, STAMP);
assert.deepEqual(u["appointments/A"].slots, cellsOf("09:00", 30));
assert.equal(u[L("p1", "2026-10-20", "0900")], "A");
assert.equal(Object.keys(u).filter((k) => k.startsWith("slotLocks")).length, 6);
assert.equal(u["appointments/A"].history.h1.action, "Creación");

// 2) conflicto con otro turno
assert.throws(() => planWrite({ id: "A", existing: null, next: base, locksNew: { "0910": "OTRO" }, stamp: STAMP, histKey: "h", action: "x" }), (e) => e.code === "CONFLICT");

// 3) mover 15 min dentro del mismo día: las celdas compartidas NO se tocan
const ex = { ...base, slots: cellsOf("09:00", 30), history: { h0: { at: 1 } } };
u = planWrite({
  id: "A", existing: ex, next: { ...ex, time: "09:15", endTime: "09:45" },
  locksNew: own(cellsOf("09:00", 30), "A"), locksOld: own(cellsOf("09:00", 30), "A"),
  stamp: STAMP, histKey: "h2", action: "Modificación",
});
assert.equal(u[L("p1", "2026-10-20", "0900")], null);       // se libera
assert.equal(u[L("p1", "2026-10-20", "0910")], null);
assert.ok(!(L("p1", "2026-10-20", "0915") in u));             // compartida: intacta
assert.ok(!(L("p1", "2026-10-20", "0925") in u));
assert.equal(u[L("p1", "2026-10-20", "0930")], "A");          // nueva
assert.equal(u[L("p1", "2026-10-20", "0940")], "A");
assert.equal(u["appointments/A"].history.h0.at, 1);           // conserva historial previo
assert.equal(u["appointments/A"].history.h2.action, "Modificación");

// 4) cancelar: libera todo, conserva el registro y borra slots
u = planWrite({ id: "A", existing: ex, next: { ...ex, status: "cancelado" }, locksOld: own(cellsOf("09:00", 30), "A"), stamp: STAMP, histKey: "h3", action: "Cancelación", detail: "Cancelado" });
const freed = Object.entries(u).filter(([k, v]) => k.startsWith("slotLocks") && v === null);
assert.equal(freed.length, 6);
assert.equal(Object.entries(u).filter(([k, v]) => k.startsWith("slotLocks") && v !== null).length, 0);
assert.equal(u["appointments/A"].status, "cancelado");
assert.ok(!("slots" in u["appointments/A"]));

// 5) cambio de estado sin cambiar horario: no toca celdas
u = planWrite({ id: "A", existing: ex, next: { ...ex, status: "confirmado" }, locksOld: own(cellsOf("09:00", 30), "A"), stamp: STAMP, histKey: "h4", action: "Estado" });
assert.equal(Object.keys(u).filter((k) => k.startsWith("slotLocks")).length, 0);
assert.deepEqual(u["appointments/A"].slots, ex.slots);

// 6) reabrir un turno cancelado: vuelve a tomar celdas (y valida conflicto)
const canc = { ...base, status: "cancelado" };
u = planWrite({ id: "A", existing: canc, next: { ...canc, status: "confirmado" }, locksNew: {}, stamp: STAMP, histKey: "h5", action: "Estado" });
assert.equal(u[L("p1", "2026-10-20", "0900")], "A");
assert.throws(() => planWrite({ id: "A", existing: canc, next: { ...canc, status: "confirmado" }, locksNew: { "0900": "B" }, stamp: STAMP, histKey: "h", action: "x" }), (e) => e.code === "CONFLICT");

// 7) cambiar de profesional y fecha
u = planWrite({
  id: "A", existing: ex, next: { ...ex, professionalId: "p2", date: "2026-10-21" },
  locksNew: {}, locksOld: own(cellsOf("09:00", 30), "A"), stamp: STAMP, histKey: "h6", action: "Modificación",
});
assert.equal(u[L("p1", "2026-10-20", "0900")], null);
assert.equal(u[L("p2", "2026-10-21", "0900")], "A");
assert.equal(u[L("p2", "2026-10-21", "0925")], "A");

// 8) nunca libera celdas de otro turno
u = planWrite({ id: "A", existing: ex, next: { ...ex, status: "cancelado" }, locksOld: { "0900": "A", "0905": "OTRO" }, stamp: STAMP, histKey: "h7", action: "x" });
assert.equal(u[L("p1", "2026-10-20", "0900")], null);
assert.ok(!(L("p1", "2026-10-20", "0905") in u));

// 9) con buffer de 10 min ocupa 40 min
u = planWrite({ id: "A", existing: null, next: base, buffer: 10, locksNew: {}, stamp: STAMP, histKey: "h", action: "x" });
assert.equal(u["appointments/A"].slots.length, 8);

// 10) notes vacías no se guardan; diffText
u = planWrite({ id: "A", existing: null, next: { ...base, notes: "" }, locksNew: {}, stamp: STAMP, histKey: "h", action: "x" });
assert.ok(!("notes" in u["appointments/A"]));
assert.equal(diffText(base, { ...base, time: "10:00", status: "confirmado" }), "hora: 09:00 → 10:00; estado: pendiente → confirmado");

// 11) ningún camino es prefijo de otro (Firebase lo rechaza)
const paths = Object.keys(planWrite({ id: "A", existing: ex, next: { ...ex, time: "09:15" }, locksNew: own(cellsOf("09:00", 30), "A"), locksOld: own(cellsOf("09:00", 30), "A"), stamp: STAMP, histKey: "h", action: "x" }));
for (const a of paths) for (const b of paths) if (a !== b) assert.ok(!b.startsWith(a + "/"), `${a} es prefijo de ${b}`);

console.log("OK: 11 pruebas de planWrite pasan");
