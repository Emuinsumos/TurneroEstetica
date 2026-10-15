import { useState } from "react";
import { Link } from "react-router-dom";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../../config/firebase";

export default function AdminLogin() {
  const [user, setUser] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (busy) return; // evita doble envío
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user.trim(), pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar sesión");
      await signInWithCustomToken(auth, data.token);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Sin conexión con el servidor. Revisá tu internet."
          : err.message
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <p className="kicker">Acceso privado</p>
        <h2 style={{ marginBottom: 20 }}>Administración</h2>

        <label>Usuario</label>
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          required
        />

        <label>PIN</label>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoComplete="current-password"
          required
        />

        {error && <p className="form-error">{error}</p>}

        <button className="btn lg" type="submit" disabled={busy} style={{ width: "100%", marginTop: 8 }}>
          {busy ? "Ingresando…" : "Ingresar"}
        </button>
        <Link className="back-link" to="/">← Volver a la página</Link>
      </form>
    </div>
  );
}
