export const DAYS = [
  { k: 1, n: "Lunes" },
  { k: 2, n: "Martes" },
  { k: 3, n: "Miércoles" },
  { k: 4, n: "Jueves" },
  { k: 5, n: "Viernes" },
  { k: 6, n: "Sábado" },
  { k: 0, n: "Domingo" },
];

export function defaultWeekly() {
  const w = {};
  for (const d of DAYS) {
    w[d.k] = d.k >= 1 && d.k <= 5 ? { open: true, from: "09:00", to: "18:00" } : { open: false };
  }
  return w;
}
