import { useEffect, useState } from "react";
import { auth } from "../../config/firebase";
import { Field, Status, useSave } from "./ui";

async function call(method, body) {
  const t = await auth.currentUser?.getIdToken();
  if (!t) throw new Error("Tu sesión venció. Salí y volvé a ingresar.");
  let res;
  try {
    res = await fetch("/api/admin-credentials", {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Sin conexión con el servidor. Revisá tu internet.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo completar");
  return data;
}

export default function AccountAdmin() {
  const [info, setInfo] = useState({ loading: true, custom: false, user: null, error: "" });
  const [f, setF] = useState({ newUser: "", currentPin: "", newPin: "", newPin2: "" });
  const [st, run] = useSave();
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    let alive = true;
    call("GET")
      .then((d) => alive && setInfo({ loading: false, custom: d.custom, user: d.user, error: "" }))
      .catch((e) => alive && setInfo({ loading: false, custom: false, user: null, error: e.message }));
    return () => { alive = false; };
  }, []);

  async function save(e) {
    e.preventDefault();
    await run(async () => {
      if (f.newPin !== f.newPin2) throw new Error("Las contraseñas nuevas no coinciden");
      const d = await call("POST", { currentPin: f.currentPin, newUser: f.newUser, newPin: f.newPin });
      setInfo({ loading: false, custom: true, user: d.user, error: "" });
      setF({ newUser: "", currentPin: "", newPin: "", newPin2: "" });
    }, "Listo ✓ Desde la próxima vez ingresá con el usuario y la contraseña nuevos.");
  }

  return (
    <form className="admin-stack" onSubmit={save}>
      <div className="admin-card">
        <h3>Usuario y contraseña</h3>
        {info.loading && <p className="muted">Cargando…</p>}
        {!info.loading && !info.error && !info.custom && (
          <p className="form-error">
            Todavía usás el acceso que te entregaron. Cambialo ahora para que solo vos puedas entrar.
          </p>
        )}
        {!info.loading && info.custom && (
          <p className="muted small">Usuario actual: <b>{info.user}</b></p>
        )}
        {info.error && <p className="form-error">{info.error}</p>}

        <Field label="Usuario nuevo" hint="Entre 3 y 30 caracteres: letras, números y . _ @ -">
          <input value={f.newUser} onChange={(e) => set("newUser", e.target.value)}
            autoComplete="username" autoCapitalize="none" required />
        </Field>
        <Field label="Contraseña actual">
          <input type="password" value={f.currentPin} onChange={(e) => set("currentPin", e.target.value)}
            autoComplete="current-password" required />
        </Field>
        <Field label="Contraseña nueva" hint="Mínimo 6 caracteres. Guardala en un lugar seguro.">
          <input type="password" value={f.newPin} onChange={(e) => set("newPin", e.target.value)}
            autoComplete="new-password" required />
        </Field>
        <Field label="Repetir contraseña nueva">
          <input type="password" value={f.newPin2} onChange={(e) => set("newPin2", e.target.value)}
            autoComplete="new-password" required />
        </Field>
      </div>

      <Status st={st} />
      <button className="btn lg" type="submit" disabled={st.busy}>
        {st.busy ? "Guardando…" : "Cambiar usuario y contraseña"}
      </button>
    </form>
  );
}
