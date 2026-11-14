import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../config/firebase";
import { BUSINESS_ID } from "../../config/paths";
import ServicesAdmin from "./ServicesAdmin";
import ProfessionalsAdmin from "./ProfessionalsAdmin";
import AgendaAdmin from "./AgendaAdmin";
import ServiceAgendaAdmin from "./ServiceAgendaAdmin";
import BusinessAdmin from "./BusinessAdmin";
import PaymentAdmin from "./PaymentAdmin";
import AccountAdmin from "./AccountAdmin";
import { useAppointments, useProfessionals, useAvailability, useBlocked, toList } from "../../lib/data";
import { todayAR } from "../../lib/db";
import { dateLabel, blocksFor, capacityMinutes } from "../../lib/availability";
import { isActive } from "../../lib/appointmentPlan";
import { depositState, hoursSinceBooked, hoursUntilExpire, DEPOSIT_HOURS, EXPIRE_HOURS } from "../../lib/deposit";
import { triggerSweep } from "../../lib/sweep";
import { useNow } from "../../lib/useNow";
import { money } from "../../lib/hours";
import AppointmentsAdmin from "./AppointmentsAdmin";
import TomorrowAdmin from "./TomorrowAdmin";
import PushToggle from "./PushToggle";

const TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "turnos", label: "Turnos" },
  { id: "manana", label: "Mañana" },
  { id: "servicios", label: "Servicios" },
  { id: "equipo", label: "Profesionales" },
  { id: "agenda", label: "Agenda" },
  { id: "agendaServ", label: "Agenda servicios" },
  { id: "sena", label: "Seña" },
  { id: "negocio", label: "Negocio" },
  { id: "acceso", label: "Acceso" },
];

function Summary({ onOpen }) {
  const ap = useAppointments();
  const pr = useProfessionals();
  const av = useAvailability();
  const bl = useBlocked();
  const now = useNow();
  if (ap.loading || pr.loading || av.loading || bl.loading) return <p className="muted">Cargando…</p>;
  if (ap.error) return <p className="form-error">❌ Sin permisos de lectura: {ap.error}</p>;

  const today = todayAR();
  const all = toList(ap.data);
  const pros = toList(pr.data).filter((p) => !p.deleted && p.active !== false);
  const blocks = toList(bl.data);
  const todays = all.filter((a) => a.date === today);
  const live = todays.filter((a) => isActive(a.status));
  const count = (st) => all.filter((a) => a.status === st && a.date >= today).length;
  const upcoming = all
    .filter((a) => a.date >= today && (a.status === "pendiente" || a.status === "confirmado"))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const noDeposit = all
    .filter((a) => depositState(a, now) === "overdue")
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const waiting = all.filter((a) => depositState(a, now) === "pending").length;

  const cap = pros.reduce((t, p) => t + capacityMinutes(av.data?.[p.id]?.weekly, today, blocksFor(blocks, p.id)), 0);
  const used = live.filter((a) => a.status !== "ausente").reduce((t, a) => t + Number(a.duration || 0), 0);
  const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;

  return (
    <div className="admin-stack">
      {noDeposit.length > 0 && (
        <div className="alert-card">
          <h3>⚠ Todavía no señaron ({noDeposit.length})</h3>
          <p className="muted small">Pasaron más de {DEPOSIT_HOURS} hs desde la reserva y no tildaste la seña. A las {EXPIRE_HOURS} hs el turno se cancela solo; también podés cancelarlo vos desde acá.</p>
          {noDeposit.map((a) => (
            <button type="button" className="admin-row row-btn" key={a.id} onClick={() => onOpen(a.id)}>
              <div>
                <b>{a.clientName}</b> <span className="muted small">· {a.serviceName}</span>
                <p className="muted small">{dateLabel(a.date)} {a.time} · seña {money(a.depositAmount)} · reservó hace {hoursSinceBooked(a, now)} hs · se cancela solo en {hoursUntilExpire(a, now)} hs</p>
              </div>
              <span className="muted">›</span>
            </button>
          ))}
        </div>
      )}
      <div className="admin-card">
        <h3>Hoy · {dateLabel(today)}</h3>
        <div className="kpis">
          <div className="kpi"><b>{live.length}</b><span>Turnos de hoy</span></div>
          <div className="kpi"><b>{count("pendiente")}</b><span>Pendientes</span></div>
          <div className="kpi"><b>{count("confirmado")}</b><span>Confirmados</span></div>
          <div className="kpi"><b>{todays.filter((a) => a.status === "cancelado").length}</b><span>Cancelados hoy</span></div>
          {(waiting > 0 || noDeposit.length > 0) && <div className="kpi"><b>{waiting}</b><span>Esperando seña (en plazo)</span></div>}
        </div>
        <p className="muted small">Ocupación de hoy: <b>{pct}%</b> ({used} de {cap} min)</p>
        <div className="bar"><div style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="admin-card">
        <h3>Próximos turnos</h3>
        {upcoming.length === 0 && <p className="muted">No hay turnos próximos.</p>}
        {pros.map((p) => {
          const mine = upcoming.filter((a) => a.professionalId === p.id).slice(0, 3);
          if (!mine.length) return null;
          return (
            <div key={p.id}>
              <p className="kicker" style={{ margin: "8px 0 4px" }}>{p.name}</p>
              {mine.map((a) => (
                <p className="small" key={a.id}>
                  <b>{a.date === today ? "Hoy" : dateLabel(a.date)}</b> {a.time} · {a.clientName} <span className="muted">({a.serviceName})</span>
                </p>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [tab, setTab] = useState("resumen");
  const [openId, setOpenId] = useState(null); // turno a abrir al saltar desde el Resumen
  const ap = useAppointments();
  const now = useNow();
  const overdue = toList(ap.data).filter((a) => depositState(a, now) === "overdue").length;
  const goTab = (id) => { setOpenId(null); setTab(id); };

  // Cancela los turnos que vencieron sin seña (lo decide el servidor)
  useEffect(() => { triggerSweep(); }, []);

  return (
    <div className="admin">
      <header className="admin-bar">
        <div>
          <b>Administración</b>
          <span className="muted small"> · {BUSINESS_ID}</span>
        </div>
        <div className="admin-actions">
          <a className="btn ghost sm" href="/manual.pdf" target="_blank" rel="noreferrer">Manual</a>
          <Link className="btn ghost sm" to="/">Ver página</Link>
          <button className="btn ghost sm" onClick={() => signOut(auth)}>Salir</button>
        </div>
      </header>

      <nav className="admin-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => goTab(t.id)}>
            {t.label}
            {t.id === "turnos" && overdue > 0 && <span className="tab-badge" aria-label={`${overdue} turnos que todavía no señaron`}>{overdue}</span>}
          </button>
        ))}
      </nav>

      <main className="wrap" style={{ paddingTop: 24, paddingBottom: 60 }}>
        <PushToggle />
        {tab === "resumen" && <Summary onOpen={(id) => { setOpenId(id); setTab("turnos"); }} />}
        {tab === "servicios" && <ServicesAdmin />}
        {tab === "equipo" && <ProfessionalsAdmin />}
        {tab === "agenda" && <AgendaAdmin />}
        {tab === "agendaServ" && <ServiceAgendaAdmin />}
        {tab === "sena" && <PaymentAdmin />}
        {tab === "negocio" && <BusinessAdmin />}
        {tab === "acceso" && <AccountAdmin />}
        {tab === "turnos" && <AppointmentsAdmin key={openId || "list"} initialId={openId} />}
        {tab === "manana" && <TomorrowAdmin />}
      </main>
    </div>
  );
}
