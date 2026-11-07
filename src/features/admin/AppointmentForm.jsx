import { useMemo, useState } from "react";
import { useConfig, useServices, useProfessionals, useAvailability, useBlocked, useLocks, useServiceAgenda, toList } from "../../lib/data";
import { getSlots, blocksFor, agendaTimesFor, toMin, toHHMM, dateLabel } from "../../lib/availability";
import { saveAppointment } from "../../lib/appointmentsApi";
import { diffText, isActive } from "../../lib/appointmentPlan";
import { validateClientData } from "../../lib/validation";
import { todayAR } from "../../lib/db";
import { Field, Status, useSave } from "./ui";

const num = (v, min, def) => (Number.isFinite(Number(v)) && Number(v) >= min && v !== "" && v != null ? Number(v) : def);

// Crear o modificar un turno. onSaved(id, next, existing, action) → el padre ofrece el aviso por WhatsApp.
export default function AppointmentForm({ existing, onSaved, onCancel }) {
  const cfg = useConfig();
  const sv = useServices();
  const pr = useProfessionals();
  const av = useAvailability();
  const bl = useBlocked();
  const ag = useServiceAgenda();
  const [st, run] = useSave();
  const [f, setF] = useState(() => ({
    clientName: existing?.clientName || "",
    clientPhone: existing?.clientPhone || "",
    notes: existing?.notes || "",
    serviceId: existing?.serviceId || "",
    professionalId: existing?.professionalId || "",
    date: existing?.date || todayAR(),
    time: existing?.time || "",
    price: existing ? String(existing.priceAtBooking ?? 0) : "",
    priceTouched: !!existing,
  }));
  const [errs, setErrs] = useState({});
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const c = cfg.data || {};
  const buffer = num(c.bufferMinutes, 0, 0);
  const step = num(c.slotMinutes, 5, 15);
  const tz = c.timezone || "America/Argentina/Buenos_Aires";

  const services = toList(sv.data).filter((s) => !s.deleted && (s.active !== false || s.id === existing?.serviceId));
  const pros = toList(pr.data).filter((p) => !p.deleted && (p.active !== false || p.id === existing?.professionalId));
  const service = services.find((s) => s.id === f.serviceId);
  const prosForService = service
    ? pros.filter((p) => !service.professionalIds || Object.keys(service.professionalIds).length === 0 || service.professionalIds[p.id] || p.id === existing?.professionalId)
    : pros;

  const duration = service
    ? (existing && existing.serviceId === service.id ? Number(existing.duration) : Number(service.duration))
    : 0;

  const locksQ = useLocks(f.professionalId ? [f.professionalId] : [], f.date);
  const slots = useMemo(() => {
    if (!f.professionalId || !f.date || !duration || locksQ.loading) return [];
    const raw = locksQ.locks[f.professionalId] || {};
    // las celdas de ESTE turno no cuentan como ocupadas
    const locks = {};
    for (const [k, v] of Object.entries(raw)) if (!existing || v !== existing.id) locks[k] = v;
    const out = getSlots({
      date: f.date, weekly: av.data?.[f.professionalId]?.weekly,
      agenda: agendaTimesFor(service, ag.data, f.date),
      blocks: blocksFor(toList(bl.data), f.professionalId), locks,
      duration, buffer, step, tz, minNoticeHours: 0, maxDaysAhead: 3650,
    });
    // el horario actual del turno siempre se puede conservar
    if (existing && existing.professionalId === f.professionalId && existing.date === f.date && !out.includes(existing.time)) {
      out.push(existing.time);
      out.sort();
    }
    return out;
  }, [f.professionalId, f.date, duration, locksQ, av.data, bl.data, ag.data, service, buffer, step, tz, existing]);

  if (sv.loading || pr.loading || av.loading || bl.loading || cfg.loading || ag.loading) return <p className="muted">Cargando…</p>;

  function pickService(id) {
    const s = services.find((x) => x.id === id);
    setF((x) => ({ ...x, serviceId: id, time: "", price: x.priceTouched ? x.price : String(s?.price ?? 0) }));
  }

  async function submit(e) {
    e.preventDefault();
    const v = validateClientData({ name: f.clientName, phone: f.clientPhone, notes: f.notes });
    if (!service) v.service = "Elegí un servicio";
    if (!f.professionalId) v.pro = "Elegí un profesional";
    if (!f.date) v.date = "Elegí una fecha";
    if (!f.time) v.time = "Elegí un horario";
    const price = Number(f.price);
    if (!(price >= 0) || f.price === "") v.price = "Precio inválido";
    setErrs(v);
    if (Object.keys(v).length) return;

    const pro = pros.find((p) => p.id === f.professionalId);
    const next = {
      ...(existing ? { ...existing } : {}),
      status: existing && isActive(existing.status) ? existing.status : "confirmado",
      clientName: f.clientName.trim(),
      clientPhone: f.clientPhone.trim(),
      serviceId: service.id,
      serviceName: service.name,
      professionalId: pro.id,
      professionalName: pro.name,
      date: f.date,
      time: f.time,
      endTime: toHHMM(toMin(f.time) + duration),
      duration,
      priceAtBooking: price,
    };
    delete next.id;
    if (f.notes.trim()) next.notes = f.notes.trim(); else delete next.notes;

    const action = existing ? "Modificación" : "Creación manual";
    const detail = existing ? diffText(existing, next) || "Sin cambios" : `${next.serviceName} · ${next.date} ${next.time}`;
    if (existing && !diffText(existing, next) && existing.duration === next.duration) {
      setErrs({ form: "No hay cambios para guardar." });
      return;
    }
    const ok = await run(async () => {
      const id = await saveAppointment({ id: existing?.id, existing, next, buffer, action, detail });
      onSaved(id, { ...next, id }, existing, existing ? "modificado" : "creado");
    }, "Guardado ✓");
    if (!ok) setErrs({ form: "" });
  }

  const conflictMsg = st.err && /CONFLICT/.test(st.msg) ? "Ese horario se acaba de ocupar. Elegí otro." : st.msg;
  const dayInfo = f.date && f.professionalId && duration && !locksQ.loading && slots.length === 0;

  return (
    <form className="admin-card" onSubmit={submit}>
      <h3>{existing ? "Modificar turno" : "Nuevo turno"}</h3>
      <Field label="Nombre y apellido"><input value={f.clientName} onChange={(e) => set("clientName", e.target.value)} maxLength={80} /></Field>
      {errs.name && <p className="form-error">{errs.name}</p>}
      <Field label="Teléfono"><input type="tel" inputMode="tel" value={f.clientPhone} onChange={(e) => set("clientPhone", e.target.value)} /></Field>
      {errs.phone && <p className="form-error">{errs.phone}</p>}
      <Field label="Servicio">
        <select value={f.serviceId} onChange={(e) => pickService(e.target.value)}>
          <option value="">— elegir —</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>)}
        </select>
      </Field>
      {errs.service && <p className="form-error">{errs.service}</p>}
      <Field label="Profesional">
        <select value={f.professionalId} onChange={(e) => setF((x) => ({ ...x, professionalId: e.target.value, time: "" }))}>
          <option value="">— elegir —</option>
          {prosForService.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      {errs.pro && <p className="form-error">{errs.pro}</p>}
      <div className="grid2">
        <Field label="Fecha"><input type="date" min={existing ? undefined : todayAR()} value={f.date} onChange={(e) => setF((x) => ({ ...x, date: e.target.value, time: "" }))} /></Field>
        <Field label="Precio ($)"><input type="number" min="0" inputMode="numeric" value={f.price} onChange={(e) => setF((x) => ({ ...x, price: e.target.value, priceTouched: true }))} /></Field>
      </div>
      {errs.date && <p className="form-error">{errs.date}</p>}
      {errs.price && <p className="form-error">{errs.price}</p>}
      <Field label="Horario" hint={f.date ? dateLabel(f.date) : ""}>
        <select value={f.time} onChange={(e) => set("time", e.target.value)} disabled={!slots.length}>
          <option value="">{locksQ.loading ? "Cargando…" : slots.length ? "— elegir —" : "Sin horarios libres"}</option>
          {slots.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      {dayInfo && <p className="muted small">No hay horarios libres ese día (revisá la agenda del profesional o probá otra fecha).</p>}
      {errs.time && <p className="form-error">{errs.time}</p>}
      <Field label="Observaciones (opcional)"><textarea rows={2} maxLength={300} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      {errs.notes && <p className="form-error">{errs.notes}</p>}
      {errs.form && <p className="form-error">{errs.form}</p>}
      <Status st={{ ...st, msg: st.err ? conflictMsg : st.msg }} />
      <div className="btn-row">
        <button className="btn" disabled={st.busy}>{st.busy ? "Guardando…" : "Guardar"}</button>
        <button className="btn ghost" type="button" onClick={onCancel}>Volver</button>
      </div>
      {existing && !isActive(existing.status) && <p className="muted small">Este turno está cancelado: al guardar vuelve a ocupar el horario.</p>}
    </form>
  );
}