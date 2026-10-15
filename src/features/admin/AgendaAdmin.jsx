import { useEffect, useState } from "react";
import { useProfessionals, useAvailability, useBlocked, toList } from "../../lib/data";
import { dbSet, dbRemove, newKey, todayAR } from "../../lib/db";
import { DAYS, defaultWeekly } from "../../lib/schedule";
import { P } from "../../config/paths";
import { Field, Check, Status, useSave } from "./ui";

export default function AgendaAdmin() {
  const pr = useProfessionals();
  const av = useAvailability();
  const bl = useBlocked();
  const [profId, setProfId] = useState("");
  const [weekly, setWeekly] = useState(null);
  const [stW, runW] = useSave();
  const [stB, runB] = useSave();
  const [block, setBlock] = useState({ date: "", prof: "all", from: "", to: "", reason: "" });

  const pros = toList(pr.data).filter((p) => !p.deleted).sort((a, b) => (a.order || 0) - (b.order || 0));
  const firstId = pros[0]?.id || "";

  useEffect(() => {
    if (!profId && firstId) setProfId(firstId);
  }, [profId, firstId]);

  useEffect(() => {
    if (!profId || av.loading) return;
    const saved = av.data?.[profId]?.weekly;
    const base = defaultWeekly();
    const merged = {};
    for (const d of DAYS) {
      merged[d.k] = saved && saved[d.k] ? { open: false, ...saved[d.k] } : base[d.k];
    }
    setWeekly(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profId, av.loading]);

  if (pr.loading || av.loading || bl.loading) return <p className="muted">Cargando…</p>;
  if (pros.length === 0) return <p className="muted">Primero cargá al menos un profesional.</p>;

  const setDay = (k, patch) => setWeekly((w) => ({ ...w, [k]: { ...w[k], ...patch } }));

  async function saveWeekly() {
    await runW(async () => {
      const out = {};
      for (const d of DAYS) {
        const x = weekly[d.k];
        if (!x.open) { out[d.k] = { open: false }; continue; }
        if (!x.from || !x.to || x.from >= x.to)
          throw new Error(`${d.n}: el horario de cierre tiene que ser después del de apertura`);
        const day = { open: true, from: x.from, to: x.to };
        if (x.breakFrom || x.breakTo) {
          if (!x.breakFrom || !x.breakTo || x.breakFrom >= x.breakTo)
            throw new Error(`${d.n}: revisá el descanso`);
          if (x.breakFrom < x.from || x.breakTo > x.to)
            throw new Error(`${d.n}: el descanso tiene que estar dentro del horario`);
          day.breakFrom = x.breakFrom;
          day.breakTo = x.breakTo;
        }
        out[d.k] = day;
      }
      await dbSet(`${P.availability(profId)}/weekly`, out);
    });
  }

  async function addBlock(e) {
    e.preventDefault();
    const ok = await runB(async () => {
      if (!block.date) throw new Error("Elegí una fecha");
      if ((block.from && !block.to) || (!block.from && block.to))
        throw new Error("Para bloquear una franja completá desde y hasta (o dejá ambos vacíos para todo el día)");
      if (block.from && block.from >= block.to) throw new Error("La franja no es válida");
      const data = { date: block.date, professionalId: block.prof, reason: block.reason.trim() || "Bloqueado" };
      if (block.from) { data.from = block.from; data.to = block.to; }
      await dbSet(`${P.blockedSlots}/${newKey(P.blockedSlots)}`, data);
    }, "Bloqueo agregado ✓");
    if (ok) setBlock({ date: "", prof: "all", from: "", to: "", reason: "" });
  }

  const today = todayAR();
  const blocks = toList(bl.data).filter((b) => b.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const nameOf = (id) => (id === "all" ? "Todos" : pros.find((p) => p.id === id)?.name || "—");

  return (
    <div className="admin-stack">
      <div className="admin-card">
        <h3>Horarios semanales</h3>
        <Field label="Profesional">
          <select value={profId} onChange={(e) => setProfId(e.target.value)}>
            {pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>

        {weekly && DAYS.map((d) => {
          const x = weekly[d.k];
          return (
            <div className="day" key={d.k}>
              <Check checked={x.open} onChange={(v) => setDay(d.k, { open: v })}><b>{d.n}</b></Check>
              {x.open && (
                <div className="day-times">
                  <label>Desde<input type="time" value={x.from || ""} onChange={(e) => setDay(d.k, { from: e.target.value })} /></label>
                  <label>Hasta<input type="time" value={x.to || ""} onChange={(e) => setDay(d.k, { to: e.target.value })} /></label>
                  <label>Descanso desde<input type="time" value={x.breakFrom || ""} onChange={(e) => setDay(d.k, { breakFrom: e.target.value })} /></label>
                  <label>Descanso hasta<input type="time" value={x.breakTo || ""} onChange={(e) => setDay(d.k, { breakTo: e.target.value })} /></label>
                </div>
              )}
            </div>
          );
        })}
        <Status st={stW} />
        <button className="btn" onClick={saveWeekly} disabled={stW.busy}>{stW.busy ? "Guardando…" : "Guardar horarios"}</button>
      </div>

      <form className="admin-card" onSubmit={addBlock}>
        <h3>Bloqueos y vacaciones</h3>
        <p className="muted small">Cerrá un día entero o una franja. Para vacaciones, agregá cada día.</p>
        <div className="grid2">
          <Field label="Fecha"><input type="date" min={today} value={block.date} onChange={(e) => setBlock({ ...block, date: e.target.value })} required /></Field>
          <Field label="Quién">
            <select value={block.prof} onChange={(e) => setBlock({ ...block, prof: e.target.value })}>
              <option value="all">Todos</option>
              {pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Desde (opcional)"><input type="time" value={block.from} onChange={(e) => setBlock({ ...block, from: e.target.value })} /></Field>
          <Field label="Hasta (opcional)"><input type="time" value={block.to} onChange={(e) => setBlock({ ...block, to: e.target.value })} /></Field>
        </div>
        <Field label="Motivo"><input value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} placeholder="Feriado, vacaciones…" /></Field>
        <Status st={stB} />
        <button className="btn" type="submit" disabled={stB.busy}>Agregar bloqueo</button>

        {blocks.length > 0 && <h3 style={{ marginTop: 18 }}>Próximos bloqueos</h3>}
        {blocks.map((b) => (
          <div className="admin-row" key={b.id}>
            <div>
              <b>{b.date}</b> {b.from ? `${b.from}–${b.to}` : "todo el día"}
              <p className="muted small">{nameOf(b.professionalId)} · {b.reason}</p>
            </div>
            <button className="btn ghost sm" type="button" onClick={() => runB(() => dbRemove(`${P.blockedSlots}/${b.id}`), "Bloqueo eliminado")}>Quitar</button>
          </div>
        ))}
      </form>
    </div>
  );
}
