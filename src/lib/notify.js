import { auth } from "../config/firebase";

// Avisos automáticos por WhatsApp (Etapa 5). Nunca lanza: devuelve { ok, reason }.
// Si el servidor no tiene WhatsApp configurado, el que llama usa el link manual.
export async function notifyAuto(kind, id) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (kind !== "nuevo") {
      const t = await auth.currentUser?.getIdToken();
      if (!t) return { ok: false, reason: "no_auth" };
      headers.Authorization = `Bearer ${t}`;
    }
    const r = await fetch("/api/notify", { method: "POST", headers, body: JSON.stringify({ kind, id }) });
    const j = await r.json().catch(() => ({}));
    return { ok: !!j.ok, reason: j.reason || j.error || (r.ok ? "" : "http_" + r.status), error: j.error };
  } catch {
    return { ok: false, reason: "network" };
  }
}
