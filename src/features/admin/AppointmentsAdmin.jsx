import { useState } from "react";
import { useAppointments, useServices, useProfessionals, useConfig, toList } from "../../lib/data";
import { todayAR } from "../../lib/db";
import { dateLabel, addDays, weekday } from "../../lib/availability";
import { money } from "../../lib/hours";
import { clientMessage, clientWaNumber, waLink } from "../../lib/whatsapp";
import { STATUSES, isActive } from "../../lib/appointmentPlan";
import { saveAppointment, withoutId } from "../../lib/appointmentsApi";
import { notifyAuto } from "../../lib/notify";
import { Status, useSave } from "./ui";
import AppointmentForm from "./AppointmentForm";

const VIEWS = [["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"], ["todos", "Todos"]];
const STATUS_LABEL = { pendiente: "Pendiente", confirmado: "Confirmado", cancelado: "Cancelado", completado: "Completado", ausente: "Ausente" };

function range(view, anchor) {
  if (view === "dia") return [anchor, anchor];
  if (view === "semana") {
    const from = addDays(anchor, -((weekday(anchor) + 6) % 7));
    return [from, addDays(from, 6)];
  }
  if (view === "mes") {
    const [y, m] = anchor.split("-");
    const last = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
    return [`${y}-${m}-01`, `${y}-${m}-${String(last).padStart(2, "0")}`];
  }
  return ["0000-00-00", "9999-99-99"];
}
function shift(view, anchor, dir) {
  if (view === "dia") return addDays(anchor, dir);
  if (view === "semana") return addDays(anchor, 7 * dir);
  const [y, m] = anchor.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + dir, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
const fmtAt = (at) => (typeof at === "number" ? new Date(at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "");

export default function AppointmentsAdmin() {
  const ap = useAppointments();
  const sv = useServices();
  const pr = useProfessionals();
  const cfg = useConfig();
  const [view, setView] = useState("semana");
  const [anchor, setAnchor] = useState(todayAR());
  const [fPro, setFPro] = useState("");
  const [fSrv, setFSrv] = useState("");
  const [fSt, setFSt] = useState("");
  const [mode, setMode] = useState({ name: "list" }); // list | new | edit | detail
  const [notice, setNotice] = useState(null);
  const [st, run] = useSave();

  if (ap.loading || sv.loading || pr.loading || cfg.loading) return <p className="muted">Cargando…</p>;
  if (ap.error) return <p className="form-error">No se pudo leer: {ap.error}</p>;

  const all = toList(ap.data);
  const pros = toList(pr.data).filter((p) => !p.deleted);
  const srvs = toList(sv.data).filter((s) => !s.deleted);
  const buffer = Number(cfg.data?.bufferMinutes) || 0;
  const bizName = cfg.data?.name;

  // Intenta el envío automático; si no está configurado o falla, ofrece el link manual.
  async function offerWa(kind, a, existing) {
    const link = waLink(clientWaNumber(a.clientPhone), clientMessage(kind, a, dateLabel(a.date)));
    const manual = link ? { kind, name: a.clientName, link, moved: existing && (existing.date !== a.date || existing.time !== a.time) } : null;
    setNotice({ kind, name: a.clientName, sending: true });
    const r = await notifyAuto(kind, a.id);
    if (r.ok) setNotice({ kind, name: a.clientName, auto: true });
    else setNotice(manual && { ...manual, failed: r.reason && r.reason !== "not_configured" ? r.error || r.reason : "" });
  }

  async function changeStatus(a, status, extra = {}) {
    const ok = await run(async () => {
      const next = { ...withoutId(a), status };
      const label = STATUS_LABEL[status];
      await saveAppointment({
        id: a.id, existing: a, next, buffer,
        action: status === "cancelado" ? "Cancelación" : `Estado: ${label}`,
        detail: `${STATUS_LABEL[a.status] || a.status} → ${label}${extra.reason ? ` · Motivo: ${extra.reason}` : ""}`,
      });
    }, "Estado actualizado ✓");
    if (ok) {
      const upd = { ...a, status };
      setMode({ name: "detail", id: a.id });
      if (status === "cancelado") offerWa("cancelado", upd, a);
      else if (status === "confirmado") offerWa("confirmado", upd, a);
      else setNotice(null);
    }
  }

  async function cancel(a) {
    if (!window.confirm(`¿Cancelar el turno de ${a.clientName}? El horario queda libre y el registro se conserva.`)) return;
    const reason = window.prompt("Motivo (opcional):") || "";
    await changeStatus(a, "cancelado", { reason: reason.trim() });
  }

  // ---------- formulario ----------
  if (mode.name === "new" || mode.name === "edit") {
    const existing = mode.name === "edit" ? all.find((a) => a.id === mode.id) : null;
    return (
      <AppointmentForm
        existing={existing}
        onCancel={() => setMode(existing ? { name: "detail", id: existing.id } : { name: "list" })}
        onSaved={(id, next, ex, kind) => {
          offerWa(kind, next, ex);
          setMode({ name: "detail", id });
        }}
      />
    );
  }

  // ---------- detalle ----------
  if (mode.name === "detail") {
    const a = all.find((x) => x.id === mode.id);
    if (!a) return <div className="admin-stack"><p className="muted">Ese turno ya no existe.</p><button className="btn ghost" onClick={() => setMode({ name: "list" })}>Volver</button></div>;
    const hist = Object.values(a.history || {}).sort((x, y) => (x.at || 0) - (y.at || 0));
    const link = waLink(clientWaNumber(a.clientPhone), `Hola ${String(a.clientName).split(" ")[0]}, te escribimos${bizName ? ` de ${bizName}` : ""} por tu turno del ${dateLabel(a.date)} a las ${a.time}.`);
    const final = a.status === "cancelado";
    return (
      <div className="admin-stack">
        <button className="btn ghost sm" style={{ justifySelf: "start" }} onClick={() => { setNotice(null); setMode({ name: "list" }); }}>← Volver a la lista</button>
        <NoticeBox notice={notice} onClose={() => setNotice(null)} />
        <div className="admin-card">
          <h3>{a.clientName} <span className={`tag st-${a.status}`}>{STATUS_LABEL[a.status] || a.status}</span></h3>
          <p>{dateLabel(a.date)} · <b>{a.time}</b>{a.endTime ? ` a ${a.endTime}` : ""}</p>
          <p className="muted">{a.serviceName} · {a.professionalName} · {money(a.priceAtBooking)}</p>
          <p className="muted">Tel: {a.clientPhone}</p>
          {a.notes && <p className="muted">“{a.notes}”</p>}
          <Status st={st} />
          <div className="btn-row">
            {!final && <button className="btn sm" onClick={() => setMode({ name: "edit", id: a.id })}>Modificar</button>}
            {a.status === "pendiente" && <button className="btn sm" disabled={st.busy} onClick={() => changeStatus(a, "confirmado")}>Confirmar</button>}
            {(a.status === "confirmado" || a.status === "pendiente") && <button className="btn ghost sm" disabled={st.busy} onClick={() => changeStatus(a, "completado")}>Completado</button>}
            {(a.status === "confirmado" || a.status === "pendiente") && <button className="btn ghost sm" disabled={st.busy} onClick={() => changeStatus(a, "ausente")}>Ausente</button>}
            {!final && <button className="btn ghost sm" disabled={st.busy} onClick={() => cancel(a)}>Cancelar turno</button>}
            {final && <button className="btn ghost sm" onClick={() => setMode({ name: "edit", id: a.id })}>Reabrir</button>}
            {link && <a className="btn ghost sm" href={link} target="_blank" rel="noreferrer">WhatsApp</a>}
          </div>
          {(a.status === "completado" || a.status === "ausente") && (
            <div className="btn-row">
              {["confirmado", "completado", "ausente"].filter((s) => s !== a.status).map((s) => (
                <button key={s} className="btn ghost sm" disabled={st.busy} onClick={() => changeStatus(a, s)}>Pasar a {STATUS_LABEL[s].toLowerCase()}</button>
              ))}
            </div>
          )}
        </div>
        <div className="admin-card">
          <h3>Historial</h3>
          {hist.length === 0 && <p className="muted small">Sin movimientos registrados (turno reservado por el cliente).</p>}
          {hist.map((h, i) => (
            <div className="hist" key={i}>
              <b>{h.action}</b> <span className="muted small">{fmtAt(h.at)} · {h.by}</span>
              {h.detail && <p className="muted small">{h.detail}</p>}
            </div>
          ))}
          <p className="muted small">Reservado: {fmtAt(a.createdAt) || "—"}</p>
        </div>
      </div>
    );
  }

  // ---------- lista ----------
  const [from, to] = range(view, anchor);
  const list = all
    .filter((a) => a.date >= from && a.date <= to)
    .filter((a) => (!fPro || a.professionalId === fPro) && (!fSrv || a.serviceId === fSrv) && (!fSt || a.status === fSt))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const byDate = {};
  for (const a of list) (byDate[a.date] = byDate[a.date] || []).push(a);
  const title = view === "todos" ? "Todos los turnos" : view === "dia" ? dateLabel(anchor)
    : view === "mes" ? new Date(`${anchor.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })
    : `${dateLabel(from)} – ${dateLabel(to)}`;

  return (
    <div className="admin-stack">
      <div className="toolbar">
        <h3>Turnos ({list.length})</h3>
        <button className="btn sm" onClick={() => { setNotice(null); setMode({ name: "new" }); }}>+ Nuevo turno</button>
      </div>
      <NoticeBox notice={notice} onClose={() => setNotice(null)} />
      <div className="seg">
        {VIEWS.map(([k, l]) => <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}</button>)}
      </div>
      {view !== "todos" && (
        <div className="toolbar">
          <button className="btn ghost sm" onClick={() => setAnchor(shift(view, anchor, -1))}>←</button>
          <button className="btn ghost sm" onClick={() => setAnchor(todayAR())}>Hoy</button>
          <button className="btn ghost sm" onClick={() => setAnchor(shift(view, anchor, 1))}>→</button>
        </div>
      )}
      <p className="kicker" style={{ margin: 0, textTransform: "capitalize" }}>{title}</p>
      <div className="filters">
        <select value={fPro} onChange={(e) => setFPro(e.target.value)}>
          <option value="">Todos los profesionales</option>
          {pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={fSrv} onChange={(e) => setFSrv(e.target.value)}>
          <option value="">Todos los servicios</option>
          {srvs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={fSt} onChange={(e) => setFSt(e.target.value)}>
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      {list.length === 0 && <p className="muted">No hay turnos con estos filtros.</p>}
      {Object.entries(byDate).map(([d, items]) => (
        <div key={d} className="admin-stack">
          <p className="kicker" style={{ margin: "8px 0 0" }}>{dateLabel(d)}{d === todayAR() ? " · hoy" : ""}</p>
          {items.map((a) => (
            <button type="button" className={`admin-row row-btn${isActive(a.status) ? "" : " dim"}`} key={a.id} onClick={() => { setNotice(null); setMode({ name: "detail", id: a.id }); }}>
              <div>
                <b>{a.time}</b> · {a.clientName} <span className={`tag st-${a.status}`}>{STATUS_LABEL[a.status] || a.status}</span>
                <p className="muted small">{a.serviceName} · {a.professionalName} · {money(a.priceAtBooking)}</p>
              </div>
              <span className="muted">›</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function NoticeBox({ notice, onClose }) {
  if (!notice) return null;
  if (notice.sending) return <div className="notice"><p>Enviando aviso por WhatsApp…</p></div>;
  if (notice.auto) {
    return (
      <div className="notice">
        <p>✅ Le avisamos a <b>{notice.name}</b> por WhatsApp.</p>
        <div className="btn-row"><button className="btn ghost sm" onClick={onClose}>Cerrar</button></div>
      </div>
    );
  }
  const txt = { creado: "registrado", confirmado: "confirmado", modificado: "modificado", cancelado: "cancelado" }[notice.kind];
  return (
    <div className="notice">
      <p>Turno {txt}. ¿Avisarle a <b>{notice.name}</b> por WhatsApp?</p>
      {notice.failed && <p className="form-error">El envío automático falló ({notice.failed}). Usá el botón manual.</p>}
      <div className="btn-row">
        <a className="btn sm" href={notice.link} target="_blank" rel="noreferrer" onClick={onClose}>Abrir WhatsApp</a>
        <button className="btn ghost sm" onClick={onClose}>No avisar</button>
      </div>
    </div>
  );
}
