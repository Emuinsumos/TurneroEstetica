import { useMemo, useState } from "react";
import { groupByCategory } from "../lib/hours";
import { SERVICE_TOOLS_MIN, filterGroups, categoryNames } from "../lib/serviceFilter";

// Buscador + categorías para listas largas de servicios.
// Con menos de SERVICE_TOOLS_MIN servicios no muestra nada y la lista queda como siempre.
export function useServiceFilter(services) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(null); // null = todas

  const all = useMemo(() => groupByCategory(services), [services]);
  const names = useMemo(() => categoryNames(all), [all]);
  const enabled = services.length >= SERVICE_TOOLS_MIN;
  // si la categoría elegida desapareció (se editó un servicio), vuelve a "Todos"
  const activeCat = names.includes(category) ? category : null;
  const groups = useMemo(
    () => (enabled ? filterGroups(all, { query, category: activeCat }) : all),
    [all, enabled, query, activeCat]
  );
  const filtering = enabled && (query.trim() !== "" || activeCat !== null);
  const clear = () => { setQuery(""); setCategory(null); };

  return { enabled, query, setQuery, category: activeCat, setCategory, names, groups, filtering, clear };
}

const SearchIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);

export function ServiceTools({ f, placeholder = "Buscar servicio…" }) {
  if (!f.enabled) return null;
  return (
    <div className="svc-tools">
      <div className="svc-search">
        <span className="svc-search-ic">{SearchIcon}</span>
        <input
          type="search"
          value={f.query}
          onChange={(e) => f.setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          enterKeyHint="search"
        />
        {f.query && (
          <button type="button" className="svc-clear" aria-label="Borrar búsqueda" onClick={() => f.setQuery("")}>×</button>
        )}
      </div>
      {f.names.length > 1 && (
        <div className="svc-chips">
          <button type="button" className={`svc-chip ${f.category === null ? "on" : ""}`} aria-pressed={f.category === null} onClick={() => f.setCategory(null)}>
            Todos
          </button>
          {f.names.map((n) => (
            <button key={n} type="button" className={`svc-chip ${f.category === n ? "on" : ""}`} aria-pressed={f.category === n} onClick={() => f.setCategory(f.category === n ? null : n)}>
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Mensaje cuando la búsqueda no encuentra nada
export function NoResults({ f }) {
  if (!f.enabled || f.groups.length > 0) return null;
  return (
    <div className="svc-empty">
      <p className="muted">No encontramos servicios{f.query.trim() ? <> para “{f.query.trim()}”</> : null}.</p>
      <button type="button" className="btn ghost sm" onClick={f.clear}>Ver todos los servicios</button>
    </div>
  );
}
