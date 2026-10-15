import { useState } from "react";

// Maneja "guardando…", mensajes de éxito/error y evita doble envío.
export function useSave() {
  const [st, setSt] = useState({ busy: false, msg: "", err: false });
  async function run(fn, okMsg = "Guardado ✓") {
    if (st.busy) return false;
    setSt({ busy: true, msg: "", err: false });
    try {
      await fn();
      setSt({ busy: false, msg: okMsg, err: false });
      return true;
    } catch (e) {
      setSt({ busy: false, msg: e.message || "No se pudo guardar", err: true });
      return false;
    }
  }
  return [st, run];
}

export const Field = ({ label, hint, children }) => (
  <label className="field">
    <span>{label}</span>
    {children}
    {hint && <small className="muted">{hint}</small>}
  </label>
);

export const Check = ({ checked, onChange, children }) => (
  <label className="check">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span>{children}</span>
  </label>
);

export const Status = ({ st }) =>
  st.msg ? <p className={st.err ? "form-error" : "form-ok"}>{st.msg}</p> : null;

export const linesToList = (text) =>
  text.split("\n").map((s) => s.trim()).filter(Boolean);

export const optional = (v) => {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
};
