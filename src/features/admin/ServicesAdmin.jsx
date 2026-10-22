import { useState } from "react";
import { useServices, useProfessionals, toList } from "../../lib/data";
import { dbUpdate, newKey } from "../../lib/db";
import { money } from "../../lib/hours";
import { P } from "../../config/paths";
import { Field, Check, Status, useSave, optional } from "./ui";

export default function ServicesAdmin() {
  const sv = useServices();
  const pr = useProfessionals();
  const [form, setForm] = useState(null);
  const [st, run] = useSave();

  if (sv.loading || pr.loading) return <p className="muted">Cargando…</p>;

  const list = toList(sv.data).filter((s) => !s.deleted).sort((a, b) => (a.order || 0) - (b.order || 0));
  const pros = toList(pr.data).filter((p) => !p.deleted).sort((a, b) => (a.order || 0) - (b.order || 0));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const add = () =>
    setForm({
      id: null, name: "", description: "", price: "0", duration: "30",
      order: String(list.length + 1), active: true, professionalIds: {},
    });

  const edit = (s) =>
    setForm({
      id: s.id, name: s.name || "", description: s.description || "",
      price: String(s.price ?? 0), duration: String(s.duration ?? 30),
      order: String(s.order ?? 1), active: s.active !== false,
      professionalIds: s.professionalIds || {},
    });

  function toggleProf(id, on) {
    const next = { ...form.professionalIds };
    if (on) next[id] = true; else delete next[id];
    set("professionalIds", next);
  }

  async function save(e) {
    e.preventDefault();
    const ok = await run(async () => {
      const name = form.name.trim();
      const price = Number(form.price);
      const duration = Number(form.duration);
      if (name.length < 2) throw new Error("Poné un nombre para el servicio");
      if (!(price >= 0)) throw new Error("El precio no es válido");
      if (!(duration >= 5)) throw new Error("La duración mínima es 5 minutos");
      const id = form.id || newKey(P.services);
      await dbUpdate(`${P.services}/${id}`, {
        name,
        description: optional(form.description),
        price,
        duration,
        order: Number(form.order) || 0,
        active: form.active,
        deleted: false,
        professionalIds: Object.keys(form.professionalIds).length ? form.professionalIds : null,
      });
    });
    if (ok) setForm(null);
  }

  async function remove(s) {
    if (!window.confirm(`¿Eliminar "${s.name}"? Los turnos anteriores conservan su precio.`)) return;
    await run(() => dbUpdate(`${P.services}/${s.id}`, { deleted: true, active: false }), "Servicio eliminado");
  }

  if (form) {
    return (
      <form className="admin-card" onSubmit={save}>
        <h3>{form.id ? "Editar servicio" : "Nuevo servicio"}</h3>
        <Field label="Nombre"><input value={form.name} onChange={(e) => set("name", e.target.value)} required /></Field>
        <Field label="Descripción (opcional)"><input value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <div className="grid2">
          <Field label="Precio ($)"><input type="number" min="0" inputMode="numeric" value={form.price} onChange={(e) => set("price", e.target.value)} /></Field>
          <Field label="Duración (min)"><input type="number" min="5" step="5" inputMode="numeric" value={form.duration} onChange={(e) => set("duration", e.target.value)} /></Field>
        </div>
        <Field label="Orden" hint="Número chico = aparece primero"><input type="number" inputMode="numeric" value={form.order} onChange={(e) => set("order", e.target.value)} /></Field>
        <div className="field">
          <span>Lo realizan</span>
          {pros.length === 0 && <small className="muted">Primero cargá profesionales.</small>}
          {pros.map((p) => (
            <Check key={p.id} checked={!!form.professionalIds[p.id]} onChange={(on) => toggleProf(p.id, on)}>{p.name}</Check>
          ))}
        </div>
        <Check checked={form.active} onChange={(v) => set("active", v)}>Visible para los clientes</Check>
        <Status st={st} />
        <div className="btn-row">
          <button className="btn" type="submit" disabled={st.busy}>{st.busy ? "Guardando…" : "Guardar"}</button>
          <button className="btn ghost" type="button" onClick={() => setForm(null)}>Cancelar</button>
        </div>
      </form>
    );
  }

  return (
    <div className="admin-stack">
      <div className="toolbar">
        <h3>Servicios</h3>
        <button className="btn sm" onClick={add}>+ Nuevo</button>
      </div>
      <Status st={st} />
      {list.length === 0 && <p className="muted">Todavía no hay servicios.</p>}
      {list.map((s) => (
        <div className="admin-row" key={s.id}>
          <div>
            <b>{s.name}</b> {s.active === false && <span className="tag">oculto</span>}
            <p className="muted small">{money(s.price)} · {s.duration} min</p>
          </div>
          <div className="btn-row">
            <button className="btn ghost sm" onClick={() => edit(s)}>Editar</button>
            <button className="btn ghost sm" onClick={() => remove(s)}>Eliminar</button>
          </div>
        </div>
      ))}
    </div>
  );
}
