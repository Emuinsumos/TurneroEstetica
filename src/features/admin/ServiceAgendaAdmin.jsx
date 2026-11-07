import { useEffect, useState } from "react";
import { useServices, useServiceAgenda, toList } from "../../lib/data";
import { dbSet, dbRemove, todayAR } from "../../lib/db";
import { weekday, pad, toMin, toHHMM, dateLabel } from "../../lib/availability";
import { P } from "../../config/paths";
import { Field, Status, useSave } from "./ui";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const WD = ["L", "M", "M", "J", "V", "S", "D"];
const toKey = (t) => t.replace(":", "");
const fromKey = (k) => `${k.slice(0, 2)}:${k.slice(2)}`;

// Agenda de servicios: para los servicios con "Habilitar agenda" se cargan los días y horarios puntuales.
// Datos: serviceAgenda/{idServicio}/{AAAA-MM-DD}/{HHMM}: true
export default function ServiceAgendaAdmin() {
  const sv = useServices();
  const ag = useServiceAgenda();
  const today = todayAR();
  const [serviceId, setServiceId] = useState("");
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }));
  const [sel, setSel] = useState([]);
  const [times, setTimes] = useState([]);
  const [newTime, setNewTime] = useState("");
  const [gen, setGen] = useState({ from: "09:00", to: "13:00", every: "60" });
  const [err, setErr] = useState("");
  const [st, run] = useSave();

  const services = toList(sv.data)
    .filter((s) => !s.deleted && s.agenda === true)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const firstId = services[0]?.id || "";

  useEffect(() => {
    if (firstId && !services.some((s) => s.id === serviceId)) setServiceId(firstId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, firstId]);

  if (sv.loading || ag.loading) return <p className="muted">Cargando…</p>;
  if (ag.error) return <p className="form-error">❌ No se pudo leer la agenda: {ag.error}. Revisá que las reglas de Firebase incluyan serviceAgenda.</p>;
  if (services.length === 0)
    return <p className="muted">Ningún servicio tiene la agenda habilitada. Activala en Servicios → Editar → "Habilitar agenda".</p>;

  const dayData = (date) => ag.data?.[serviceId]?.[date] || null;
  const timesOf = (date) => Object.keys(dayData(date) || {}).map(fromKey).sort();

  const first = `${ym.y}-${pad(ym.m)}-01`;
  const offset = (weekday(first) + 6) % 7; // semana desde el lunes
  const dim = new Date(Date.UTC(ym.y, ym.m, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(`${ym.y}-${pad(ym.m)}-${pad(d)}`);

  const moveMonth = (n) =>
    setYm(({ y, m }) => {
      const t = y * 12 + (m - 1) + n;
      return { y: Math.floor(t / 12), m: (t % 12) + 1 };
    });

  function toggleDay(date) {
    const next = sel.includes(date) ? sel.filter((d) => d !== date) : [...sel, date].sort();
    setSel(next);
    setErr("");
    if (next.length === 1) setTimes(timesOf(next[0]));
    else if (next.length === 0) setTimes([]);
  }

  function pickService(id) {
    setServiceId(id);
    setSel([]);
    setTimes([]);
    setErr("");
  }

  function addTime() {
    if (!newTime) return;
    setTimes(Array.from(new Set([...times, newTime])).sort());
    setNewTime("");
  }

  function generate() {
    setErr("");
    if (!gen.from || !gen.to || toMin(gen.from) > toMin(gen.to)) return setErr("Revisá el desde y el hasta");
    const every = Number(gen.every);
    if (!(every >= 5)) return setErr("El intervalo mínimo es 5 minutos");
    const add = [];
    for (let s = toMin(gen.from); s <= toMin(gen.to); s += every) add.push(toHHMM(s));
    setTimes(Array.from(new Set([...times, ...add])).sort());
  }

  async function saveSel() {
    await run(async () => {
      if (!sel.length) throw new Error("Elegí al menos un día en el calendario");
      if (!times.length) throw new Error("Cargá al menos un horario (o usá Vaciar días)");
      const obj = {};
      for (const t of times) obj[toKey(t)] = true;
      for (const d of sel) await dbSet(`${P.serviceAgenda}/${serviceId}/${d}`, obj);
    }, `Guardado en ${sel.length} día(s) ✓`);
  }

  async function clearSel() {
    if (!sel.length) return;
    if (!window.confirm(`¿Vaciar los horarios de ${sel.length} día(s)? Los turnos ya reservados no se borran.`)) return;
    await run(async () => {
      for (const d of sel) await dbRemove(`${P.serviceAgenda}/${serviceId}/${d}`);
      setTimes([]);
    }, "Días vaciados ✓");
  }

  const upcoming = Object.keys(ag.data?.[serviceId] || {})
    .filter((d) => d >= today)
    .sort();

  return (
    <div className="admin-stack">
      <div className="admin-card">
        <h3>Agenda de servicios</h3>
        <p className="muted small">
          Estos servicios solo se pueden reservar en los días y horarios que cargues acá. Tocá uno o varios días del
          calendario, definí los horarios y guardá. Los bloqueos y los turnos ya tomados se siguen respetando.
        </p>
        <Field label="Servicio">
          <select value={serviceId} onChange={(e) => pickService(e.target.value)}>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>

        <div className="toolbar">
          <button className="btn ghost sm" type="button" onClick={() => moveMonth(-1)}>‹</button>
          <b>{MONTHS[ym.m - 1]} {ym.y}</b>
          <button className="btn ghost sm" type="button" onClick={() => moveMonth(1)}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginTop: 8 }}>
          {WD.map((w, i) => <small key={i} className="muted" style={{ textAlign: "center" }}>{w}</small>)}
          {cells.map((d, i) =>
            d ? (
              <button
                key={d}
                type="button"
                className={sel.includes(d) ? "btn sm" : "btn ghost sm"}
                style={{ padding: "8px 0", width: "100%" }}
                disabled={d < today}
                onClick={() => toggleDay(d)}
              >
                {Number(d.slice(8))}{dayData(d) ? " •" : ""}
              </button>
            ) : (
              <span key={`e${i}`} />
            )
          )}
        </div>
        <p className="muted small">• = día con horarios cargados</p>
      </div>

      <div className="admin-card">
        <h3>{sel.length === 0 ? "Horarios" : sel.length === 1 ? dateLabel(sel[0]) : `${sel.length} días elegidos`}</h3>
        {sel.length === 0 && <p className="muted small">Elegí uno o más días en el calendario.</p>}
        {sel.length > 1 && <p className="muted small">Los horarios que dejes acá se guardan iguales en todos los días elegidos.</p>}

        {sel.length > 0 && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
              {times.length === 0 && <span className="muted small">Todavía no hay horarios.</span>}
              {times.map((t) => (
                <button key={t} type="button" className="btn ghost sm" onClick={() => setTimes(times.filter((x) => x !== t))}>
                  {t} ✕
                </button>
              ))}
            </div>

            <div className="grid2">
              <Field label="Agregar un horario"><input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} /></Field>
              <div className="field"><span>&nbsp;</span><button className="btn sm" type="button" onClick={addTime}>Agregar</button></div>
            </div>

            <p className="muted small" style={{ marginTop: 12 }}>O generá varios de una vez:</p>
            <div className="grid2">
              <Field label="Desde"><input type="time" value={gen.from} onChange={(e) => setGen({ ...gen, from: e.target.value })} /></Field>
              <Field label="Hasta"><input type="time" value={gen.to} onChange={(e) => setGen({ ...gen, to: e.target.value })} /></Field>
              <Field label="Cada (min)"><input type="number" min="5" step="5" inputMode="numeric" value={gen.every} onChange={(e) => setGen({ ...gen, every: e.target.value })} /></Field>
              <div className="field"><span>&nbsp;</span><button className="btn ghost sm" type="button" onClick={generate}>Generar</button></div>
            </div>

            {err && <p className="form-error">{err}</p>}
            <Status st={st} />
            <div className="btn-row">
              <button className="btn" type="button" onClick={saveSel} disabled={st.busy}>
                {st.busy ? "Guardando…" : `Guardar en ${sel.length} día(s)`}
              </button>
              <button className="btn ghost" type="button" onClick={clearSel} disabled={st.busy}>Vaciar días</button>
            </div>
          </>
        )}
      </div>

      <div className="admin-card">
        <h3>Días cargados</h3>
        {upcoming.length === 0 && <p className="muted small">No hay días cargados para este servicio.</p>}
        {upcoming.map((d) => (
          <div className="admin-row" key={d}>
            <div>
              <b>{dateLabel(d)}</b>
              <p className="muted small">{timesOf(d).join(" · ") || "sin horarios"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
