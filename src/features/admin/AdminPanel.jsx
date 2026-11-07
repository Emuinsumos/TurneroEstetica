import { useState } from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../config/firebase";
import { BUSINESS_ID } from "../../config/paths";
import ServicesAdmin from "./ServicesAdmin";
import ProfessionalsAdmin from "./ProfessionalsAdmin";
import AgendaAdmin from "./AgendaAdmin";
import ServiceAgendaAdmin from "./ServiceAgendaAdmin";
import BusinessAdmin from "./BusinessAdmin";
import AccountAdmin from "./AccountAdmin";
import { useAppointments, useProfessionals, useAvailability, useBlocked, toList } from "../../lib/data";
import { todayAR } from "../../lib/db";
import { dateLabel, blocksFor, capacityMinutes } from "../../lib/availability";
import { isActive } from "../../lib/appointmentPlan";
import AppointmentsAdmin from "./AppointmentsAdmin";

const TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "turnos", label: "Turnos" },
  { id: "servicios", label: "Servicios" },
  { id: "equipo", label: "Profesionales" },
  { id: "agenda", label: "Agenda" },
  { id: "agendaServ", label: "Agenda servicios" },
  { id: "negocio", label: "Negocio" },
  { id: "acceso", label: "Acceso" },
];

function Summary() {
  const ap = useAppointments();
  const pr = useProfessionals();
  const av = useAvailability();
  const bl = useBlocked();
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

  const cap = pros.reduce((t, p) => t + capacityMinutes(av.data?.[p.id]?.weekly, today, blocksFor(blocks, p.id)), 0);
  const used = live.filter((a) => a.status !== "ausente").reduce((t, a) => t + Number(a.duration || 0), 0);
  const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;

  return (
    <div className="admin-stack">
      <div className="admin-card">
        <h3>Hoy · {dateLabel(today)}</h3>
        <div className="kpis">
          <div className="kpi"><b>{live.length}</b><span>Turnos de hoy</span></div>
          <div className="kpi"><b>{count("pendiente")}</b><span>Pendientes</span></div>
          <div className="kpi"><b>{count("confirmado")}</b><span>Confirmados</span></div>
          <div className="kpi"><b>{todays.filter((a) => a.status === "cancelado").length}</b><span>Cancelados hoy</span></div>
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
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="wrap" style={{ paddingTop: 24, paddingBottom: 60 }}>
        {tab === "resumen" && <Summary />}
        {tab === "servicios" && <ServicesAdmin />}
        {tab === "equipo" && <ProfessionalsAdmin />}
        {tab === "agenda" && <AgendaAdmin />}
        {tab === "agendaServ" && <ServiceAgendaAdmin />}
        {tab === "negocio" && <BusinessAdmin />}
        {tab === "acceso" && <AccountAdmin />}
        {tab === "turnos" && <AppointmentsAdmin />}
      </main>
    </div>
  );
}
