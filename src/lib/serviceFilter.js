import { groupByCategory } from "./hours.js";

// Con pocos servicios no hace falta buscador ni filtros: la web queda igual que siempre.
export const SERVICE_TOOLS_MIN = 6;

// Minúsculas y sin acentos, para que "unas" encuentre "Uñas" y "depilacion" encuentre "Depilación".
export function normalizeText(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Nombre de categoría tal como se muestra ("Otros" para los servicios sin categoría).
const labelOf = (s) => (s.category || "").trim() || "Otros";

// Filtra los grupos (que ya vienen de groupByCategory) por texto y/o categoría.
// Todas las palabras escritas tienen que aparecer (en nombre, descripción o categoría), en cualquier orden.
export function filterGroups(groups, { query = "", category = null } = {}) {
  const words = normalizeText(query).split(" ").filter(Boolean);
  return groups
    .filter((g) => !category || g.category === category)
    .map((g) => ({
      ...g,
      items: g.items.filter((s) => {
        if (words.length === 0) return true;
        const hay = normalizeText(`${s.name || ""} ${s.description || ""} ${labelOf(s)}`);
        return words.every((w) => hay.includes(w));
      }),
    }))
    .filter((g) => g.items.length > 0);
}

// Lista de categorías en el orden en que se muestran (vacía si no hay categorías cargadas).
export function categoryNames(groups) {
  return groups.length > 1 || (groups.length === 1 && groups[0].category)
    ? groups.map((g) => g.category)
    : [];
}

// Para el admin: si lo que escribió ya existe con otras mayúsculas o acentos, usa la forma ya cargada
// (así "unas" y "Uñas" no terminan siendo dos categorías distintas).
export function canonicalCategory(input, existing = []) {
  const clean = String(input ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const key = normalizeText(clean);
  const match = existing.find((c) => normalizeText(c) === key);
  return match || clean;
}

// Categorías ya usadas por los servicios (sin "Otros"), en el orden en que se muestran.
export function existingCategories(services) {
  const used = new Set(services.map((s) => (s.category || "").trim()).filter(Boolean));
  return categoryNames(groupByCategory(services)).filter((c) => used.has(c));
}
