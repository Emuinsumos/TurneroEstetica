import { useState } from "react";
import { useConfig } from "../../lib/data";
import { dbUpdate } from "../../lib/db";
import { P } from "../../config/paths";
import { Field, Check, Status, useSave, optional } from "./ui";
import { ImageInput, ImageListInput } from "./ImageInput";

export default function BusinessAdmin() {
  const cfg = useConfig();
  if (cfg.loading) return <p className="muted">Cargando…</p>;
  return <BusinessForm c={cfg.data || {}} />;
}

function BusinessForm({ c }) {
  const gal = Array.isArray(c.gallery) ? c.gallery : Object.values(c.gallery || {});
  const [f, setF] = useState({
    name: c.name || "", category: c.category || "", description: c.description || "",
    accentColor: c.accentColor || "#d4a85a", logo: c.logo || "", heroImage: c.heroImage || "",
    gallery: gal,
    whatsapp: c.whatsapp || "", address: c.address || "", mapsUrl: c.mapsUrl || "",
    instagram: c.instagram || "", facebook: c.facebook || "", tiktok: c.tiktok || "",
    cancelPolicy: c.cancelPolicy || "",
    slotMinutes: String(c.slotMinutes ?? 15), bufferMinutes: String(c.bufferMinutes ?? 0),
    minNoticeHours: String(c.minNoticeHours ?? 2), maxDaysAhead: String(c.maxDaysAhead ?? 30),
    clientChoosesProfessional: c.clientChoosesProfessional !== false,
    allowMultiService: !!c.allowMultiService,
  });
  const [st, run] = useSave();
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const text = (k, label, props = {}, hint) => (
    <Field label={label} hint={hint}>
      <input value={f[k]} onChange={(e) => set(k, e.target.value)} {...props} />
    </Field>
  );

  async function save(e) {
    e.preventDefault();
    await run(async () => {
      if (f.name.trim().length < 2) throw new Error("Poné el nombre del negocio");
      const num = (k, min, label) => {
        const n = Number(f[k]);
        if (!(n >= min)) throw new Error(`${label} no es válido`);
        return n;
      };
      const wa = f.whatsapp.replace(/\D/g, "");
      const gallery = f.gallery.filter(Boolean);
      await dbUpdate(P.config, {
        name: f.name.trim(),
        category: optional(f.category),
        description: optional(f.description),
        accentColor: f.accentColor,
        logo: optional(f.logo),
        heroImage: optional(f.heroImage),
        gallery: gallery.length ? gallery : null,
        whatsapp: wa || null,
        address: optional(f.address),
        mapsUrl: optional(f.mapsUrl),
        instagram: optional(f.instagram),
        facebook: optional(f.facebook),
        tiktok: optional(f.tiktok),
        cancelPolicy: optional(f.cancelPolicy),
        slotMinutes: num("slotMinutes", 5, "El intervalo de turnos"),
        bufferMinutes: num("bufferMinutes", 0, "El tiempo entre clientes"),
        minNoticeHours: num("minNoticeHours", 0, "La anticipación mínima"),
        maxDaysAhead: num("maxDaysAhead", 1, "Los días de reserva a futuro"),
        clientChoosesProfessional: f.clientChoosesProfessional,
        allowMultiService: f.allowMultiService,
      });
    });
  }

  return (
    <form className="admin-stack" onSubmit={save}>
      <div className="admin-card">
        <h3>Datos del negocio</h3>
        {text("name", "Nombre", { required: true })}
        {text("category", "Rubro", { placeholder: "Barbería, manicura, masajes…" })}
        <Field label="Descripción"><textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="Color de acento"><input type="color" value={f.accentColor} onChange={(e) => set("accentColor", e.target.value)} style={{ height: 48, padding: 4 }} /></Field>
        <ImageInput label="Logo" value={f.logo} onChange={(v) => set("logo", v)} maxSide={320} maxBytes={40000} round aspect={1} hint="Al elegirla vas a poder acomodarla y centrarla." />
        <ImageInput label="Imagen de portada" value={f.heroImage} onChange={(v) => set("heroImage", v)} maxSide={1400} maxBytes={200000} aspect={[{ label: "Vertical (celular)", value: 4 / 5 }, { label: "Horizontal (compu)", value: 16 / 9 }]} hint="Al elegirla vas a poder acomodarla. Se ve de fondo en la portada." />
        <ImageListInput label="Galería de trabajos" values={f.gallery} onChange={(v) => set("gallery", v)} aspect={1} hint="Elegí varias fotos: las acomodás de a una y quedan cuadradas." />
      </div>

      <div className="admin-card">
        <h3>Contacto</h3>
        {text("whatsapp", "WhatsApp", { inputMode: "tel", placeholder: "5491122334455" }, "Con código de país, sin + ni espacios")}
        {text("address", "Dirección")}
        {text("mapsUrl", "Link de Google Maps (opcional)", { type: "url" })}
        {text("instagram", "Instagram (link)", { type: "url" })}
        {text("facebook", "Facebook (link)", { type: "url" })}
        {text("tiktok", "TikTok (link)", { type: "url" })}
        <Field label="Cancelaciones y puntualidad"><textarea rows={3} value={f.cancelPolicy} onChange={(e) => set("cancelPolicy", e.target.value)} /></Field>
      </div>

      <div className="admin-card">
        <h3>Reservas</h3>
        <div className="grid2">
          {text("slotMinutes", "Intervalo de turnos (min)", { type: "number", inputMode: "numeric", min: 5, step: 5 })}
          {text("bufferMinutes", "Tiempo entre clientes (min)", { type: "number", inputMode: "numeric", min: 0, step: 5 })}
          {text("minNoticeHours", "Anticipación mínima (hs)", { type: "number", inputMode: "numeric", min: 0 })}
          {text("maxDaysAhead", "Reservar hasta (días)", { type: "number", inputMode: "numeric", min: 1 })}
        </div>
        <Check checked={f.clientChoosesProfessional} onChange={(v) => set("clientChoosesProfessional", v)}>El cliente elige profesional</Check>
        <Check checked={f.allowMultiService} onChange={(v) => set("allowMultiService", v)}>Permitir más de un servicio por turno</Check>
      </div>

      <Status st={st} />
      <button className="btn lg" type="submit" disabled={st.busy}>{st.busy ? "Guardando…" : "Guardar cambios"}</button>
    </form>
  );
}
