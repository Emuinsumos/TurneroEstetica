// Lógica pura de disponibilidad (sin Firebase, se puede probar con node).
//
// Anti doble reserva: cada turno bloquea celdas de GRAIN minutos en
// slotLocks/{prof}/{fecha}/{HHmm}. Como la granularidad es fija (5 min),
// el sistema sigue siendo correcto aunque después se cambie el intervalo de turnos.

export const GRAIN = 5;

export const pad = (n) => String(n).padStart(2, "0");
export const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};
export const toHHMM = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
export const lockKey = (min) => `${pad(Math.floor(min / 60))}${pad(min % 60)}`;

// Celdas de bloqueo que ocupa un turno que empieza en startMin y dura spanMin
export function lockCells(startMin, spanMin) {
  const n = Math.ceil(spanMin / GRAIN);
  const out = [];
  for (let i = 0; i < n; i++) {
    const m = startMin + i * GRAIN;
    if (m >= 1440) break;
    out.push(lockKey(m));
  }
  return out;
}

// Fecha y hora actuales en la zona horaria del negocio
export function nowInTz(tz = "America/Argentina/Buenos_Aires") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t).value;
  return {
    date: `${g("year")}-${g("month")}-${g("day")}`,
    minutes: Number(g("hour")) * 60 + Number(g("minute")),
  };
}

const utc = (d) => {
  const [y, m, dd] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, dd);
};
export const dayDiff = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
export const weekday = (d) => new Date(utc(d)).getUTCDay();
export const addDays = (d, n) => {
  const x = new Date(utc(d) + n * 86400000);
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
};
export const dateLabel = (d) =>
  new Date(utc(d)).toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });

// Bloqueos que aplican a un profesional (los de "all" aplican a todos)
export const blocksFor = (blocks, profId) =>
  (blocks || []).filter((b) => b.professionalId === "all" || b.professionalId === profId);

/**
 * Horarios libres ("HH:MM") de un profesional en una fecha.
 * locks: { "0900": "idTurno", ... } de ese profesional y fecha (null = ignorar reservas)
 */
export function getSlots({
  date, weekly, blocks = [], locks = null,
  duration, buffer = 0, step = 15, tz,
  minNoticeHours = 0, maxDaysAhead = 30,
}) {
  if (!date || !(duration > 0)) return [];
  const now = nowInTz(tz);
  const diff = dayDiff(now.date, date);
  if (diff < 0 || diff > maxDaysAhead) return [];

  const day = weekly && weekly[weekday(date)];
  if (!day || !day.open || !day.from || !day.to) return [];

  const open = toMin(day.from);
  const close = toMin(day.to);
  const bFrom = day.breakFrom ? toMin(day.breakFrom) : null;
  const bTo = day.breakTo ? toMin(day.breakTo) : null;

  const ranges = [];
  for (const b of blocks) {
    if (b.date !== date) continue;
    if (b.from && b.to) ranges.push([toMin(b.from), toMin(b.to)]);
    else ranges.push([0, 1440]); // día completo
  }

  const span = duration + buffer;
  const out = [];
  for (let s = open; s + duration <= close; s += step) {
    const e = s + duration;
    if (diff * 1440 + s < now.minutes + minNoticeHours * 60) continue;
    if (bFrom !== null && bTo !== null && s < bTo && e > bFrom) continue;
    if (ranges.some(([rs, re]) => s < re && e > rs)) continue;
    if (locks && lockCells(s, span).some((k) => locks[k])) continue;
    out.push(toHHMM(s));
  }
  return out;
}

// Minutos trabajables de un profesional en una fecha (horario - descanso - bloqueos)
export function capacityMinutes(weekly, date, blocks = []) {
  const day = weekly && weekly[weekday(date)];
  if (!day || !day.open || !day.from || !day.to) return 0;
  let cap = toMin(day.to) - toMin(day.from);
  if (day.breakFrom && day.breakTo) cap -= toMin(day.breakTo) - toMin(day.breakFrom);
  for (const b of blocks) {
    if (b.date !== date) continue;
    if (!b.from || !b.to) return 0;
    cap -= toMin(b.to) - toMin(b.from);
  }
  return Math.max(cap, 0);
}
