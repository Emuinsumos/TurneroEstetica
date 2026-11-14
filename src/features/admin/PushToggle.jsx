import { useEffect, useState } from "react";
import { pushState, enablePush, disablePush } from "../../lib/push";

// Botón para activar/desactivar los avisos de turnos nuevos en ESTE celular.
export default function PushToggle() {
  const [st, setSt] = useState("loading"); // loading | unsupported | denied | on | off
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const refresh = async () => setSt(await pushState());
  useEffect(() => { refresh(); }, []);

  async function toggle() {
    setBusy(true);
    setErr("");
    try {
      if (st === "on") await disablePush();
      else await enablePush();
    } catch (e) {
      const m = String(e?.message || e?.code || "");
      if (m === "denied") setErr("Bloqueaste los avisos. Activalos desde los permisos del sitio en el navegador.");
      else if (/PERMISSION_DENIED/i.test(m)) setErr("No se pudo guardar este celular: faltan publicar las reglas de Firebase.");
      else setErr("No se pudieron activar los avisos. Probá de nuevo.");
    }
    setBusy(false);
    refresh();
  }

  if (st === "loading") return null;

  return (
    <div className="admin-card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <b>🔔 Avisos de turnos nuevos</b>
          <p className="muted small">
            {st === "unsupported" && "Este navegador no soporta avisos. Probá con Chrome en el celular."}
            {st === "denied" && "Los avisos están bloqueados en este navegador. Activalos desde los permisos del sitio."}
            {st === "on" && "Activados en este celular: te avisamos apenas entra un turno."}
            {st === "off" && "Desactivados en este celular."}
          </p>
        </div>
        {(st === "on" || st === "off") && (
          <button type="button" className={st === "on" ? "btn ghost sm" : "btn sm"} onClick={toggle} disabled={busy}>
            {busy ? "…" : st === "on" ? "Desactivar" : "Activar avisos"}
          </button>
        )}
      </div>
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}
