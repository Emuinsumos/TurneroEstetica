import { useState } from "react";
import { useAppointments, useConfig, toList } from "../../lib/data";
import { todayAR } from "../../lib/db";
import { dateLabel, addDays } from "../../lib/availability";
import { clientWaNumber, waLink, reminderMessage } from "../../lib/whatsapp";
import { BUSINESS_ID } from "../../config/paths";

// "Recordados" se guarda en este dispositivo (no se comparte entre celulares).
const KEY = `recordados:${BUSINESS_ID}`;
const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
};
const save = (o) => {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* sin almacenamiento */ }
};

export default function TomorrowAdmin() {
  const ap = useAppointments();
  const cfg = useConfig();
  const [done, setDone] = useState(load);

  if (ap.loading || cfg.loading) return <p className="muted">Cargando…</p>;
  if (ap.error) return <p className="form-error">❌ Sin permisos de lectura: {ap.error}</p>;

  const c = cfg.data || {};
  const tomorrow = addDays(todayAR(), 1);
  const list = toList(ap.data)
    .filter((a) => a.date === tomorrow && (a.status === "pendiente" || a.status === "confirmado"))
    .sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const mapsUrl = c.mapsUrl || "";

  const remind = (a) => {
    const link = waLink(
      clientWaNumber(a.clientPhone),
      reminderMessage(a, dateLabel(a.date), { businessName: c.name, address: c.address, mapsUrl }),
    );
    if (!link) { window.alert("Este turno no tiene un teléfono válido."); return; }
    const next = { ...load(), [a.id]: Date.now() };
    save(next);
    setDone(next);
    window.open(link, "_blank", "noopener");
  };

  return (
    <div className="admin-stack">
      <div className="admin-card">
        <h3>Turnos de mañana · {dateLabel(tomorrow)}</h3>
        <p className="muted small">
          {list.length === 0
            ? "No hay turnos para mañana."
            : `${list.length} turno${list.length === 1 ? "" : "s"}. Tocá RECORDAR TURNO y se abre WhatsApp con el mensaje listo: solo falta tocar enviar.`}
        </p>
      </div>
      {list.map((a) => (
        <div key={a.id} className="admin-card">
          <h3>{a.time} · {a.clientName}</h3>
          <p className="muted">{a.serviceName} · {a.professionalName}</p>
          <p className="muted small">Tel: {a.clientPhone}{a.status === "pendiente" ? " · Pendiente de confirmar" : ""}</p>
          <div className="btn-row">
            <button className="btn sm" onClick={() => remind(a)}>RECORDAR TURNO</button>
            {done[a.id] && <span className="tag st-confirmado">✓ Recordado</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
