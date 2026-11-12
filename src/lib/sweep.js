// Avisa al servidor que revise los turnos vencidos sin seña (/api/sweep).
// Es un "tocar el timbre": no manda datos y el servidor decide solo qué cancelar.
// Si falla (por ejemplo en `npm run dev`, donde no hay servidor) no pasa nada.
export function triggerSweep() {
  try {
    fetch("/api/sweep", { method: "POST", keepalive: true }).catch(() => {});
  } catch { /* sin conexión: se ignora */ }
}
