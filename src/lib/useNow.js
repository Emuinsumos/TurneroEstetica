import { useEffect, useState } from "react";

// Hora actual (ms) que se refresca sola: las alertas por plazo vencido
// aparecen aunque el admin tenga el panel abierto sin tocar nada.
export function useNow(everyMs = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}
