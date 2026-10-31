const NAMES = {
  0: "Domingo", 1: "Lunes", 2: "Martes", 3: "Miércoles",
  4: "Jueves", 5: "Viernes", 6: "Sábado",
};
const ORDER = [1, 2, 3, 4, 5, 6, 0];

// Filas Lun→Dom para mostrar en tabla
export function dayRows(weekly = {}) {
  return ORDER.map((d) => {
    const w = weekly[d];
    return {
      key: d,
      day: NAMES[d],
      open: !!(w && w.open),
      text: w && w.open ? `${w.from} – ${w.to}` : "Cerrado",
    };
  });
}

// Horario del negocio = el más amplio entre profesionales que abren ese día
export function businessWeekly(all = {}) {
  const out = {};
  for (let d = 0; d <= 6; d++) {
    const open = Object.values(all || {})
      .map((a) => a?.weekly?.[d])
      .filter((w) => w && w.open);
    out[d] = open.length
      ? {
          open: true,
          from: open.map((w) => w.from).sort()[0],
          to: open.map((w) => w.to).sort().slice(-1)[0],
        }
      : { open: false };
  }
  return out;
}

export const money = (n) =>
  Number(n) > 0 ? `$${Number(n).toLocaleString("es-AR")}` : "Consultar";

export const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

// Agrupa servicios por categoría (opcional). Si ninguno tiene categoría, devuelve un solo grupo sin título.
export function groupByCategory(list) {
  const map = new Map();
  for (const s of list) {
    const k = (s.category || "").trim();
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(s);
  }
  if (map.size === 1 && map.has("")) return [{ category: "", items: list }];
  const minOrder = (items) => Math.min(...items.map((i) => i.order || 0));
  return [...map.entries()]
    .map(([category, items]) => ({ category: category || "Otros", items }))
    .sort((a, b) => (a.category === "Otros") - (b.category === "Otros") || minOrder(a.items) - minOrder(b.items));
}
