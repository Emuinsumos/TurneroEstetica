import { useEffect, useState } from "react";
import { notifyAuto } from "../../lib/notify";
import { Link } from "react-router-dom";
import { ref, update, serverTimestamp } from "firebase/database";
import { db } from "../../config/firebase";
import { P } from "../../config/paths";
import { newKey } from "../../lib/db";
import {
  useConfig, useServices, useProfessionals, useAvailability, useBlocked, useLocks, useServiceAgenda, usePayment, toList,
} from "../../lib/data";
import { triggerSweep } from "../../lib/sweep";
import {
  getSlots, blocksFor, agendaTimesFor, nowInTz, dayDiff, addDays, dateLabel, toMin, toHHMM, lockCells,
} from "../../lib/availability";
import { money, initials, groupByCategory } from "../../lib/hours";
import { waLink, bookingMessage } from "../../lib/whatsapp";
import { validateClientData } from "../../lib/validation";
import { depositAmountFor, paymentConfig, DEPOSIT_HOURS, EXPIRE_HOURS } from "../../lib/deposit";
import Calendar from "./Calendar";
import DepositBox from "./DepositBox";
import Carousel from "./Carousel";
import Img from "../../components/Img";

const num = (v, min, def) => (Number(v) >= min ? Number(v) : def);
const galleryOf = (p) =>
  Array.isArray(p?.gallery) ? p.gallery : Object.values(p?.gallery || {});

export default function Booking() {
  const cfg = useConfig();
  const sv = useServices();
  const pr = useProfessionals();
  const av = useAvailability();
  const bl = useBlocked();
  const ag = useServiceAgenda();
  const pay = usePayment();

  const [stepName, setStepName] = useState("service");
  const [selIds, setSelIds] = useState([]);
  const [profChoice, setProfChoice] = useState(null);
  const [date, setDate] = useState(null);
  const [slot, setSlot] = useState(null); // { time, profId }
  const [client, setClient] = useState({ name: "", phone: "", notes: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [bookError, setBookError] = useState("");
  const [done, setDone] = useState(null);

  // ---- configuración (con valores por defecto) ----
  const c = cfg.data || {};
  const tz = c.timezone || "America/Argentina/Buenos_Aires";
  const stepMin = num(c.slotMinutes, 5, 15);
  const buffer = num(c.bufferMinutes, 0, 0);
  const notice = num(c.minNoticeHours, 0, 2);
  const maxDays = num(c.maxDaysAhead, 1, 30);
  const choose = c.clientChoosesProfessional !== false;
  const multi = !!c.allowMultiService;

  // ---- datos ----
  const services = toList(sv.data).filter((s) => s.active !== false && !s.deleted)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const pros = toList(pr.data).filter((p) => p.active !== false && !p.deleted)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const blocks = toList(bl.data);

  const chosen = services.filter((s) => selIds.includes(s.id));
  const duration = chosen.reduce((a, s) => a + Number(s.duration || 0), 0);
  const price = chosen.reduce((a, s) => a + Number(s.price || 0), 0);

  // Seña: monto fijo cargado por el negocio (nodo `payment`, solo lo escribe el servidor)
  const dep = paymentConfig(pay.data || {});
  const deposit = dep.on ? depositAmountFor(price, dep.amount) : 0;

  const eligible = chosen.length
    ? pros.filter((p) =>
        chosen.every((s) => {
          const ids = Object.keys(s.professionalIds || {});
          return ids.length === 0 || ids.includes(p.id);
        })
      )
    : [];

  const showProStep = choose && eligible.length > 1;
  const effProf = !choose ? "any" : eligible.length === 1 ? eligible[0].id : profChoice;
  const activePros = !effProf ? [] : effProf === "any" ? eligible : eligible.filter((p) => p.id === effProf);

  const stepsList = ["service", ...(showProStep ? ["pro"] : []), "date", "time", "data", "confirm"];
  const cur = stepsList.includes(stepName) ? stepName : "service";
  const curIdx = stepsList.indexOf(cur);
  const go = (delta) => setStepName(stepsList[Math.min(Math.max(curIdx + delta, 0), stepsList.length - 1)]);

  const locksState = useLocks(activePros.map((p) => p.id), date);

  // Libera los horarios de turnos que vencieron sin seña (lo decide el servidor)
  useEffect(() => { triggerSweep(); }, []);

  // El título de la pestaña y el color de acento siguen la configuración
  useEffect(() => {
    if (c.accentColor) document.documentElement.style.setProperty("--accent", c.accentColor);
    if (c.name) document.title = `Reservar · ${c.name}`;
  }, [c.accentColor, c.name]);

  // ---- carga / errores ----
  const error = cfg.error || sv.error || pr.error || av.error || bl.error;
  if (error) return <Shell><p className="form-error">No se pudo cargar: {error}</p></Shell>;
  if (cfg.loading || sv.loading || pr.loading || av.loading || bl.loading || ag.loading || pay.loading)
    return <div className="splash"><div className="spinner" /></div>;
  if (!cfg.data) return <Shell><p>Negocio no configurado.</p></Shell>;

  // ---- cálculo de disponibilidad ----
  // Servicios con agenda: solo se ofrecen los horarios cargados para ese día.
  // Si hay varios servicios con agenda, valen los horarios que tienen en común.
  const agendaFor = (d) => {
    const lists = chosen.filter((s) => s.agenda === true).map((s) => agendaTimesFor(s, ag.data, d));
    if (lists.length === 0) return null;
    return lists.reduce((a, b) => a.filter((t) => b.includes(t)));
  };

  const ctx = (p, d) => ({
    weekly: av.data?.[p.id]?.weekly,
    agenda: agendaFor(d),
    blocks: blocksFor(blocks, p.id),
    duration, buffer, step: stepMin, tz, minNoticeHours: notice, maxDaysAhead: maxDays,
  });
  const today = nowInTz(tz).date;
  const maxDate = addDays(today, maxDays);

  const dayStatus = (d) => {
    const diff = dayDiff(today, d);
    if (diff < 0 || diff > maxDays) return "disabled";
    return activePros.some((p) => getSlots({ ...ctx(p, d), date: d, locks: null }).length > 0)
      ? "open" : "closed";
  };

  let slotList = [];
  if (date && !locksState.loading && !locksState.error) {
    const map = new Map();
    for (const p of activePros) {
      for (const t of getSlots({ ...ctx(p, date), date, locks: locksState.locks[p.id] || {} })) {
        if (!map.has(t)) map.set(t, p.id);
      }
    }
    slotList = [...map].sort(([a], [b]) => a.localeCompare(b)).map(([time, profId]) => ({ time, profId }));
  }

  const slotPro = slot ? pros.find((p) => p.id === slot.profId) : null;
  const serviceNames = chosen.map((s) => s.name).join(" + ");

  // ---- acciones ----
  function resetFrom(level) {
    if (level <= 1) setProfChoice(null);
    if (level <= 2) { setDate(null); }
    setSlot(null);
    setBookError("");
  }

  function toggleService(s) {
    resetFrom(1);
    if (multi) {
      setSelIds((ids) => (ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id]));
    } else {
      setSelIds([s.id]);
      // avanzar solo: el paso siguiente depende de cuántos profesionales puedan hacerlo
      const elig = pros.filter((p) => {
        const ids = Object.keys(s.professionalIds || {});
        return ids.length === 0 || ids.includes(p.id);
      });
      setStepName(choose && elig.length > 1 ? "pro" : "date");
    }
  }

  function validateClient() {
    const e = validateClientData({ name: client.name, phone: client.phone, notes: client.notes });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function confirm() {
    if (busy || !slot || !slotPro) return; // evita doble envío
    setBusy(true);
    setBookError("");
    try {
      const startMin = toMin(slot.time);
      const cells = lockCells(startMin, duration + buffer);
      const id = newKey(P.appointments);
      const record = {
        clientName: client.name.trim(),
        clientPhone: client.phone.trim(),
        serviceId: selIds.join(","),
        serviceName: serviceNames,
        professionalId: slotPro.id,
        professionalName: slotPro.name,
        date,
        time: slot.time,
        endTime: toHHMM(startMin + duration),
        duration,
        status: "pendiente",
        priceAtBooking: price,
        createdAt: serverTimestamp(),
        slots: cells,
      };
      if (client.notes.trim()) record.notes = client.notes.trim();
      if (deposit > 0) {
        record.depositAmount = deposit;
        record.depositStatus = "pendiente";
      }

      // Una sola escritura atómica: el turno + todas sus celdas de bloqueo.
      // Si alguien ya ocupó una celda, las reglas de Firebase rechazan TODO.
      const updates = { [`appointments/${id}`]: record };
      for (const k of cells) updates[`slotLocks/${slotPro.id}/${date}/${k}`] = id;
      await update(ref(db, P.base), updates);

      notifyAuto("nuevo", id); // WhatsApp automático (si está configurado); no bloquea la reserva
      setDone({ id, code: id.slice(-6).toUpperCase(), deposit });
    } catch (e) {
      const msg = String(e?.code || e?.message || "");
      if (/PERMISSION_DENIED/i.test(msg)) {
        setSlot(null);
        setStepName("time");
        setBookError("Ese horario se acaba de ocupar o ya no está disponible. Elegí otro, por favor.");
      } else if (/network|offline|unavailable/i.test(msg)) {
        setBookError("No hay conexión. Revisá tu internet y volvé a intentar. Tu turno NO fue reservado.");
      } else {
        setBookError("No se pudo guardar el turno. Probá de nuevo en unos segundos.");
      }
    } finally {
      setBusy(false);
    }
  }

  // ---- pantalla de éxito ----
  if (done) {
    const link = waLink(
      c.whatsapp,
      bookingMessage({
        businessName: c.name, name: client.name.trim(), service: serviceNames,
        pro: slotPro?.name, dateText: dateLabel(date), time: slot.time, price, code: done.code,
        deposit: done.deposit,
      })
    );
    return (
      <Shell name={c.name}>
        <div className="success">
          <div className="check-big">✓</div>
          <h2>¡Turno registrado!</h2>
          <p className="muted">Tu código es <b className="code">{done.code}</b>. Guardalo por si necesitás modificar o cancelar.</p>
          <Summary
            rows={[
              ["Servicio", serviceNames],
              ["Profesional", slotPro?.name],
              ["Fecha", dateLabel(date)],
              ["Hora", `${slot.time} hs`],
              ["Precio", money(price)],
              ...(done.deposit > 0 ? [["Seña a abonar", money(done.deposit)]] : []),
            ]}
          />
          {done.deposit > 0 && (
            <DepositBox amount={done.deposit} alias={dep.alias} holder={dep.holder} bank={dep.bank} />
          )}
          <p className="muted small">
            {done.deposit > 0
              ? <>Tu horario queda <b>reservado</b>. Se confirma cuando el negocio reciba la seña: mandá el comprobante por WhatsApp.</>
              : <>El turno queda <b>pendiente</b> hasta que el negocio lo confirme.</>}
          </p>
          <div className="btn-col">
            {link && <a className="btn" href={link} target="_blank" rel="noreferrer">{done.deposit > 0 ? "Enviar comprobante por WhatsApp" : "Enviar detalles por WhatsApp"}</a>}
            <Link className="btn ghost" to="/">Volver al inicio</Link>
          </div>
          {link && <p className="muted small">Se abre WhatsApp con el mensaje listo; tenés que tocar “enviar”.</p>}
        </div>
      </Shell>
    );
  }

  // ---- pasos ----
  const selectedPro = effProf && effProf !== "any" ? pros.find((p) => p.id === effProf) : null;

  return (
    <Shell name={c.name} step={curIdx + 1} total={stepsList.length} onBack={curIdx > 0 ? () => go(-1) : null}>
      {cur === "service" && (
        <>
          <h2>Elegí el servicio</h2>
          {services.length === 0 && <p className="muted">Por ahora no hay servicios disponibles.</p>}
          <div className="opt-list">
            {groupByCategory(services).map((g) => (
              <div key={g.category || "_"} className="opt-list">
                {g.category && <h3 className="cat-title">{g.category}</h3>}
                {g.items.map((s) => {
                  const on = selIds.includes(s.id);
                  return (
                    <button key={s.id} type="button" className={`opt ${on ? "on" : ""}`} onClick={() => toggleService(s)}>
                      <span className="opt-main">
                        <b>{s.name}</b>
                        {s.description && <span className="muted small">{s.description}</span>}
                        <span className="muted small">{s.duration} min</span>
                      </span>
                      <span className="price">{money(s.price)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {multi && (
            <div className="sticky-cta">
              <button className="btn lg" type="button" disabled={chosen.length === 0}
                onClick={() => setStepName(choose && eligible.length > 1 ? "pro" : "date")}>
                {chosen.length === 0 ? "Elegí al menos uno" : `Continuar · ${duration} min · ${money(price)}`}
              </button>
            </div>
          )}
          {multi && chosen.length > 0 && eligible.length === 0 && (
            <p className="form-error">Ningún profesional realiza todos esos servicios juntos. Probá con otra combinación.</p>
          )}
        </>
      )}

      {cur === "pro" && (
        <>
          <h2>Elegí con quién</h2>
          <div className="opt-list">
            {eligible.map((p) => (
              <button key={p.id} type="button" className={`opt pro ${profChoice === p.id ? "on" : ""}`}
                onClick={() => { setProfChoice(p.id); setDate(null); setSlot(null); }}>
                {p.photo ? <Img className="photo sm" src={p.photo} alt="" /> : <span className="photo sm ph">{initials(p.name)}</span>}
                <span className="opt-main">
                  <b>{p.name}</b>
                  {p.description && <span className="muted small">{p.description}</span>}
                </span>
              </button>
            ))}
          </div>
          {selectedPro && <Carousel key={selectedPro.id} images={galleryOf(selectedPro)} title={`Trabajos de ${selectedPro.name}`} />}
          <div className="sticky-cta">
            <button className="btn lg" type="button" disabled={!profChoice} onClick={() => go(1)}>
              {profChoice ? "Continuar" : "Elegí un profesional"}
            </button>
          </div>
        </>
      )}

      {cur === "date" && (
        <>
          <h2>Elegí el día</h2>
          {selectedPro && (
            <p className="who">
              {selectedPro.photo ? <Img className="photo xs" src={selectedPro.photo} alt="" /> : <span className="photo xs ph">{initials(selectedPro.name)}</span>}
              {selectedPro.name}
            </p>
          )}
          {selectedPro && <Carousel key={selectedPro.id} images={galleryOf(selectedPro)} />}
          <Calendar
            today={today}
            maxDate={maxDate}
            selected={date}
            getStatus={dayStatus}
            onSelect={(d) => { setDate(d); setSlot(null); setBookError(""); go(1); }}
          />
        </>
      )}

      {cur === "time" && (
        <>
          <h2>Elegí la hora</h2>
          <p className="muted">{date ? dateLabel(date) : ""}</p>
          {bookError && <p className="form-error">{bookError}</p>}
          {locksState.error && <p className="form-error">No se pudo consultar la agenda: {locksState.error}</p>}
          {locksState.loading && !locksState.error && <div className="spinner" style={{ margin: "24px auto" }} />}
          {!locksState.loading && !locksState.error && slotList.length === 0 && (
            <p className="muted">No quedan horarios para ese día. Probá con otra fecha.</p>
          )}
          <div className="slots">
            {slotList.map((s) => (
              <button key={s.time} type="button" className={`slot ${slot?.time === s.time ? "on" : ""}`}
                onClick={() => { setSlot(s); setBookError(""); go(1); }}>
                {s.time}
              </button>
            ))}
          </div>
          <button className="btn ghost" type="button" style={{ marginTop: 18 }} onClick={() => setStepName("date")}>
            Cambiar de día
          </button>
        </>
      )}

      {cur === "data" && (
        <form onSubmit={(e) => { e.preventDefault(); if (validateClient()) go(1); }} noValidate>
          <h2>Tus datos</h2>
          <label className="field"><span>Nombre y apellido</span>
            <input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} autoComplete="name" maxLength={80} />
            {errors.name && <small className="form-error">{errors.name}</small>}
          </label>
          <label className="field"><span>WhatsApp</span>
            <input value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} inputMode="tel" autoComplete="tel" placeholder="11 2345 6789" maxLength={20} />
            {errors.phone && <small className="form-error">{errors.phone}</small>}
          </label>
          <label className="field"><span>Observaciones (opcional)</span>
            <textarea rows={3} value={client.notes} onChange={(e) => setClient({ ...client, notes: e.target.value })} maxLength={300} />
            {errors.notes && <small className="form-error">{errors.notes}</small>}
          </label>
          <div className="sticky-cta"><button className="btn lg" type="submit">Revisar turno</button></div>
        </form>
      )}

      {cur === "confirm" && (
        <>
          <h2>Confirmá tu turno</h2>
          <Summary
            rows={[
              ["Servicio", serviceNames],
              ["Profesional", slotPro?.name],
              ["Fecha", dateLabel(date)],
              ["Hora", `${slot?.time} hs`],
              ["Duración", `${duration} min`],
              ["Precio", money(price)],
              ...(deposit > 0 ? [["Seña a abonar", money(deposit)]] : []),
              ["A nombre de", client.name.trim()],
              ["WhatsApp", client.phone.trim()],
              ...(client.notes.trim() ? [["Observaciones", client.notes.trim()]] : []),
            ]}
          />
          {deposit > 0 && (
            <p className="muted small">
              Para reservar se pide una seña de <b>{money(deposit)}</b>. Al confirmar vas a ver los datos de la cuenta; tenés {DEPOSIT_HOURS} hs para abonarla. Si no se acredita, el turno se cancela solo a las {EXPIRE_HOURS} hs.
            </p>
          )}
          {c.cancelPolicy && <p className="muted small">{c.cancelPolicy}</p>}
          {bookError && <p className="form-error">{bookError}</p>}
          <div className="sticky-cta">
            <button className="btn lg" type="button" onClick={confirm} disabled={busy}>
              {busy ? "Reservando…" : "Confirmar turno"}
            </button>
          </div>
        </>
      )}
    </Shell>
  );
}

function Summary({ rows }) {
  return (
    <dl className="summary">
      {rows.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}

function Shell({ children, name, step, total, onBack }) {
  return (
    <div className="book">
      <header className="book-bar">
        {onBack ? (
          <button type="button" className="icon-btn" onClick={onBack} aria-label="Volver">‹</button>
        ) : (
          <Link className="icon-btn" to="/" aria-label="Inicio">‹</Link>
        )}
        <b className="book-title">{name || "Reservar turno"}</b>
        <span className="muted small">{step ? `${step}/${total}` : ""}</span>
      </header>
      {step && (
        <div className="progress"><div style={{ width: `${(step / total) * 100}%` }} /></div>
      )}
      <main className="book-main">{children}</main>
    </div>
  );
}
