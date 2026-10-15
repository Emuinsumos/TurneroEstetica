import { useState } from "react";
import { useProfessionals, toList } from "../../lib/data";
import { dbUpdate, dbSet, newKey } from "../../lib/db";
import { defaultWeekly } from "../../lib/schedule";
import { P } from "../../config/paths";
import { Field, Check, Status, useSave, optional, linesToList } from "./ui";
import { ImageInput, ImageListInput } from "./ImageInput";

export default function ProfessionalsAdmin() {
  const pr = useProfessionals();
  const [form, setForm] = useState(null);
  const [st, run] = useSave();

  if (pr.loading) return <p className="muted">Cargando…</p>;

  const list = toList(pr.data).filter((p) => !p.deleted).sort((a, b) => (a.order || 0) - (b.order || 0));
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const add = () =>
    setForm({ id: null, name: "", description: "", photo: "", gallery: [], order: String(list.length + 1), active: true });

  const edit = (p) =>
    setForm({
      id: p.id, name: p.name || "", description: p.description || "", photo: p.photo || "",
      gallery: Array.isArray(p.gallery) ? p.gallery : Object.values(p.gallery || {}),
      order: String(p.order ?? 1), active: p.active !== false,
    });

  async function save(e) {
    e.preventDefault();
    const ok = await run(async () => {
      const name = form.name.trim();
      if (name.length < 2) throw new Error("Poné un nombre");
      const isNew = !form.id;
      const id = form.id || newKey(P.professionals);
      const gallery = form.gallery.filter(Boolean);
      await dbUpdate(`${P.professionals}/${id}`, {
        name,
        description: optional(form.description),
        photo: optional(form.photo),
        gallery: gallery.length ? gallery : null,
        order: Number(form.order) || 0,
        active: form.active,
        deleted: false,
      });
      // Un profesional nuevo arranca con horario de lunes a viernes (editable en Agenda)
      if (isNew) await dbSet(`${P.availability(id)}/weekly`, defaultWeekly());
    });
    if (ok) setForm(null);
  }

  async function remove(p) {
    if (!window.confirm(`¿Eliminar a "${p.name}"? Sus turnos anteriores se conservan.`)) return;
    await run(() => dbUpdate(`${P.professionals}/${p.id}`, { deleted: true, active: false }), "Profesional eliminado");
  }

  if (form) {
    return (
      <form className="admin-card" onSubmit={save}>
        <h3>{form.id ? "Editar profesional" : "Nuevo profesional"}</h3>
        <Field label="Nombre"><input value={form.name} onChange={(e) => set("name", e.target.value)} required /></Field>
        <Field label="Descripción / especialidad"><input value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <ImageInput label="Foto de perfil" value={form.photo} onChange={(v) => set("photo", v)} maxSide={480} maxBytes={50000} round />
        <ImageListInput label="Galería de trabajos" values={form.gallery} onChange={(v) => set("gallery", v)} hint="Elegí varias fotos del celular; se comprimen solas." />
        <Field label="Orden"><input type="number" inputMode="numeric" value={form.order} onChange={(e) => set("order", e.target.value)} /></Field>
        <Check checked={form.active} onChange={(v) => set("active", v)}>Activo (los clientes pueden elegirlo)</Check>
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
        <h3>Profesionales</h3>
        <button className="btn sm" onClick={add}>+ Nuevo</button>
      </div>
      <Status st={st} />
      {list.length === 0 && <p className="muted">Todavía no hay profesionales.</p>}
      {list.map((p) => (
        <div className="admin-row" key={p.id}>
          <div>
            <b>{p.name}</b> {p.active === false && <span className="tag">inactivo</span>}
            {p.description && <p className="muted small">{p.description}</p>}
          </div>
          <div className="btn-row">
            <button className="btn ghost sm" onClick={() => edit(p)}>Editar</button>
            <button className="btn ghost sm" onClick={() => remove(p)}>Eliminar</button>
          </div>
        </div>
      ))}
    </div>
  );
}
