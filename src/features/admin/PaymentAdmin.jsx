import { useEffect, useState } from "react";
import { usePayment, useAuditLog, toList } from "../../lib/data";
import { validatePayment } from "../../lib/payment";
import { paymentConfig, DEPOSIT_HOURS, EXPIRE_HOURS } from "../../lib/deposit";
import { money } from "../../lib/hours";
import DepositBox from "../booking/DepositBox";
import { adminCall } from "./adminApi";
import { Field, Check, Status, useSave } from "./ui";

const LABEL = { enabled: "Seña", amount: "Monto", alias: "Alias", holder: "Titular", bank: "Banco" };
const show = (k, v) => {
  if (v === undefined || v === null || v === "") return "(vacío)";
  if (k === "enabled") return v ? "activada" : "desactivada";
  if (k === "amount") return money(v);
  return String(v);
};
const fmtAt = (at) => (typeof at === "number" ? new Date(at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—");

export default function PaymentAdmin() {
  const pay = usePayment();
  const log = useAuditLog();
  const [creds, setCreds] = useState({ loading: true, custom: true });

  // ¿Ya cambió la contraseña de fábrica? Sin eso el servidor no deja modificar el alias.
  useEffect(() => {
    let alive = true;
    adminCall("/api/admin-credentials", "GET")
      .then((d) => alive && setCreds({ loading: false, custom: !!d.custom }))
      .catch(() => alive && setCreds({ loading: false, custom: true }));
    return () => { alive = false; };
  }, []);

  if (pay.loading) return <p className="muted">Cargando…</p>;
  const p = pay.data || {};
  const cfg = paymentConfig(p);
  const changes = toList(log.data)
    .filter((l) => l.kind === "payment")
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .slice(0, 5);

  return (
    <div className="admin-stack">
      {!creds.loading && !creds.custom && (
        <div className="alert-card">
          <h3>Primero cambiá la contraseña de fábrica</h3>
          <p className="small">Mientras uses la contraseña que te entregaron, cualquiera que la conozca podría entrar. Por seguridad el sistema no deja cargar ni modificar el alias hasta que la cambies en la pestaña <b>Acceso</b>.</p>
        </div>
      )}

      <PaymentForm p={p} locked={!creds.loading && !creds.custom} />

      <div className="admin-card">
        <h3>Así lo ve hoy tu clienta</h3>
        <p className="muted small">Es lo que está guardado ahora. Revisá que el alias y el titular estén bien escritos.</p>
        {cfg.on ? (
          <DepositBox amount={cfg.amount} alias={cfg.alias} holder={cfg.holder} bank={cfg.bank} />
        ) : (
          <p className="form-error">La seña está desactivada o incompleta: las reservas se hacen <b>sin</b> pedir seña.</p>
        )}
        <p className="muted small">Última modificación: {fmtAt(p.updatedAt)}</p>
      </div>

      <div className="admin-card">
        <h3>Historial de cambios</h3>
        {log.error && <p className="muted small">No se pudo leer el historial.</p>}
        {!log.error && changes.length === 0 && <p className="muted small">Todavía no hay cambios registrados.</p>}
        {changes.map((l) => (
          <div className="hist" key={l.id}>
            <span className="muted small">{fmtAt(l.at)}</span>
            {Object.entries(l.changes || {}).map(([k, v]) => (
              <p className="small" key={k}><b>{LABEL[k] || k}:</b> {show(k, v?.from)} → {show(k, v?.to)}</p>
            ))}
          </div>
        ))}
        <p className="muted small">Si ves un cambio que no hiciste, cambiá tu contraseña en <b>Acceso</b> enseguida.</p>
      </div>
    </div>
  );
}

function PaymentForm({ p, locked }) {
  const [f, setF] = useState({
    enabled: p.enabled === true,
    amount: String(p.amount ?? 10000),
    alias: p.alias || "",
    holder: p.holder || "",
    bank: p.bank || "",
    currentPin: "",
  });
  const [st, run] = useSave();
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  async function save(e) {
    e.preventDefault();
    await run(async () => {
      const { errors } = validatePayment(f);
      const first = Object.values(errors)[0];
      if (first) throw new Error(first);
      if (!f.currentPin) throw new Error("Escribí tu contraseña para confirmar el cambio");
      const ok = window.confirm(
        `Vas a guardar los datos donde tus clientas transfieren la seña:\n\nAlias: ${f.alias.trim() || "(vacío)"}\nTitular: ${f.holder.trim() || "(vacío)"}\nMonto: ${money(Number(f.amount))}\nSeña: ${f.enabled ? "activada" : "desactivada"}\n\n¿Está todo bien?`
      );
      if (!ok) throw new Error("No se guardó nada.");
      await adminCall("/api/payment", "POST", f);
      set("currentPin", "");
    }, "Guardado ✓ Revisá abajo cómo lo ve tu clienta.");
  }

  return (
    <form className="admin-card" onSubmit={save}>
      <h3>Seña</h3>
      <p className="muted small">
        Al reservar, la clienta ve cuánto transferir y a qué cuenta. El horario queda bloqueado. Pasadas {DEPOSIT_HOURS} hs sin seña el turno
        aparece en rojo; a las {EXPIRE_HOURS} hs se cancela solo (también podés cancelarlo vos antes).
      </p>
      <Check checked={f.enabled} onChange={(v) => set("enabled", v)}>Pedir seña al reservar</Check>
      <Field label="Monto de la seña ($)" hint="Es un valor fijo. Si un servicio sale menos, se pide el precio del servicio.">
        <input type="number" inputMode="numeric" min={1} step={1} value={f.amount} onChange={(e) => set("amount", e.target.value)} />
      </Field>
      <Field label="Alias para transferir" hint="6 a 20 caracteres: letras, números, punto o guion.">
        <input value={f.alias} onChange={(e) => set("alias", e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={20} placeholder="nombre.estetica" />
      </Field>
      <Field label="Titular de la cuenta" hint="Nombre completo: las clientas lo usan para verificar que transfieren a la cuenta correcta.">
        <input value={f.holder} onChange={(e) => set("holder", e.target.value)} maxLength={80} autoComplete="off" />
      </Field>
      <Field label="Banco o billetera (opcional)">
        <input value={f.bank} onChange={(e) => set("bank", e.target.value)} maxLength={40} placeholder="Mercado Pago, Naranja X, Banco Nación…" autoComplete="off" />
      </Field>
      <Field label="Tu contraseña" hint="Se pide cada vez que cambiás estos datos, para que nadie pueda modificarlos aunque use tu celular.">
        <input type="password" value={f.currentPin} onChange={(e) => set("currentPin", e.target.value)} autoComplete="current-password" />
      </Field>
      <Status st={st} />
      <button className="btn lg" type="submit" disabled={st.busy || locked}>{st.busy ? "Guardando…" : "Guardar datos de la seña"}</button>
    </form>
  );
}
